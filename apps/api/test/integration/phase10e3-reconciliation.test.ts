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
import { eq, sql, type SQL } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import sharp from "sharp"
import { createApp } from "../../src/app"
import { createDatabase, type Database } from "../../src/db/client"
import type { Auth } from "../../src/features/account/auth"
import {
  avatarFrame,
  comment,
  manga,
  member,
  organization,
  shopChest,
  shopGachaRoll,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
  userProfile,
} from "../../src/db/schema"
import {
  createAvatarFrame,
  deleteFrameTopic,
  equipAvatarFrame,
  publishAvatarFrame,
  saveFrameTopic,
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
} from "../../src/features/avatar-frames/service"
import { lockActiveCoinUser } from "../../src/features/coin/access"
import { maintenanceTarget } from "../../src/shared/maintenance-target"
import {
  penalizeCommentDelete,
  syncCommentCoin,
} from "../../src/features/coin/comments"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import {
  createCoinService,
  reconcileCoinWallet,
} from "../../src/features/coin/service"
import { transferGroupCoin } from "../../src/features/coin/wallet"
import {
  applyCatalog,
  checkedAssets,
  sealCatalog,
} from "../../src/features/shop/catalog-maintenance"
import {
  getShopChest,
  updateShopChest,
} from "../../src/features/shop/gacha-chests"
import { reconcileGachaDatabase } from "../../src/features/shop/gacha-reconciliation"
import {
  personalGachaRoll,
  rollShopGacha,
  type GachaRollInput,
} from "../../src/features/shop/gacha-rolls"
import { reconcileShopDatabase } from "../../src/features/shop/reconciliation"
import { purchaseAvatarFrame } from "../../src/features/shop/service"
import { normalizeFrame } from "../../src/shared/avatar-frame-media"
import type { BusinessCache } from "../../src/shared/cache"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>, admin: string
const coin = createCoinService({ enabled: true })
const assetBaseUrl = "https://assets.example.com"
const deps = () => ({
  database: connection.db,
  coin,
  coinEnabled: true,
  shopEnabled: true,
  avatarFramesEnabled: true,
  gachaEnabled: true,
  assetBaseUrl,
})
const rng =
  (rarity: "R" | "SR" | "SSR" = "R") =>
  (max: number) =>
    max === 10_000 ? { R: 1250, SR: 250, SSR: 0 }[rarity] : 0
async function account(role = "user") {
  const id = randomUUID()
  await connection.db.insert(user).values({
    id,
    role,
    name: "Gacha audit fixture",
    email: `${id}@example.com`,
  })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function credit(
  actor: string,
  amount = "1000",
  owner = { kind: "user" as "user" | "group", id: actor }
) {
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `fixture:${randomUUID()}`,
      actorUserId: actor,
      sourceType: "fixture.credit",
      sourceId: randomUUID(),
      entries: [{ owner, mode: "credit", amount }],
    })
  )
}
function asset(rarity: "R" | "SR" | "SSR", topicId: string) {
  const id = randomUUID()
  return {
    id,
    code: `audit-${id}`,
    name: `Frame ${rarity}`,
    description: "",
    topicId,
    rarity,
    limited: false,
    displayScale: 125,
    offsetX: 0,
    offsetY: 0,
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
    loop: null,
    delays: [0],
  }
}
async function fixture() {
  const topic = (
    await saveFrameTopic(connection.db, admin, { name: `Game ${randomUUID()}` })
  ).data
  const frames = await connection.db
    .insert(avatarFrame)
    .values(
      (["R", "SR", "SSR"] as const).map((r) => ({
        ...asset(r, topic.id),
        active: true,
        shopStock: 0,
        shopPrice: BigInt({ R: 5, SR: 15, SSR: 100 }[r]),
      }))
    )
    .returning()
  const [chest] = await connection.db
    .select()
    .from(shopChest)
    .where(eq(shopChest.topicId, topic.id))
  await updateShopChest(deps(), admin, chest!.id, {
    expectedVersion: chest!.version,
    saleEnabled: true,
  })
  return { topic, chestId: chest!.id, frames }
}
async function quote(chestId: string): Promise<GachaRollInput> {
  const { data: chest, rule } = await getShopChest(deps(), chestId)
  return {
    operationId: randomUUID(),
    chestId,
    expectedChestVersion: chest.version,
    expectedRuleVersion: rule.version,
    expectedPoolDigest: chest.pool.digest,
    expectedPrice: chest.price,
  }
}
async function audits() {
  return connection.db.transaction(
    async (tx) => ({
      gacha: await reconcileGachaDatabase(tx),
      coin: await reconcileCoinDatabase(tx),
      shop: await reconcileShopDatabase(tx),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" }
  )
}
async function clean() {
  const result = await audits()
  expect(result.gacha).toMatchObject({
    matches: true,
    financialErrors: "0",
    orphanErrors: "0",
    auditErrors: "0",
    pityErrors: "0",
    stateErrors: "0",
  })
  expect(result.coin.matches).toBe(true)
  expect(result.shop.matches).toBe(true)
}
async function snapshot() {
  const result = await connection.db.execute<{
    state: string
  }>(sql`SELECT jsonb_build_object(
    'wallet', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM coin_wallet t),
    'operation', (SELECT jsonb_agg(to_jsonb(t) ORDER BY key) FROM coin_operation t),
    'ledger', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM coin_ledger t),
    'ownership', (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id, frame_id) FROM user_avatar_frame t),
    'frame', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM avatar_frame t),
    'profile', (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM user_profile t),
    'chest', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM shop_chest t),
    'pity', (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM shop_gacha_state t),
    'receipt', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM shop_gacha_roll t),
    'purchase', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM shop_purchase t),
    'audit', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM moderation_action t)
  )::text AS state`)
  return result.rows[0]!.state
}
async function failure(work: Promise<unknown>, code: string) {
  const error = await work.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).toMatchObject({ code })
}
function pauseCoin() {
  let entered!: () => void, release!: () => void
  const reached = new Promise<void>((resolve) => {
      entered = resolve
    }),
    gate = new Promise<void>((resolve) => {
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
async function waitForLock() {
  for (let i = 0; i < 150; i++) {
    const r = await connection.db.execute<{ waiting: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0) AS waiting`
    )
    if (r.rows[0]!.waiting) return
    await Bun.sleep(10)
  }
  throw new Error("Writer never reached a PostgreSQL lock wait")
}
async function race(
  writer: (
    f: Awaited<ReturnType<typeof fixture>>,
    actor: string
  ) => Promise<unknown>,
  rarity: "R" | "SSR" = "R"
) {
  const actor = await account(),
    f = await fixture()
  await credit(actor)
  const pause = pauseCoin(),
    rolling = rollShopGacha(
      { ...deps(), coin: pause.coin },
      actor,
      await quote(f.chestId),
      rng(rarity)
    )
  await Promise.race([
    pause.reached,
    rolling.then(() => {
      throw new Error("Missing roll pause")
    }),
  ])
  const writing = writer(f, actor),
    results = Promise.allSettled([rolling, writing])
  try {
    await waitForLock()
  } finally {
    pause.release()
  }
  const settled = await results
  expect(settled[0]!.status).toBe("fulfilled")
  expect(settled[1]!.status).toBe("fulfilled")
  await clean()
  return { f, actor, settled }
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.3G reconciliation and real writer races",
  () => {
    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!,
        parsed = new URL(url)
      if (
        !parsed.pathname.endsWith("_test") ||
        !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
        url === process.env.DATABASE_URL
      )
        throw new Error(
          "An isolated loopback _test database is required; financial fixtures are retained"
        )
      connection = createDatabase(url)
      connection.pool.options.options =
        "-c timezone=UTC -c statement_timeout=15000 -c lock_timeout=5000"
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

    test("empty/zero state, 50-roll global chain, early SSR and historical snapshots reconcile without writes", async () => {
      await clean()
      const actor = await account(),
        zero = await account(),
        f = await fixture()
      await connection.db.execute(
        sql`INSERT INTO shop_gacha_state (user_id) VALUES (${zero})`
      )
      await credit(actor)
      const [common] = await connection.db
        .select()
        .from(shopChest)
        .where(eq(shopChest.kind, "common"))
      await updateShopChest(deps(), admin, common!.id, {
        expectedVersion: common!.version,
        saleEnabled: true,
      })
      for (let i = 1; i <= 50; i++) {
        const r = await rollShopGacha(
          deps(),
          actor,
          await quote(i % 2 ? f.chestId : common!.id),
          rng()
        )
        expect(r.pity.rollSequence).toBe(String(i))
        expect(r.frame.rarity).toBe(
          i === 50 ? "SSR" : i % 10 === 0 ? "SR" : "R"
        )
      }
      const early = await rollShopGacha(
        deps(),
        actor,
        await quote(f.chestId),
        rng("SSR")
      )
      expect(early.pity.after).toEqual({ sinceSr: 0, sinceSsr: 0 })
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        early.frame.id,
        false,
        "Fixture revoke"
      )
      await updateAvatarFrame(connection.db, admin, early.frame.id, {
        expectedVersion: 1,
        name: "Renamed after roll",
        rarity: "SR",
        active: false,
      })
      await deleteFrameTopic(connection.db, admin, f.topic.id, f.topic.version)
      const before = await snapshot()
      await clean()
      expect(await snapshot()).toBe(before)
    })

    test("corrupt financial links/refunds, orphan operations/audits and broken chain/state are reported, never repaired", async () => {
      const actor = await account(),
        f = await fixture()
      await credit(actor)
      const first = await rollShopGacha(
          deps(),
          actor,
          await quote(f.chestId),
          rng()
        ),
        r = await rollShopGacha(deps(), actor, await quote(f.chestId), rng())
      const key = `shop.gacha:${actor}:${r.operationId}`,
        orphanKey = `shop.gacha:${actor}:${randomUUID()}`,
        orphanId = randomUUID()
      const cases: [
        SQL,
        keyof Awaited<ReturnType<typeof reconcileGachaDatabase>>,
      ][] = [
        [
          sql`DELETE FROM coin_ledger WHERE id = ${r.refundLedgerId}`,
          "financialErrors",
        ],
        [
          sql`UPDATE coin_ledger SET requested_amount = 2, delta = 2 WHERE id = ${r.refundLedgerId}`,
          "financialErrors",
        ],
        [
          sql`UPDATE coin_ledger SET wallet_id = public.uuid_generate_v7() WHERE id = ${r.refundLedgerId}`,
          "financialErrors",
        ],
        [
          sql`INSERT INTO coin_ledger (operation_key, position, wallet_id, sequence, mode, requested_amount, delta, balance_after) SELECT operation_key, 2, wallet_id, sequence + 1, 'credit', 1, 1, balance_after + 1 FROM coin_ledger WHERE id = ${r.refundLedgerId}`,
          "financialErrors",
        ],
        [
          sql`UPDATE coin_operation SET actor_user_id = ${admin}, source_id = ${orphanId} WHERE key = ${key}`,
          "financialErrors",
        ],
        [
          sql`UPDATE coin_operation SET result = jsonb_set(result, '{transactionGroup}', to_jsonb(${orphanId}::text)) WHERE key = ${key}`,
          "financialErrors",
        ],
        [sql`DELETE FROM coin_operation WHERE key = ${key}`, "financialErrors"],
        [sql`DELETE FROM coin_operation WHERE key = ${key}`, "orphanErrors"],
        [
          sql`INSERT INTO coin_operation (key, fingerprint, transaction_group, actor_user_id, source_type, source_id, result) SELECT ${orphanKey}, fingerprint, ${orphanId}::uuid, actor_user_id, 'shop.gacha', ${orphanId}, result FROM coin_operation WHERE key = ${key}`,
          "orphanErrors",
        ],
        [
          sql`DELETE FROM moderation_action WHERE action = 'shop.gacha_rolled' AND after->>'receiptId' = ${r.id}`,
          "auditErrors",
        ],
        [
          sql`UPDATE moderation_action SET after = jsonb_set(after, '{refund}', '"99"') WHERE action = 'shop.gacha_rolled' AND after->>'receiptId' = ${r.id}`,
          "auditErrors",
        ],
        [
          sql`INSERT INTO moderation_action (actor_user_id, action, target_kind, target_id, reason, before, after) SELECT actor_user_id, action, target_kind, target_id, reason, before, after FROM moderation_action WHERE action = 'shop.gacha_rolled' AND after->>'receiptId' = ${r.id}`,
          "auditErrors",
        ],
        [
          sql`UPDATE moderation_action SET after = jsonb_set(after, '{receiptId}', to_jsonb(${orphanId}::text)) WHERE action = 'shop.gacha_rolled' AND after->>'receiptId' = ${r.id}`,
          "auditErrors",
        ],
        [
          sql`UPDATE shop_gacha_roll SET roll_sequence = 99 WHERE id = ${r.id}`,
          "pityErrors",
        ],
        [
          sql`UPDATE shop_gacha_roll SET since_sr_before = 0, since_sr_after = 1, since_ssr_before = 0, since_ssr_after = 1 WHERE id = ${r.id}`,
          "pityErrors",
        ],
        [
          sql`UPDATE shop_gacha_state SET roll_count = roll_count + 1 WHERE user_id = ${actor}`,
          "stateErrors",
        ],
        [
          sql`DELETE FROM shop_gacha_state WHERE user_id = ${actor}`,
          "stateErrors",
        ],
        [
          sql`UPDATE shop_gacha_roll SET coin_operation_key = ${orphanKey} WHERE id = ${first.id}`,
          "financialErrors",
        ],
      ]
      // Only this isolated superuser fixture bypasses immutable/FK triggers, inside
      // rollback-only transactions. Production reconcile never disables guards.
      const before = await snapshot(),
        rollback = new Error("rollback corruption fixture")
      for (const [change, category] of cases) {
        const error = await connection.db
          .transaction(async (tx) => {
            await tx.execute(sql`SET LOCAL session_replication_role = replica`)
            await tx.execute(change)
            const result = await reconcileGachaDatabase(tx)
            expect(Number(result[category])).toBeGreaterThan(0)
            expect(result.matches).toBe(false)
            throw rollback
          })
          .catch((error) => error)
        expect(error).toBe(rollback)
        expect(await snapshot()).toBe(before)
      }
      await clean()
    })

    test("same key draws once; different keys/chests serialize one global state; other users progress independently", async () => {
      const actor = await account(),
        other = await account(),
        f = await fixture(),
        g = await fixture()
      await credit(actor)
      await credit(other)
      const q = await quote(f.chestId)
      let draws = 0
      const once = (max: number) => {
        draws++
        return rng()(max)
      }
      const replies = await Promise.all(
        Array.from({ length: 4 }, () => rollShopGacha(deps(), actor, q, once))
      )
      expect(draws).toBe(2)
      expect(new Set(replies.map((r) => r.id)).size).toBe(1)
      const pause = pauseCoin(),
        one = rollShopGacha(
          { ...deps(), coin: pause.coin },
          actor,
          await quote(f.chestId),
          rng()
        )
      await pause.reached
      const two = rollShopGacha(deps(), actor, await quote(g.chestId), rng()),
        joined = Promise.allSettled([one, two])
      try {
        await waitForLock()
        const independent = await rollShopGacha(
          deps(),
          other,
          await quote(g.chestId),
          rng()
        )
        expect(independent.pity.rollSequence).toBe("1")
      } finally {
        pause.release()
      }
      expect((await joined).map((r) => r.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ])
      const rows = await connection.db
        .select()
        .from(shopGachaRoll)
        .where(eq(shopGachaRoll.actorUserId, actor))
      expect(rows.map((r) => r.rollSequence).sort()).toEqual([1n, 2n, 3n])
      const b = await account(),
        c = await account()
      await credit(b)
      await credit(c)
      const sameFrame = await Promise.all([
        rollShopGacha(deps(), b, await quote(f.chestId), rng()),
        rollShopGacha(deps(), c, await quote(f.chestId), rng()),
      ])
      expect(sameFrame.map((r) => r.duplicate)).toEqual([false, false])
      await clean()
    })

    test("lost COMMIT acknowledgement and fresh database pool replay never reroll; pre-COMMIT failure rolls everything back", async () => {
      const actor = await account(),
        f = await fixture(),
        q = await quote(f.chestId)
      await credit(actor)
      const lost = new Proxy(connection.db, {
        get(target, key) {
          if (key === "transaction")
            return async (...args: Parameters<Database["transaction"]>) => {
              await target.transaction(...args)
              throw new Error("lost COMMIT acknowledgement")
            }
          const value = Reflect.get(target, key)
          return typeof value === "function" ? value.bind(target) : value
        },
      })
      const error = await rollShopGacha(
        { ...deps(), database: lost },
        actor,
        q,
        rng()
      ).catch((error) => error)
      expect(error.message).toBe("lost COMMIT acknowledgement")
      const before = await snapshot(),
        restarted = createDatabase(process.env.TEST_DATABASE_URL!)
      try {
        const noDraw = () => {
          throw new Error("Replay must not depend on RNG/cache or live flags")
        }
        const receipt = await rollShopGacha(
          {
            ...deps(),
            database: restarted.db,
            gachaEnabled: false,
            shopEnabled: false,
            coin: createCoinService(),
          },
          actor,
          q,
          noDraw
        )
        expect(
          (await personalGachaRoll(restarted.db, actor, q.operationId)).data
        ).toEqual(receipt)
        expect(await snapshot()).toBe(before)
      } finally {
        await restarted.pool.end()
      }
      const next = await quote(f.chestId),
        aborted = {
          ...coin,
          apply: async (...args: Parameters<typeof coin.apply>) => {
            await coin.apply(...args)
            throw new Error("before COMMIT")
          },
        }
      await rollShopGacha(
        { ...deps(), coin: aborted },
        actor,
        next,
        rng()
      ).catch((error) => expect(error.message).toBe("before COMMIT"))
      expect(await snapshot()).toBe(before)
      await rollShopGacha(deps(), actor, next, rng())
      await clean()
    })

    test("grant/revoke/equip, metadata/rarity/active/limited/topic, publish and draft creation wait for a roll", async () => {
      const normalized = await normalizeFrame(
        await sharp({
          create: { width: 64, height: 64, channels: 4, background: "#ff0000" },
        })
          .webp()
          .toBuffer()
      )
      const writers = [
        (f: Awaited<ReturnType<typeof fixture>>, actor: string) =>
          setFrameOwnership(
            connection.db,
            admin,
            actor,
            f.frames[0]!.id,
            true,
            "Fixture"
          ),
        (f: Awaited<ReturnType<typeof fixture>>, actor: string) =>
          setFrameOwnership(
            connection.db,
            admin,
            actor,
            f.frames[0]!.id,
            false,
            "Fixture"
          ),
        (f: Awaited<ReturnType<typeof fixture>>, actor: string) =>
          equipAvatarFrame(connection.db, actor, f.frames[0]!.id, true),
        (f: Awaited<ReturnType<typeof fixture>>) =>
          updateAvatarFrame(connection.db, admin, f.frames[0]!.id, {
            expectedVersion: 1,
            name: "New name",
          }),
        (f: Awaited<ReturnType<typeof fixture>>) =>
          updateAvatarFrame(connection.db, admin, f.frames[0]!.id, {
            expectedVersion: 1,
            rarity: "SR",
          }),
        (f: Awaited<ReturnType<typeof fixture>>) =>
          updateAvatarFrame(connection.db, admin, f.frames[0]!.id, {
            expectedVersion: 1,
            active: false,
          }),
        (f: Awaited<ReturnType<typeof fixture>>) =>
          updateAvatarFrame(connection.db, admin, f.frames[2]!.id, {
            expectedVersion: 1,
            limited: true,
          }),
        (f: Awaited<ReturnType<typeof fixture>>) =>
          updateAvatarFrame(connection.db, admin, f.frames[0]!.id, {
            expectedVersion: 1,
            topicId: null,
          }),
        (f: Awaited<ReturnType<typeof fixture>>) =>
          publishAvatarFrame(
            connection.db,
            admin,
            f.frames[0]!.id,
            1,
            {
              asset: `avatar-frames/${f.frames[0]!.id}/new.webp`,
              preview: `avatar-frames/${f.frames[0]!.id}/new-preview.webp`,
            },
            normalized
          ),
        () =>
          createAvatarFrame(connection.db, admin, {
            code: `draft-${randomUUID()}`,
            name: "Draft",
            rarity: "R",
            limited: false,
          }),
      ]
      for (const writer of writers) await race(writer)
    })

    test("rename/delete topic, close chest and format-2 importer serialize pool snapshots without opening imported chests", async () => {
      await race((f) =>
        saveFrameTopic(connection.db, admin, {
          id: f.topic.id,
          expectedVersion: f.topic.version,
          name: "Renamed game",
        })
      )
      await race((f) =>
        deleteFrameTopic(connection.db, admin, f.topic.id, f.topic.version)
      )
      await race(async (f) =>
        updateShopChest(deps(), admin, f.chestId, {
          expectedVersion: (await getShopChest(deps(), f.chestId)).data.version,
          saleEnabled: false,
        })
      )
      const topic = { id: randomUUID(), name: `Imported ${randomUUID()}` }
      const document = sealCatalog({
        format: 2,
        source: maintenanceTarget(process.env.TEST_DATABASE_URL!),
        capturedAt: "2026-10-06T00:00:00.000Z",
        excluded: { disabled: 0, notReady: 0 },
        topics: [topic],
        frames: (["R", "SR", "SSR"] as const).map((r) => asset(r, topic.id)),
      })
      const apply = () =>
        applyCatalog(
          connection.db,
          admin,
          document,
          assetBaseUrl,
          checkedAssets(document, assetBaseUrl, { verified: 6, errors: [] })
        )
      await race(apply)
      await apply()
      const [chest] = await connection.db
        .select()
        .from(shopChest)
        .where(eq(shopChest.topicId, topic.id))
      expect(chest).toMatchObject({ saleEnabled: false, version: 1 })
      await clean()
    })

    test("price/stock writers and account moderation complete after the roll, without untracked stock or negative wallets", async () => {
      const a = await race((f) =>
        updateAvatarFrameShop(connection.db, admin, f.frames[0]!.id, {
          expectedVersion: 1,
          expectedShopVersion: 1,
          price: "7",
          stock: 10,
        })
      )
      const [frame] = await connection.db
        .select()
        .from(avatarFrame)
        .where(eq(avatarFrame.id, a.f.frames[0]!.id))
      expect(frame).toMatchObject({ shopStock: 10, shopVersion: 2, version: 2 })
      const b = await race((_f, actor) =>
        connection.db.transaction(async (tx) => {
          await tx.update(user).set({ banned: true }).where(eq(user.id, actor))
        })
      )
      const before = await snapshot()
      await failure(
        rollShopGacha(deps(), b.actor, await quote(b.f.chestId), rng()),
        "ACCOUNT_RESTRICTED"
      )
      expect(await snapshot()).toBe(before)
    })

    test("purchase-first gives duplicate refund; gacha-first blocks duplicate purchase; only purchase consumes stock", async () => {
      for (const purchaseFirst of [true, false]) {
        const actor = await account(),
          f = await fixture(),
          frame = f.frames[0]!
        await credit(actor, "100")
        await updateAvatarFrameShop(connection.db, admin, frame.id, {
          expectedVersion: 1,
          expectedShopVersion: 1,
          stock: 10,
        })
        const purchase = {
            operationId: randomUUID(),
            frameId: frame.id,
            expectedFrameVersion: 1,
            expectedPrice: "5",
          },
          q = await quote(f.chestId),
          pause = pauseCoin()
        const first = purchaseFirst
          ? purchaseAvatarFrame(
              { ...deps(), coin: pause.coin },
              actor,
              purchase
            )
          : rollShopGacha({ ...deps(), coin: pause.coin }, actor, q, rng())
        await pause.reached
        const second = purchaseFirst
          ? rollShopGacha(deps(), actor, q, rng())
          : purchaseAvatarFrame(deps(), actor, purchase)
        const joined = Promise.allSettled([first, second])
        try {
          await waitForLock()
        } finally {
          pause.release()
        }
        const results = await joined
        expect(results[0]!.status).toBe("fulfilled")
        if (purchaseFirst) {
          expect(results[1]!.status).toBe("fulfilled")
          expect(
            (results[1] as PromiseFulfilledResult<unknown>).value
          ).toMatchObject({ duplicate: true, refund: "1" })
        } else {
          expect(results[1]!.status).toBe("rejected")
          expect((results[1] as PromiseRejectedResult).reason).toMatchObject({
            code: "SHOP_ALREADY_OWNED",
          })
        }
        expect(
          (
            await connection.db
              .select()
              .from(avatarFrame)
              .where(eq(avatarFrame.id, frame.id))
          )[0]!.shopStock
        ).toBe(purchaseFirst ? 9 : 10)
        expect(
          (
            await reconcileCoinWallet(connection.db, {
              kind: "user",
              id: actor,
            })
          ).balance
        ).toBe(purchaseFirst ? "91" : "95")
        await clean()
      }
    })

    test("comment rewards/penalties and group transfer share wallets safely with rolls", async () => {
      const actor = await account(),
        leader = await account(),
        f = await fixture(),
        groupId = randomUUID(),
        mangaId = randomUUID(),
        commentId = randomUUID()
      await connection.db.insert(organization).values({
        id: groupId,
        name: "Gacha group",
        slug: `gacha-${groupId}`,
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
      await connection.db.insert(manga).values({
        id: mangaId,
        title: "Fixture",
        slug: `fixture-${mangaId}`,
        ownerGroupId: groupId,
        searchTitle: "fixture",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
      })
      const body = "đây là bình luận đủ dài"
      await connection.db
        .insert(comment)
        .values({ id: commentId, mangaId, userId: actor, body })
      await credit(actor, "100")
      await credit(leader, "100", { kind: "group", id: groupId })
      await Promise.all([
        rollShopGacha(deps(), actor, await quote(f.chestId), rng()),
        connection.db.transaction(async (tx) => {
          await lockActiveCoinUser(tx, actor)
          await syncCommentCoin(
            tx,
            coin,
            { id: commentId, userId: actor, parentId: null, body, version: 1 },
            true
          )
        }),
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
      ).toBe("106")
      await Promise.all([
        rollShopGacha(deps(), actor, await quote(f.chestId), rng("SSR")),
        connection.db.transaction(async (tx) => {
          await lockActiveCoinUser(tx, actor)
          await penalizeCommentDelete(
            tx,
            coin,
            { id: commentId, userId: actor, version: 1 },
            actor
          )
        }),
      ])
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .balance
      ).toBe("98")
      await clean()
    })

    test("unavailable cache cannot affect HTTP quote, roll, receipt or history", async () => {
      const actor = await account(),
        f = await fixture(),
        q = await quote(f.chestId)
      await credit(actor)
      let cacheCalls = 0
      const cache = new Proxy({} as BusinessCache, {
        get() {
          cacheCalls++
          throw new Error("Cache unavailable")
        },
      })
      const app = createApp({
        auth: {
          api: { getSession: async () => ({ user: { id: actor } }) },
        } as unknown as Auth,
        account: { database: connection.db },
        catalog: { database: connection.db, assetBaseUrl, cache },
        coin,
        shopEnabled: true,
        avatarFramesEnabled: true,
        gachaEnabled: true,
        webOrigin: "http://localhost:3000",
        production: true,
        logger: () => {},
      })
      const response = await app.request("/v1/me/shop/gacha-rolls", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(q),
      })
      expect(response.status).toBe(200)
      for (const path of [
        `/v1/shop/chests/${f.chestId}`,
        `/v1/me/shop/chests/${f.chestId}`,
        `/v1/me/shop/gacha-rolls/${q.operationId}`,
        "/v1/me/shop/gacha-rolls",
      ])
        expect((await app.request(path)).status).toBe(200)
      expect(cacheCalls).toBe(0)
      await clean()
    })
  }
)
