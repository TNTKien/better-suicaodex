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
  moderationAction,
  shopChest,
  shopGachaRoll,
  shopGachaState,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import {
  deleteFrameTopic,
  equipAvatarFrame,
  saveFrameTopic,
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
} from "../../src/features/avatar-frames/service"
import { MAX_COIN } from "../../src/features/coin/contract"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import {
  createCoinService,
  reconcileCoinWallet,
} from "../../src/features/coin/service"
import {
  getShopChest,
  updateShopChest,
} from "../../src/features/shop/gacha-chests"
import {
  GachaRollInputSchema,
  rollShopGacha,
  type GachaRollInput,
} from "../../src/features/shop/gacha-rolls"
import { NORMAL_GACHA_RULE } from "../../src/features/shop/gacha-policy"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>, admin: string
const coin = createCoinService({ enabled: true })
const deps = () => ({
  database: connection.db,
  coin,
  coinEnabled: true,
  shopEnabled: true,
  avatarFramesEnabled: true,
  gachaEnabled: true,
  assetBaseUrl: "https://assets.example.com",
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
    name: "Gacha roll fixture",
    email: `${id}@example.com`,
  })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function credit(actor: string, amount = "1000") {
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `gacha-fixture:${randomUUID()}`,
      actorUserId: actor,
      sourceType: "fixture.credit",
      sourceId: randomUUID(),
      entries: [{ owner: { kind: "user", id: actor }, mode: "credit", amount }],
    })
  )
}
async function fixture() {
  const topic = (
    await saveFrameTopic(connection.db, admin, { name: `Game ${randomUUID()}` })
  ).data
  const frames = await connection.db
    .insert(avatarFrame)
    .values(
      (["R", "SR", "SSR"] as const).map((rarity) => {
        const id = randomUUID()
        return {
          id,
          code: `roll-${id}`,
          name: `Frame ${rarity}`,
          rarity,
          topicId: topic.id,
          active: true,
          limited: false,
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
          shopStock: 0,
          shopPrice: null,
        }
      })
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
async function failure(work: Promise<unknown>, code: string) {
  const error = await work.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).not.toBeNull()
  expect(
    (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code
  ).toBe(code)
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
    'chest', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM shop_chest c),
    'pity', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.user_id) FROM shop_gacha_state s),
    'receipt', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM shop_gacha_roll r),
    'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM moderation_action a)
  )::text AS state`)
  return result.rows[0]!.state
}
async function ownership(actor: string, frameId: string) {
  return (
    await connection.db
      .select()
      .from(userAvatarFrame)
      .where(
        and(
          eq(userAvatarFrame.userId, actor),
          eq(userAvatarFrame.frameId, frameId)
        )
      )
  )[0]
}
async function pity(actor: string) {
  return (
    await connection.db
      .select()
      .from(shopGachaState)
      .where(eq(shopGachaState.userId, actor))
  )[0]
}
async function rollCount(actor: string) {
  return (
    await connection.db
      .select()
      .from(shopGachaRoll)
      .where(eq(shopGachaRoll.actorUserId, actor))
  ).length
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.3E atomic gacha",
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

    test("fresh frame: exact debit, immutable snapshots, ownership, pity and audit without equip/stock changes", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        f.frames[1]!.id,
        true,
        "Fixture"
      )
      await equipAvatarFrame(connection.db, actor, f.frames[1]!.id, true)
      const beforeFrames = await connection.db.select().from(avatarFrame)
      const receipt = await rollShopGacha(deps(), actor, input, rng())
      expect(receipt).toMatchObject({
        frame: { id: f.frames[0]!.id, rarity: "R" },
        chest: { id: f.chestId, topicId: f.topic.id },
        price: "5",
        refund: "0",
        duplicate: false,
        balanceAfter: "995",
        refundLedgerId: null,
        pity: {
          rollSequence: "1",
          before: { sinceSr: 0, sinceSsr: 0 },
          after: { sinceSr: 1, sinceSsr: 1 },
        },
      })
      expect(await ownership(actor, receipt.frame.id)).toMatchObject({
        source: "gacha",
        revokedAt: null,
        grantedByUserId: null,
      })
      expect(await pity(actor)).toMatchObject({
        sinceSr: 1,
        sinceSsr: 1,
        rollCount: 1n,
      })
      expect(
        (
          await connection.db
            .select()
            .from(userProfile)
            .where(eq(userProfile.userId, actor))
        )[0]!.avatarFrameId
      ).toBe(f.frames[1]!.id)
      expect(await connection.db.select().from(avatarFrame)).toEqual(
        beforeFrames
      )
      const [row] = await connection.db
        .select()
        .from(shopGachaRoll)
        .where(eq(shopGachaRoll.id, receipt.id))
      expect(row).toMatchObject({
        ruleSnapshot: NORMAL_GACHA_RULE,
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        coinOperationKey: `shop.gacha:${actor}:${input.operationId}`,
      })
      const [operation] = await connection.db
        .select()
        .from(coinOperation)
        .where(eq(coinOperation.key, row!.coinOperationKey))
      expect(operation).toMatchObject({
        actorUserId: actor,
        sourceType: "shop.gacha",
        sourceId: receipt.id,
      })
      const ledger = await connection.db
        .select()
        .from(coinLedger)
        .where(eq(coinLedger.operationKey, operation!.key))
      expect(ledger).toHaveLength(1)
      expect(ledger[0]).toMatchObject({
        id: receipt.debitLedgerId,
        position: 0,
        mode: "debit",
        delta: -5n,
        referenceLedgerId: null,
      })
      const audits = await connection.db
        .select()
        .from(moderationAction)
        .where(
          and(
            eq(moderationAction.actorUserId, actor),
            eq(moderationAction.action, "shop.gacha_rolled")
          )
        )
      expect(audits).toHaveLength(1)
      expect(audits[0]!.after).toMatchObject({
        receiptId: receipt.id,
        frameId: receipt.frame.id,
        duplicate: false,
      })
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .matches
      ).toBe(true)
    })

    test("duplicates R/SR/SSR refund 1/5/20 after debit; existing ownership/equip/stock stay untouched", async () => {
      const f = await fixture()
      for (const [index, rarity] of (["R", "SR", "SSR"] as const).entries()) {
        const actor = await account(),
          frame = f.frames[index]!
        await credit(actor, "5")
        await setFrameOwnership(
          connection.db,
          admin,
          actor,
          frame.id,
          true,
          "Fixture"
        )
        await equipAvatarFrame(connection.db, actor, frame.id, true)
        const before = await ownership(actor, frame.id)
        const receipt = await rollShopGacha(
          deps(),
          actor,
          await quote(f.chestId),
          rng(rarity)
        )
        expect(receipt).toMatchObject({
          duplicate: true,
          refund: NORMAL_GACHA_RULE.duplicateRefund[rarity],
          balanceAfter: NORMAL_GACHA_RULE.duplicateRefund[rarity],
        })
        expect(receipt.refundLedgerId).not.toBeNull()
        expect(await ownership(actor, frame.id)).toEqual(before)
        expect(
          (
            await connection.db
              .select()
              .from(userProfile)
              .where(eq(userProfile.userId, actor))
          )[0]!.avatarFrameId
        ).toBe(frame.id)
        const ledger = await connection.db
          .select()
          .from(coinLedger)
          .where(
            eq(
              coinLedger.operationKey,
              `shop.gacha:${actor}:${receipt.operationId}`
            )
          )
          .orderBy(coinLedger.position)
        expect(ledger).toHaveLength(2)
        expect(ledger[0]).toMatchObject({
          mode: "debit",
          delta: -5n,
          balanceAfter: 0n,
        })
        expect(ledger[1]).toMatchObject({
          id: receipt.refundLedgerId,
          walletId: ledger[0]!.walletId,
          mode: "credit",
          delta: BigInt(receipt.refund),
          sequence: ledger[0]!.sequence + 1n,
        })
        expect(await pity(actor)).toMatchObject(
          rarity === "R"
            ? { sinceSr: 1, sinceSsr: 1 }
            : rarity === "SR"
              ? { sinceSr: 0, sinceSsr: 1 }
              : { sinceSr: 0, sinceSsr: 0 }
        )
      }
      expect(
        await connection.db
          .select()
          .from(avatarFrame)
          .where(eq(avatarFrame.topicId, f.topic.id))
      ).toEqual(f.frames)
    })

    test("revoked ownership reactivates with gacha source, no refund and no auto-equip", async () => {
      const actor = await account(),
        f = await fixture(),
        frame = f.frames[2]!
      await credit(actor)
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        frame.id,
        true,
        "Fixture"
      )
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        frame.id,
        false,
        "Fixture"
      )
      const receipt = await rollShopGacha(
        deps(),
        actor,
        await quote(f.chestId),
        rng("SSR")
      )
      expect(receipt).toMatchObject({
        duplicate: false,
        refund: "0",
        balanceAfter: "995",
      })
      expect(await ownership(actor, frame.id)).toMatchObject({
        source: "gacha",
        revokedAt: null,
        grantedByUserId: null,
      })
      expect(
        (
          await connection.db
            .select()
            .from(userProfile)
            .where(eq(userProfile.userId, actor))
        )[0]!.avatarFrameId
      ).toBeNull()
    })

    test("strict quote boundary rejects unknown/client RNG fields and malformed values without writes", async () => {
      const actor = await account(),
        f = await fixture(),
        q = await quote(f.chestId),
        before = await state()
      for (const patch of [
        { seed: 1 },
        { actor },
        { rarity: "SSR" },
        { refund: "20" },
        { expectedPrice: "05" },
        { expectedPrice: "0" },
        { expectedPrice: String(MAX_COIN + 1n) },
        { expectedPoolDigest: "z".repeat(64) },
        { expectedChestVersion: 0 },
        { expectedRuleVersion: 1.5 },
        { operationId: "bad" },
      ]) {
        expect(GachaRollInputSchema.safeParse({ ...q, ...patch }).success).toBe(
          false
        )
        await failure(
          rollShopGacha(deps(), actor, { ...q, ...patch }, rng()),
          "VALIDATION_ERROR"
        )
      }
      expect(await state()).toBe(before)
    })

    test("flags, closed/missing/retired chest, stale quote/pool and invalid pool cannot charge or leave lazy state", async () => {
      const actor = await account(),
        f = await fixture(),
        q = await quote(f.chestId)
      await credit(actor)
      for (const [patch, code] of [
        [{ shopEnabled: false }, "SHOP_DISABLED"],
        [{ coin: createCoinService() }, "COIN_DISABLED"],
        [{ avatarFramesEnabled: false }, "AVATAR_FRAMES_DISABLED"],
        [{ gachaEnabled: false }, "GACHA_DISABLED"],
      ] as const) {
        const before = await state()
        await failure(
          rollShopGacha({ ...deps(), ...patch }, actor, q, rng()),
          code
        )
        expect(await state()).toBe(before)
      }
      for (const patch of [
        { chestId: randomUUID() },
        { expectedPrice: "4" },
        { expectedRuleVersion: 2 },
        { expectedChestVersion: q.expectedChestVersion + 1 },
        { expectedPoolDigest: "0".repeat(64) },
      ]) {
        const before = await state()
        await failure(
          rollShopGacha(deps(), actor, { ...q, ...patch }, rng()),
          "chestId" in patch ? "NOT_FOUND" : "GACHA_QUOTE_CHANGED"
        )
        expect(await state()).toBe(before)
      }
      const frame = f.frames[0]!
      await connection.db
        .update(avatarFrame)
        .set({ sha256: "d".repeat(64) })
        .where(eq(avatarFrame.id, frame.id))
      const changedPoolState = await state()
      await failure(
        rollShopGacha(deps(), actor, q, rng()),
        "GACHA_QUOTE_CHANGED"
      )
      expect(await state()).toBe(changedPoolState)
      await connection.db
        .update(avatarFrame)
        .set({ sha256: frame.sha256 })
        .where(eq(avatarFrame.id, frame.id))
      await updateAvatarFrame(connection.db, admin, frame.id, {
        expectedVersion: frame.version,
        name: "Updated metadata",
        displayScale: 150,
      })
      // Presentation, price and stock are deliberately outside the pool digest.
      await updateAvatarFrameShop(connection.db, admin, frame.id, {
        expectedVersion: frame.version + 1,
        expectedShopVersion: frame.shopVersion,
        price: "5",
        stock: 10,
      })
      expect((await quote(f.chestId)).expectedPoolDigest).toBe(
        q.expectedPoolDigest
      )
      await updateAvatarFrame(connection.db, admin, frame.id, {
        expectedVersion: frame.version + 2,
        rarity: "SR",
      })
      let before = await state()
      await failure(
        rollShopGacha(deps(), actor, q, rng()),
        "GACHA_POOL_UNAVAILABLE"
      )
      expect(await state()).toBe(before)
      await updateAvatarFrame(connection.db, admin, frame.id, {
        expectedVersion: frame.version + 3,
        rarity: "R",
      })
      await updateShopChest(deps(), admin, f.chestId, {
        expectedVersion: q.expectedChestVersion,
        saleEnabled: false,
      })
      before = await state()
      await failure(
        rollShopGacha(deps(), actor, q, rng()),
        "GACHA_CHEST_CLOSED"
      )
      expect(await state()).toBe(before)
      await deleteFrameTopic(connection.db, admin, f.topic.id, f.topic.version)
      before = await state()
      await failure(rollShopGacha(deps(), actor, q, rng()), "NOT_FOUND")
      expect(await state()).toBe(before)
      expect(await pity(actor)).toBeUndefined()
    })

    test("duplicate refunds cannot fund insufficient debit; refund and sequence overflow roll back everything", async () => {
      const f = await fixture()
      for (const [amount, code] of [
        ["4", "COIN_INSUFFICIENT_BALANCE"],
        [String(MAX_COIN), "COIN_AMOUNT_OVERFLOW"],
      ] as const) {
        const actor = await account()
        await credit(actor, amount)
        await setFrameOwnership(
          connection.db,
          admin,
          actor,
          f.frames[2]!.id,
          true,
          "Fixture"
        )
        const before = await state()
        await failure(
          rollShopGacha(deps(), actor, await quote(f.chestId), rng("SSR")),
          code
        )
        expect(await state()).toBe(before)
      }
      const actor = await account()
      await credit(actor)
      await connection.db
        .insert(shopGachaState)
        .values({ userId: actor, rollCount: MAX_COIN })
      const before = await state()
      await failure(
        rollShopGacha(deps(), actor, await quote(f.chestId), rng()),
        "COIN_AMOUNT_OVERFLOW"
      )
      expect(await state()).toBe(before)
    })

    test("replay precedes live flags, pool/rule/ownership and keeps original result; payload conflict and restricted actor still fail", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      const receipt = await rollShopGacha(
        deps(),
        actor,
        {
          ...input,
          operationId: input.operationId.toUpperCase(),
          chestId: input.chestId.toUpperCase(),
        },
        rng("SSR")
      )
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        receipt.frame.id,
        false,
        "Fixture"
      )
      await deleteFrameTopic(connection.db, admin, f.topic.id, f.topic.version)
      const disabled = {
        ...deps(),
        coin: createCoinService(),
        gachaEnabled: false,
        avatarFramesEnabled: false,
        shopEnabled: false,
        assetBaseUrl: undefined,
      }
      // Replay must preserve the original balance, not today's wallet value.
      await credit(actor, "100")
      const before = await state()
      const noDraw = () => {
        throw new Error("Replay must never draw")
      }
      expect(await rollShopGacha(disabled, actor, input, noDraw)).toEqual(
        receipt
      )
      expect(await state()).toBe(before)
      await failure(
        rollShopGacha(
          disabled,
          actor,
          { ...input, expectedPrice: "6" },
          noDraw
        ),
        "GACHA_IDEMPOTENCY_CONFLICT"
      )
      expect(await state()).toBe(before)
      expect(
        (await ownership(actor, receipt.frame.id))!.revokedAt
      ).not.toBeNull()
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, actor))
      await failure(
        rollShopGacha(disabled, actor, input, noDraw),
        "ACCOUNT_RESTRICTED"
      )
      await connection.db
        .update(user)
        .set({ banned: false })
        .where(eq(user.id, actor))
      await connection.db
        .update(userProfile)
        .set({
          status: "suspended",
          moderatedAt: new Date(),
          moderationReason: "Fixture restriction",
        })
        .where(eq(userProfile.userId, actor))
      await failure(
        rollShopGacha(disabled, actor, input, noDraw),
        "ACCOUNT_RESTRICTED"
      )
    })

    test("ten/fifty pity is persisted across topic/common chests and duplicates, including early SSR", async () => {
      const actor = await account(),
        f = await fixture()
      await credit(actor)
      const [common] = await connection.db
        .select()
        .from(shopChest)
        .where(eq(shopChest.kind, "common"))
      if (!common!.saleEnabled)
        await updateShopChest(deps(), admin, common!.id, {
          expectedVersion: common!.version,
          saleEnabled: true,
        })
      let previous = { sinceSr: 0, sinceSsr: 0 }
      for (let i = 1; i <= 50; i++) {
        const chestId = i % 2 ? f.chestId : common!.id
        const receipt = await rollShopGacha(
          deps(),
          actor,
          await quote(chestId),
          rng()
        )
        expect(receipt.pity.before).toEqual(previous)
        expect(receipt.pity.rollSequence).toBe(String(i))
        expect(receipt.frame.rarity).toBe(
          i === 50 ? "SSR" : i % 10 === 0 ? "SR" : "R"
        )
        if (i % 2) expect(receipt.chest.topicId).toBe(f.topic.id)
        previous = receipt.pity.after
      }
      expect(await pity(actor)).toMatchObject({
        sinceSr: 0,
        sinceSsr: 0,
        rollCount: 50n,
      })
      await rollShopGacha(deps(), actor, await quote(f.chestId), rng())
      const early = await rollShopGacha(
        deps(),
        actor,
        await quote(f.chestId),
        rng("SSR")
      )
      expect(early.pity.after).toEqual({ sinceSr: 0, sinceSsr: 0 })
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .matches
      ).toBe(true)
    })

    test("faults at every write/deferred COMMIT leave no partial debit, grant, state, receipt or audit; same input resumes", async () => {
      const f = await fixture()
      const stages = [
        ["shop_gacha_state", "INSERT"],
        ["coin_operation", "INSERT"],
        ["coin_ledger", "INSERT"],
        ["coin_wallet", "UPDATE"],
        ["user_avatar_frame", "INSERT"],
        ["user_avatar_frame", "UPDATE"],
        ["coin_ledger", "REFUND"],
        ["shop_gacha_state", "UPDATE"],
        ["shop_gacha_roll", "INSERT"],
        ["moderation_action", "INSERT"],
        ["shop_gacha_roll", "DEFERRED"],
      ] as const
      for (const [table, event] of stages) {
        const actor = await account(),
          input = await quote(f.chestId)
        await credit(actor)
        if (
          (table === "user_avatar_frame" && event === "UPDATE") ||
          event === "REFUND"
        ) {
          await setFrameOwnership(
            connection.db,
            admin,
            actor,
            f.frames[2]!.id,
            true,
            "Fixture"
          )
          if (event === "UPDATE")
            await setFrameOwnership(
              connection.db,
              admin,
              actor,
              f.frames[2]!.id,
              false,
              "Fixture"
            )
        }
        const before = await state()
        await connection.db.execute(
          sql`CREATE FUNCTION gacha_roll_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$`
        )
        try {
          await connection.db.execute(
            sql.raw(
              event === "DEFERRED"
                ? `CREATE CONSTRAINT TRIGGER gacha_roll_test_failure AFTER INSERT ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gacha_roll_test_failure()`
                : `CREATE TRIGGER gacha_roll_test_failure BEFORE ${event === "REFUND" ? "INSERT" : event} ON ${table} FOR EACH ROW ${event === "REFUND" ? "WHEN (NEW.position = 1)" : ""} EXECUTE FUNCTION gacha_roll_test_failure()`
            )
          )
          await failure(
            rollShopGacha(deps(), actor, input, rng("SSR")),
            "P0001"
          )
          expect(await state()).toBe(before)
        } finally {
          await connection.db.execute(
            sql.raw(
              `DROP TRIGGER IF EXISTS gacha_roll_test_failure ON ${table}`
            )
          )
          await connection.db.execute(
            sql`DROP FUNCTION gacha_roll_test_failure()`
          )
        }
        const receipt = await rollShopGacha(deps(), actor, input, rng("SSR"))
        expect(receipt.balanceAfter).toBe(event === "REFUND" ? "1015" : "995")
        expect(await rollCount(actor)).toBe(1)
      }
    })

    test("same-key race draws once; different keys/chests serialize lazy user state without lost pity or grant", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      let draws = 0
      const counted = (max: number) => {
        if (max === 10_000) draws++
        return rng()(max)
      }
      const receipts = await Promise.all(
        Array.from({ length: 4 }, () =>
          rollShopGacha(deps(), actor, input, counted)
        )
      )
      for (const receipt of receipts) expect(receipt).toEqual(receipts[0]!)
      expect(draws).toBe(1)
      expect(await rollCount(actor)).toBe(1)
      expect(await pity(actor)).toMatchObject({
        sinceSr: 1,
        sinceSsr: 1,
        rollCount: 1n,
      })
      const second = await fixture(),
        q1 = await quote(f.chestId),
        q2 = await quote(second.chestId)
      const concurrent = await Promise.all([
        rollShopGacha(deps(), actor, q1, rng()),
        rollShopGacha(deps(), actor, q2, rng()),
      ])
      concurrent.sort(
        (a, b) => Number(a.pity.rollSequence) - Number(b.pity.rollSequence)
      )
      expect(concurrent.map((r) => r.pity.rollSequence)).toEqual(["2", "3"])
      expect(concurrent[0]!.pity.before).toEqual(receipts[0]!.pity.after)
      expect(concurrent[1]!.pity.before).toEqual(concurrent[0]!.pity.after)
      expect(await pity(actor)).toMatchObject({
        sinceSr: 3,
        sinceSsr: 3,
        rollCount: 3n,
      })
      const newActor = await account()
      await credit(newActor)
      const two = await Promise.all([
        rollShopGacha(deps(), newActor, await quote(f.chestId), rng()),
        rollShopGacha(deps(), newActor, await quote(f.chestId), rng()),
      ])
      expect(two.filter((r) => r.duplicate)).toHaveLength(1)
      expect(await pity(newActor)).toMatchObject({
        rollCount: 2n,
        sinceSr: 2,
        sinceSsr: 2,
      })
      expect(
        (
          await reconcileCoinWallet(connection.db, {
            kind: "user",
            id: newActor,
          })
        ).balance
      ).toBe("991")
    })

    test("lost commit ACK is recovered from persisted receipt by same-key retry with no draw or financial writes", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      const original = connection.db.transaction.bind(connection.db)
      const lostAck = {
        transaction: async (...args: Parameters<Database["transaction"]>) => {
          await original(...args)
          throw new Error("Lost COMMIT acknowledgement")
        },
      } as Database
      const error = await rollShopGacha(
        { ...deps(), database: lostAck },
        actor,
        input,
        rng()
      ).then(
        () => null,
        (error: unknown) => error
      )
      expect(error).toMatchObject({ message: "Lost COMMIT acknowledgement" })
      const before = await state()
      const receipt = await rollShopGacha(deps(), actor, input, () => {
        throw new Error("Retry must not draw")
      })
      expect(receipt).toMatchObject({
        balanceAfter: "995",
        pity: { rollSequence: "1" },
      })
      expect(await state()).toBe(before)
      expect(await rollCount(actor)).toBe(1)
      expect((await reconcileCoinDatabase(connection.db)).matches).toBe(true)
    })
  }
)
