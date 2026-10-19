import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase, type Database } from "../../src/db/client"
import {
  avatarFrame,
  coinLedger,
  coinOperation,
  coinWallet,
  member,
  moderationAction,
  organization,
  shopPurchase,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import {
  equipAvatarFrame,
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
} from "../../src/features/avatar-frames/service"
import { lockActiveCoinUser } from "../../src/features/coin/access"
import { penalizeCommentDelete } from "../../src/features/coin/comments"
import { MAX_COIN, type CoinOwner } from "../../src/features/coin/contract"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import {
  createCoinService,
  reconcileCoinWallet,
} from "../../src/features/coin/service"
import { transferGroupCoin } from "../../src/features/coin/wallet"
import {
  ShopPurchaseReceiptSchema,
  type ShopPurchaseInput,
} from "../../src/features/shop/contract"
import { purchaseAvatarFrame } from "../../src/features/shop/service"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>
let admin: string
const coin = createCoinService({ enabled: true })
function deps() {
  return {
    database: connection.db,
    coin,
    shopEnabled: true,
    avatarFramesEnabled: true,
    assetBaseUrl: "https://assets.example.com",
  }
}
async function account(role = "user") {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, role, name: "Purchase fixture", email: `${id}@example.com` })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function frame(patch: Partial<typeof avatarFrame.$inferInsert> = {}) {
  const id = randomUUID()
  const [row] = await connection.db
    .insert(avatarFrame)
    .values({
      id,
      code: `purchase-${id}`,
      name: `Purchase ${id}`,
      rarity: "SR",
      active: true,
      assetKey: `avatar-frames/${id}/frame.webp`,
      previewKey: `avatar-frames/${id}/preview.webp`,
      width: 318,
      height: 318,
      frameCount: 1,
      byteSize: 1000,
      previewByteSize: 900,
      sha256: "a".repeat(64),
      previewSha256: "b".repeat(64),
      sourceSha256: "c".repeat(64),
      delays: [0],
      shopPrice: 15n,
      shopStock: 10,
      ...patch,
    })
    .returning()
  return row!
}
function quote(row: typeof avatarFrame.$inferSelect): ShopPurchaseInput {
  return {
    operationId: randomUUID(),
    frameId: row.id,
    expectedFrameVersion: row.version,
    expectedPrice: String(row.shopPrice ?? 15n),
  }
}
async function credit(
  actor: string,
  amount = "100",
  owner: CoinOwner = { kind: "user", id: actor }
) {
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `purchase-fixture:${randomUUID()}`,
      actorUserId: actor,
      sourceType: "fixture.credit",
      sourceId: randomUUID(),
      entries: [{ owner, mode: "credit", amount }],
    })
  )
}
async function failure(
  promise: Promise<unknown>,
  status: number,
  code: string
) {
  // Await I/O before assertions; Bun's async matcher can stall pg on Windows.
  const error = await promise.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).toMatchObject({ status, code })
}
async function state() {
  const result = await connection.db.execute<{
    state: string
  }>(sql`SELECT jsonb_build_object(
    'wallet', (SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM coin_wallet w),
    'operation', (SELECT jsonb_agg(to_jsonb(o) ORDER BY o.key) FROM coin_operation o),
    'ledger', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM coin_ledger l),
    'ownership', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.user_id, f.frame_id) FROM user_avatar_frame f),
    'frame', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM avatar_frame f),
    'profile', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.user_id) FROM user_profile p),
    'purchase', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM shop_purchase p),
    'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM moderation_action a)
  )::text AS state`)
  return result.rows[0]!.state
}
async function current(id: string) {
  const [row] = await connection.db
    .select()
    .from(avatarFrame)
    .where(eq(avatarFrame.id, id))
  return row!
}
async function ownership(actor: string, id: string) {
  const [row] = await connection.db
    .select()
    .from(userAvatarFrame)
    .where(
      and(eq(userAvatarFrame.userId, actor), eq(userAvatarFrame.frameId, id))
    )
  return row
}
async function purchaseCount(actor: string) {
  const rows = await connection.db
    .select()
    .from(shopPurchase)
    .where(eq(shopPurchase.actorUserId, actor))
  return rows.length
}
function pauseCoin() {
  let entered!: () => void
  let release!: () => void
  const reached = new Promise<void>((resolve) => {
    entered = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    reached,
    release,
    coin: {
      ...coin,
      apply: async (...args: Parameters<typeof coin.apply>) => {
        entered()
        await gate
        return coin.apply(...args)
      },
    },
  }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.2D atomic Shop purchases",
  () => {
    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!
      const parsed = new URL(url)
      if (
        !parsed.pathname.endsWith("_test") ||
        !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
        url === process.env.DATABASE_URL
      )
        throw new Error(
          "An isolated loopback database ending in _test is required; financial fixtures are retained"
        )
      connection = createDatabase(url)
      connection.pool.options.options =
        "-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=5000"
      await migrate(connection.db, {
        migrationsFolder: fileURLToPath(
          new URL("../../drizzle", import.meta.url)
        ),
      })
      admin = await account("admin")
    })
    afterAll(async () => {
      await connection?.pool.end()
    })

    test("one atomic purchase joins its exact debit, snapshot, ownership and audit without auto-equipping", async () => {
      const actor = await account()
      const row = await frame()
      const selected = await frame()
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        selected.id,
        true,
        "Fixture"
      )
      await equipAvatarFrame(connection.db, actor, selected.id, true)
      await credit(actor)
      const input = quote(row)
      const receipt = await purchaseAvatarFrame(deps(), actor, input)
      expect(ShopPurchaseReceiptSchema.safeParse(receipt).success).toBe(true)
      expect(receipt.id[14]).toBe("7")
      expect(receipt).toMatchObject({
        operationId: input.operationId,
        frame: { id: row.id, code: row.code, name: row.name, rarity: "SR" },
        price: "15",
        sequence: "2",
        balanceAfter: "85",
      })
      expect(await current(row.id)).toMatchObject({
        shopStock: 9,
        shopVersion: 2,
        version: 1,
      })
      expect(await ownership(actor, row.id)).toMatchObject({
        source: "purchase",
        grantedByUserId: null,
        revokedAt: null,
      })
      const [profile] = await connection.db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, actor))
      expect(profile!.avatarFrameId).toBe(selected.id)
      const key = `shop.purchase:${actor}:${input.operationId}`
      const [operation] = await connection.db
        .select()
        .from(coinOperation)
        .where(eq(coinOperation.key, key))
      expect(operation).toMatchObject({
        sourceType: "shop.purchase",
        sourceId: receipt.id,
        actorUserId: actor,
      })
      const entries = await connection.db
        .select()
        .from(coinLedger)
        .where(eq(coinLedger.operationKey, key))
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        id: receipt.ledgerId,
        position: 0,
        mode: "debit",
        requestedAmount: 15n,
        delta: -15n,
        balanceAfter: 85n,
        sequence: 2n,
      })
      const [audit] = await connection.db
        .select()
        .from(moderationAction)
        .where(
          and(
            eq(moderationAction.actorUserId, actor),
            eq(moderationAction.action, "avatar_frame.purchased")
          )
        )
      expect(audit!.before).toMatchObject({ stock: 10, owned: false })
      expect(audit!.after).toMatchObject({
        stock: 9,
        purchaseId: receipt.id,
        coinOperationKey: key,
        source: "purchase",
      })
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .matches
      ).toBe(true)
    })

    test("concurrent same-key requests and canonical UUIDs return one immutable receipt; another actor has its own namespace", async () => {
      const actor = await account()
      const row = await frame()
      await credit(actor)
      const input = quote(row)
      const receipts = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          purchaseAvatarFrame(
            deps(),
            actor,
            i % 2
              ? {
                  ...input,
                  frameId: input.frameId.toUpperCase(),
                  operationId: input.operationId.toUpperCase(),
                }
              : input
          )
        )
      )
      for (const receipt of receipts) expect(receipt).toEqual(receipts[0])
      expect(await purchaseCount(actor)).toBe(1)
      expect((await current(row.id)).shopStock).toBe(9)
      const another = await account()
      await credit(another)
      expect((await purchaseAvatarFrame(deps(), another, input)).id).not.toBe(
        receipts[0]!.id
      )
      expect((await current(row.id)).shopStock).toBe(8)
      const before = await state()
      for (const changed of [
        { ...input, frameId: randomUUID() },
        { ...input, expectedPrice: "16" },
        { ...input, expectedFrameVersion: 2 },
      ])
        await failure(
          purchaseAvatarFrame(deps(), actor, changed),
          409,
          "SHOP_IDEMPOTENCY_CONFLICT"
        )
      expect(await state()).toBe(before)
    })

    test("replay ignores later quotes, wallet changes, flags and revoked ownership; a new key pays again", async () => {
      const actor = await account()
      const row = await frame()
      await credit(actor)
      const input = quote(row)
      const original = await purchaseAvatarFrame(deps(), actor, input)
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        row.id,
        false,
        "Fixture revoke"
      )
      await credit(actor, "1")
      await updateAvatarFrameShop(connection.db, admin, row.id, {
        expectedVersion: 1,
        expectedShopVersion: 2,
        price: "20",
        stock: 0,
      })
      await updateAvatarFrame(connection.db, admin, row.id, {
        expectedVersion: 2,
        name: "Changed after purchase",
        active: false,
      })
      const before = await state()
      expect(
        await purchaseAvatarFrame(
          {
            ...deps(),
            coin: createCoinService(),
            shopEnabled: false,
            avatarFramesEnabled: false,
            assetBaseUrl: undefined,
          },
          actor,
          input
        )
      ).toEqual(original)
      expect(await state()).toBe(before)
      expect((await ownership(actor, row.id))!.revokedAt).not.toBeNull()
      await updateAvatarFrame(connection.db, admin, row.id, {
        expectedVersion: 3,
        active: true,
      })
      await updateAvatarFrameShop(connection.db, admin, row.id, {
        expectedVersion: 4,
        expectedShopVersion: 3,
        stock: 2,
      })
      const rebuy = await purchaseAvatarFrame(
        deps(),
        actor,
        quote(await current(row.id))
      )
      expect(rebuy).toMatchObject({
        price: "20",
        balanceAfter: "66",
        frame: { name: "Changed after purchase" },
      })
      expect(await ownership(actor, row.id)).toMatchObject({
        source: "purchase",
        grantedByUserId: null,
        revokedAt: null,
      })
      expect(await purchaseCount(actor)).toBe(2)
      expect(await purchaseAvatarFrame(deps(), actor, input)).toEqual(original)
    })

    test("reactivating an admin grant records prior provenance and does not select the frame", async () => {
      const actor = await account()
      const row = await frame()
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        row.id,
        true,
        "Fixture grant"
      )
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        row.id,
        false,
        "Fixture revoke"
      )
      const previous = await ownership(actor, row.id)
      await credit(actor)
      await purchaseAvatarFrame(deps(), actor, quote(row))
      expect(await ownership(actor, row.id)).toMatchObject({
        source: "purchase",
        grantedByUserId: null,
        revokedAt: null,
      })
      const [audit] = await connection.db
        .select()
        .from(moderationAction)
        .where(
          and(
            eq(moderationAction.actorUserId, actor),
            eq(moderationAction.action, "avatar_frame.purchased")
          )
        )
      expect(audit!.before).toMatchObject({
        source: "admin",
        grantedByUserId: admin,
        revokedAt: previous!.revokedAt!.toISOString(),
      })
      const [profile] = await connection.db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, actor))
      expect(profile!.avatarFrameId).toBeNull()
    })

    test("fresh account state protects new purchases and replay; flags and invalid inputs write nothing", async () => {
      const actor = await account()
      const row = await frame()
      const input = quote(row)
      for (const [flags, code, status] of [
        [{ shopEnabled: false }, "SHOP_DISABLED", 503],
        [{ coin: createCoinService() }, "COIN_DISABLED", 503],
        [{ avatarFramesEnabled: false }, "AVATAR_FRAMES_DISABLED", 403],
      ] as const) {
        const before = await state()
        await failure(
          purchaseAvatarFrame({ ...deps(), ...flags }, actor, input),
          status,
          code
        )
        expect(await state()).toBe(before)
      }
      await failure(
        purchaseAvatarFrame(deps(), actor, { ...input, userId: admin }),
        400,
        "VALIDATION_ERROR"
      )
      await failure(
        purchaseAvatarFrame(deps(), randomUUID(), input),
        403,
        "ACCOUNT_RESTRICTED"
      )
      await credit(actor)
      await purchaseAvatarFrame(deps(), actor, input)
      for (const restricted of ["suspended", "banned"] as const) {
        await connection.db
          .update(userProfile)
          .set({
            status: restricted,
            moderatedAt: new Date(),
            moderationReason: "Test restriction",
          })
          .where(eq(userProfile.userId, actor))
        const before = await state()
        await failure(
          purchaseAvatarFrame(deps(), actor, input),
          403,
          "ACCOUNT_RESTRICTED"
        )
        await failure(
          purchaseAvatarFrame(deps(), actor, quote(row)),
          403,
          "ACCOUNT_RESTRICTED"
        )
        expect(await state()).toBe(before)
      }
      await connection.db
        .update(userProfile)
        .set({ status: "active" })
        .where(eq(userProfile.userId, actor))
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, actor))
      await failure(
        purchaseAvatarFrame(deps(), actor, input),
        403,
        "ACCOUNT_RESTRICTED"
      )
    })

    test("unavailable, limited, stale quotes, ownership and sold-out checks cause no partial writes", async () => {
      const actor = await account()
      await credit(actor)
      const draft = await connection.db
        .insert(avatarFrame)
        .values({
          code: `draft-${randomUUID()}`,
          name: "Draft",
          rarity: "SR",
          shopPrice: 15n,
          shopStock: 10,
        })
        .returning()
      const unavailable = [
        draft[0]!,
        await frame({ active: false }),
        await frame({ shopPrice: null }),
        await frame({ assetKey: "../unsafe.webp" }),
        await frame({ previewKey: "https://outside.example/x.webp" }),
      ]
      for (const row of unavailable) {
        const before = await state()
        await failure(
          purchaseAvatarFrame(deps(), actor, quote(row)),
          409,
          "SHOP_FRAME_UNAVAILABLE"
        )
        expect(await state()).toBe(before)
      }
      const row = await frame()
      const before = await state()
      await failure(
        purchaseAvatarFrame(
          { ...deps(), assetBaseUrl: undefined },
          actor,
          quote(row)
        ),
        409,
        "SHOP_FRAME_UNAVAILABLE"
      )
      await failure(
        purchaseAvatarFrame(deps(), actor, {
          ...quote(row),
          frameId: randomUUID(),
        }),
        404,
        "NOT_FOUND"
      )
      await failure(
        purchaseAvatarFrame(deps(), actor, {
          ...quote(row),
          expectedPrice: "14",
        }),
        409,
        "SHOP_QUOTE_CHANGED"
      )
      await failure(
        purchaseAvatarFrame(deps(), actor, {
          ...quote(row),
          expectedFrameVersion: 2,
        }),
        409,
        "SHOP_QUOTE_CHANGED"
      )
      expect(await state()).toBe(before)
      const limited = await frame({ rarity: "SSR", limited: true })
      await failure(
        purchaseAvatarFrame(deps(), actor, quote(limited)),
        403,
        "LIMITED_FRAME_PROTECTED"
      )
      const sold = await frame({ shopStock: 0 })
      await failure(
        purchaseAvatarFrame(deps(), actor, quote(sold)),
        409,
        "SHOP_SOLD_OUT"
      )
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        sold.id,
        true,
        "Fixture"
      )
      const ownedState = await state()
      await failure(
        purchaseAvatarFrame(deps(), actor, quote(sold)),
        409,
        "SHOP_ALREADY_OWNED"
      )
      expect(await state()).toBe(ownedState)
    })

    test("insufficient funds rolls back a lazy wallet; large prices stay exact and revision/sequence overflow rolls back", async () => {
      const actor = await account()
      const row = await frame()
      let before = await state()
      await failure(
        purchaseAvatarFrame(deps(), actor, quote(row)),
        409,
        "COIN_INSUFFICIENT_BALANCE"
      )
      expect(await state()).toBe(before)
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .walletId
      ).toBeNull()
      await credit(actor, "14")
      before = await state()
      await failure(
        purchaseAvatarFrame(deps(), actor, quote(row)),
        409,
        "COIN_INSUFFICIENT_BALANCE"
      )
      expect(await state()).toBe(before)
      const bigActor = await account()
      const big = await frame({
        shopPrice: 9_007_199_254_740_993n,
        version: 2_147_483_647,
      })
      await credit(bigActor, MAX_COIN.toString())
      const bought = await purchaseAvatarFrame(deps(), bigActor, quote(big))
      expect(bought.price).toBe("9007199254740993")
      expect(bought.balanceAfter).toBe(
        String(MAX_COIN - 9_007_199_254_740_993n)
      )
      const exhausted = await frame({ shopVersion: 2_147_483_647 })
      before = await state()
      await failure(
        purchaseAvatarFrame(deps(), bigActor, quote(exhausted)),
        409,
        "SHOP_VERSION_CONFLICT"
      )
      expect(await state()).toBe(before)
      await connection.db
        .update(coinWallet)
        .set({ sequence: MAX_COIN })
        .where(eq(coinWallet.userId, bigActor))
      before = await state()
      try {
        await failure(
          purchaseAvatarFrame(deps(), bigActor, quote(row)),
          409,
          "COIN_AMOUNT_OVERFLOW"
        )
        expect(await state()).toBe(before)
      } finally {
        // Undo only the deliberate test corruption, never ledger history.
        await connection.db
          .update(coinWallet)
          .set({ sequence: 2n })
          .where(eq(coinWallet.userId, bigActor))
      }
    })

    test("last stock has exactly one winner; two keys for one user cannot double-charge or buy an owned frame", async () => {
      const row = await frame({ shopStock: 1 })
      const buyers = await Promise.all(
        Array.from({ length: 10 }, () => account())
      )
      await Promise.all(buyers.map((actor) => credit(actor)))
      const results = await Promise.allSettled(
        buyers.map((actor) => purchaseAvatarFrame(deps(), actor, quote(row)))
      )
      expect(
        results.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1)
      for (const result of results)
        if (result.status === "rejected")
          expect(result.reason).toMatchObject({ code: "SHOP_SOLD_OUT" })
      expect(await current(row.id)).toMatchObject({
        shopStock: 0,
        shopVersion: 2,
        version: 1,
      })
      for (const actor of buyers)
        expect(
          (
            await reconcileCoinWallet(connection.db, {
              kind: "user",
              id: actor,
            })
          ).matches
        ).toBe(true)
      const actor = await account()
      const another = await frame()
      await credit(actor)
      const twice = await Promise.allSettled([
        purchaseAvatarFrame(deps(), actor, quote(another)),
        purchaseAvatarFrame(deps(), actor, quote(another)),
      ])
      expect(
        twice.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1)
      for (const result of twice)
        if (result.status === "rejected")
          expect(result.reason).toMatchObject({ code: "SHOP_ALREADY_OWNED" })
      expect(await purchaseCount(actor)).toBe(1)
      expect((await current(another.id)).shopStock).toBe(9)
    })

    test("different frames serialize their personal-wallet debits without overspending", async () => {
      const actor = await account()
      const rows = await Promise.all([frame(), frame()])
      await credit(actor, "15")
      const results = await Promise.allSettled(
        rows.map((row) => purchaseAvatarFrame(deps(), actor, quote(row)))
      )
      expect(
        results.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1)
      for (const result of results)
        if (result.status === "rejected")
          expect(result.reason).toMatchObject({
            code: "COIN_INSUFFICIENT_BALANCE",
          })
      expect(await purchaseCount(actor)).toBe(1)
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .balance
      ).toBe("0")
      expect(
        (await Promise.all(rows.map((row) => current(row.id))))
          .map((row) => row.shopStock)
          .sort((a, b) => a - b)
      ).toEqual([9, 10])
    })

    test("SQL faults at every write stage, including deferred COMMIT, roll back the entire purchase", async () => {
      const stages = [
        ["coin_operation", "INSERT"],
        ["coin_ledger", "INSERT"],
        ["coin_wallet", "UPDATE"],
        ["avatar_frame", "UPDATE"],
        ["user_avatar_frame", "INSERT"],
        ["user_avatar_frame", "UPDATE"],
        ["shop_purchase", "INSERT"],
        ["moderation_action", "INSERT"],
        ["shop_purchase", "DEFERRED"],
      ] as const
      for (const [table, event] of stages) {
        const actor = await account()
        const row = await frame()
        await credit(actor)
        if (event === "UPDATE" && table === "user_avatar_frame") {
          await setFrameOwnership(
            connection.db,
            admin,
            actor,
            row.id,
            true,
            "Fixture"
          )
          await setFrameOwnership(
            connection.db,
            admin,
            actor,
            row.id,
            false,
            "Fixture"
          )
        }
        const before = await state()
        await connection.db.execute(
          sql`CREATE FUNCTION test_purchase_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected purchase failure'; END $$`
        )
        try {
          // Only fixed table/event literals above are interpolated into DDL.
          await connection.db.execute(
            sql.raw(
              event === "DEFERRED"
                ? `CREATE CONSTRAINT TRIGGER test_purchase_failure AFTER INSERT ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION test_purchase_failure()`
                : `CREATE TRIGGER test_purchase_failure BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_purchase_failure()`
            )
          )
          const error = await purchaseAvatarFrame(
            deps(),
            actor,
            quote(row)
          ).then(
            () => null,
            (error: unknown) => error
          )
          expect(error).toBeInstanceOf(Error)
          expect(await state()).toBe(before)
        } finally {
          await connection.db.execute(
            sql.raw(`DROP TRIGGER IF EXISTS test_purchase_failure ON ${table}`)
          )
          await connection.db.execute(
            sql`DROP FUNCTION test_purchase_failure()`
          )
        }
        expect(
          (await purchaseAvatarFrame(deps(), actor, quote(row))).balanceAfter
        ).toBe("85")
      }
    })

    test("a simulated lost commit acknowledgement is recovered by retry without another debit or grant", async () => {
      const actor = await account()
      const row = await frame()
      await credit(actor)
      const input = quote(row)
      // Commit against PostgreSQL, then lose only the caller's acknowledgement.
      const ambiguous = new Proxy(connection.db, {
        get(target, property, receiver) {
          if (property !== "transaction")
            return Reflect.get(target, property, receiver)
          return async (run: Parameters<Database["transaction"]>[0]) => {
            await target.transaction(run)
            throw new Error("Simulated lost commit acknowledgement")
          }
        },
      })
      const error = await purchaseAvatarFrame(
        { ...deps(), database: ambiguous },
        actor,
        input
      ).then(
        () => null,
        (error: unknown) => error
      )
      expect(error).toBeInstanceOf(Error)
      const before = await state()
      const recovered = await purchaseAvatarFrame(deps(), actor, input)
      expect(recovered.balanceAfter).toBe("85")
      expect(await state()).toBe(before)
      expect(await purchaseCount(actor)).toBe(1)
    })

    test("admin grants/revokes, equip, metadata, stock, price and moderation serialize with purchase locks", async () => {
      for (const change of [
        "grant",
        "revoke",
        "equip",
        "metadata",
        "toggle",
        "stock",
        "price",
        "moderation",
      ] as const) {
        const actor = await account()
        const row = await frame()
        const equipped = await frame()
        await setFrameOwnership(
          connection.db,
          admin,
          actor,
          equipped.id,
          true,
          "Fixture"
        )
        await credit(actor)
        const pause = pauseCoin()
        const buying = purchaseAvatarFrame(
          { ...deps(), coin: pause.coin },
          actor,
          quote(row)
        )
        await pause.reached
        const writing =
          change === "grant" || change === "revoke"
            ? setFrameOwnership(
                connection.db,
                admin,
                actor,
                row.id,
                change === "grant",
                "Concurrent fixture"
              )
            : change === "equip"
              ? equipAvatarFrame(connection.db, actor, equipped.id, true)
              : change === "metadata" || change === "toggle"
                ? updateAvatarFrame(connection.db, admin, row.id, {
                    expectedVersion: 1,
                    ...(change === "toggle"
                      ? { active: false }
                      : { name: "Concurrent name" }),
                  })
                : change === "stock" || change === "price"
                  ? updateAvatarFrameShop(connection.db, admin, row.id, {
                      expectedVersion: 1,
                      expectedShopVersion: 1,
                      ...(change === "price" ? { price: "20" } : { stock: 5 }),
                    })
                  : connection.db
                      .update(userProfile)
                      .set({
                        status: "suspended",
                        moderatedAt: new Date(),
                        moderationReason: "Test restriction",
                      })
                      .where(eq(userProfile.userId, actor))
        // Attach handlers before releasing locks; unexpected rejections are visible.
        const results = Promise.allSettled([buying, writing])
        pause.release()
        const settled = await results
        expect(settled[0]!.status).toBe("fulfilled")
        if (change === "stock" || change === "price") {
          expect(settled[1]).toMatchObject({
            status: "rejected",
            reason: { code: "SHOP_VERSION_CONFLICT" },
          })
          await updateAvatarFrameShop(connection.db, admin, row.id, {
            expectedVersion: 1,
            expectedShopVersion: 2,
            ...(change === "price" ? { price: "20" } : { stock: 5 }),
          })
        } else expect(settled[1]!.status).toBe("fulfilled")
        expect(await purchaseCount(actor)).toBe(1)
        expect(
          (
            await reconcileCoinWallet(connection.db, {
              kind: "user",
              id: actor,
            })
          ).balance
        ).toBe("85")
        expect((await ownership(actor, row.id))!.revokedAt === null).toBe(
          change !== "revoke"
        )
        expect((await current(row.id)).shopStock).toBe(
          change === "stock" ? 5 : 9
        )
      }
      // Opposite serialization: admin changed quote before a new purchase starts.
      const actor = await account("admin")
      const row = await frame()
      await credit(actor)
      const input = quote(row)
      await updateAvatarFrameShop(connection.db, actor, row.id, {
        expectedVersion: 1,
        expectedShopVersion: 1,
        stock: 5,
      })
      await purchaseAvatarFrame(deps(), actor, input) // Stock-only change is not a stale quote.
      const priceFrame = await frame()
      const oldQuote = quote(priceFrame)
      await updateAvatarFrameShop(connection.db, admin, priceFrame.id, {
        expectedVersion: 1,
        expectedShopVersion: 1,
        price: "20",
      })
      await failure(
        purchaseAvatarFrame(deps(), actor, oldQuote),
        409,
        "SHOP_QUOTE_CHANGED"
      )
    })

    test("group transfer and comment penalty contend safely with purchases on the same wallet", async () => {
      const actor = await account()
      const leader = await account()
      const groupId = randomUUID()
      await connection.db.insert(organization).values({
        id: groupId,
        name: "Purchase group",
        slug: `purchase-${groupId}`,
        createdAt: new Date(),
      })
      await connection.db.insert(translationGroupProfile).values({
        organizationId: groupId,
        approvalStatus: "approved",
        publicationState: "published",
      })
      for (const [userId, role] of [
        [leader, "owner"],
        [actor, "member"],
      ]) {
        const id = randomUUID()
        await connection.db.insert(member).values({
          id,
          organizationId: groupId,
          userId: userId!,
          role: role!,
          createdAt: new Date(),
        })
        await connection.db
          .insert(translationGroupMemberProfile)
          .values({ memberId: id })
      }
      await credit(leader, "100", { kind: "group", id: groupId })
      await credit(actor, "15")
      const row = await frame()
      await Promise.all([
        purchaseAvatarFrame(deps(), actor, quote(row)),
        connection.db.transaction((tx) =>
          transferGroupCoin(
            tx,
            coin,
            leader,
            groupId,
            { operationId: randomUUID(), recipientUserId: actor, amount: "10" },
            []
          )
        ),
      ])
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .balance
      ).toBe("10")
      const penaltyActor = await account()
      await credit(penaltyActor, "15")
      const penaltyFrame = await frame()
      const results = await Promise.allSettled([
        purchaseAvatarFrame(deps(), penaltyActor, quote(penaltyFrame)),
        connection.db.transaction(async (tx) => {
          await lockActiveCoinUser(tx, penaltyActor)
          await penalizeCommentDelete(
            tx,
            coin,
            { id: randomUUID(), userId: penaltyActor, version: 1 },
            penaltyActor
          )
        }),
      ])
      expect(results[1]!.status).toBe("fulfilled")
      if (results[0]!.status === "rejected")
        expect(results[0].reason).toMatchObject({
          code: "COIN_INSUFFICIENT_BALANCE",
        })
      const reconciliation = await reconcileCoinWallet(connection.db, {
        kind: "user",
        id: penaltyActor,
      })
      expect(reconciliation.matches).toBe(true)
      expect(reconciliation.balance).toBe(
        results[0]!.status === "fulfilled" ? "0" : "12"
      )
    })

    test("retained purchase receipts reconcile globally against one personal debit and immutable ledger history", async () => {
      const reconciliation = await reconcileCoinDatabase(connection.db)
      expect(reconciliation.matches).toBe(true)
      const result = await connection.db.execute<{ errors: string }>(sql`
      SELECT count(*)::text AS errors FROM shop_purchase p
      LEFT JOIN coin_operation o ON o.key = p.coin_operation_key
      WHERE o.source_type IS DISTINCT FROM 'shop.purchase' OR o.source_id IS DISTINCT FROM p.id::text
        OR o.actor_user_id IS DISTINCT FROM p.actor_user_id
        OR (SELECT count(*) FROM coin_ledger l WHERE l.operation_key = o.key) <> 1
        OR NOT EXISTS (SELECT 1 FROM coin_ledger l JOIN coin_wallet w ON w.id = l.wallet_id
          WHERE l.operation_key = o.key AND l.position = 0 AND l.mode = 'debit'
            AND w.user_id = p.actor_user_id AND l.requested_amount = p.price AND l.delta = -p.price)
    `)
      expect(result.rows[0]!.errors).toBe("0")
    })
  }
)
