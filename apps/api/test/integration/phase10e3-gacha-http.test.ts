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
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createApp } from "../../src/app"
import { createDatabase, type Database } from "../../src/db/client"
import {
  avatarFrame,
  shopChest,
  shopGachaState,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import type { Auth } from "../../src/features/account/auth"
import {
  deleteFrameTopic,
  saveFrameTopic,
  setFrameOwnership,
} from "../../src/features/avatar-frames/service"
import { MAX_COIN } from "../../src/features/coin/contract"
import { createCoinService } from "../../src/features/coin/service"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import {
  getShopChest,
  updateShopChest,
} from "../../src/features/shop/gacha-chests"
import {
  GachaHistorySchema,
  GachaReceiptSchema,
  PersonalShopChestSchema,
  ShopChestCatalogSchema,
  ShopChestDetailSchema,
  ShopChestPoolSchema,
  ShopChestSchema,
} from "../../src/features/shop/gacha-contract"
import type {
  GachaReceipt,
  GachaRollInput,
} from "../../src/features/shop/gacha-rolls"
import { NORMAL_GACHA_RULE } from "../../src/features/shop/gacha-policy"

setDefaultTimeout(60_000)
const base = "/v1/me/shop/gacha-rolls",
  publicBase = "/v1/shop/chests",
  adminBase = "/v1/admin/shop/chests"
const origin = "http://localhost:3000",
  extraOrigin = "https://sfw.example.com"
const coin = createCoinService({ enabled: true })
const enabled = { shop: true, coin: true, frames: true, gacha: true }
let connection: ReturnType<typeof createDatabase>,
  admin: string,
  sessionCalls = 0
let afterSession: (() => Promise<void>) | undefined
const revoked = new Set<string>()
const auth = {
  api: {
    getSession: async ({
      headers,
      query,
    }: {
      headers: Headers
      query?: { disableCookieCache?: boolean }
    }) => {
      sessionCalls++
      expect(query?.disableCookieCache).toBe(true)
      await afterSession?.()
      const id = headers.get("x-test-user")
      // Deliberately spoof session role: admin authorization must use the database.
      return id && !revoked.has(id) ? { user: { id, role: "admin" } } : null
    },
  },
} as unknown as Auth
const deps = () => ({
  database: connection.db,
  assetBaseUrl: "https://assets.example.com",
  shopEnabled: true,
  coinEnabled: true,
  avatarFramesEnabled: true,
  gachaEnabled: true,
})
function app(flags = enabled, database = connection.db, limited = false) {
  return createApp({
    auth,
    account: { database },
    catalog: { database, assetBaseUrl: deps().assetBaseUrl },
    coin: flags.coin ? coin : createCoinService(),
    shopEnabled: flags.shop,
    gachaEnabled: flags.gacha,
    avatarFramesEnabled: flags.frames,
    webOrigin: origin,
    allowedWebOrigins: [extraOrigin],
    production: true,
    logger: () => {},
    ...(limited ? { rateLimit: { internalApiKey: "fixture-service" } } : {}),
  })
}
async function account(role = "user") {
  const id = randomUUID()
  await connection.db.insert(user).values({
    id,
    role,
    name: "Gacha HTTP fixture",
    email: `${id}@example.com`,
  })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function fixture(open = true) {
  const topic = (
    await saveFrameTopic(connection.db, admin, {
      name: `HTTP game ${randomUUID()}`,
    })
  ).data
  const frames = await connection.db
    .insert(avatarFrame)
    .values(
      (["R", "SR", "SSR"] as const).map((rarity) => {
        const id = randomUUID()
        return {
          id,
          code: `http-${id}`,
          name: `Frame ${rarity}`,
          rarity,
          topicId: topic.id,
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
  if (open)
    await updateShopChest(deps(), admin, chest!.id, {
      expectedVersion: chest!.version,
      saleEnabled: true,
    })
  return { topic, chestId: chest!.id, frames }
}
async function quote(chestId: string): Promise<GachaRollInput> {
  const { data, rule } = await getShopChest(deps(), chestId)
  return {
    operationId: randomUUID(),
    chestId,
    expectedChestVersion: data.version,
    expectedRuleVersion: rule.version,
    expectedPoolDigest: data.pool.digest,
    expectedPrice: data.price,
  }
}
async function credit(actor: string, amount = "100") {
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `gacha-http:${randomUUID()}`,
      actorUserId: actor,
      sourceType: "fixture.credit",
      sourceId: randomUUID(),
      entries: [{ owner: { kind: "user", id: actor }, mode: "credit", amount }],
    })
  )
}
function request(
  actor: string | null,
  path: string,
  init: RequestInit = {},
  instance = app()
) {
  const headers = new Headers(init.headers)
  if (actor) headers.set("x-test-user", actor)
  return instance.request(path, { ...init, headers })
}
function mutation(
  actor: string | null,
  path: string,
  input: unknown,
  instance = app(),
  requestOrigin: string | null = origin
) {
  return request(
    actor,
    path,
    {
      method: path.startsWith(adminBase) ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(requestOrigin ? { Origin: requestOrigin } : {}),
      },
      body: JSON.stringify(input),
    },
    instance
  )
}
async function error(
  response: Response,
  status: number,
  code: string,
  publicRoute = false
) {
  expect(response.status).toBe(status)
  expect(response.headers.get("Cache-Control")).toBe(
    publicRoute ? "no-store" : "private, no-store"
  )
  const body = (await response.json()) as {
    error: { code: string; message: string; requestId: string }
  }
  expect(body.error.code).toBe(code)
  expect(body.error.requestId).toBe(response.headers.get("X-Request-ID")!)
  return body.error
}
async function receipt(response: Response): Promise<GachaReceipt> {
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  const body = (await response.json()) as { data: GachaReceipt }
  expect(Object.keys(body)).toEqual(["data"])
  expect(Object.keys(body.data).sort()).toEqual(
    Object.keys(GachaReceiptSchema.shape).sort()
  )
  return GachaReceiptSchema.parse(body.data)
}
async function personal(actor: string, chestId: string, instance = app()) {
  const response = await request(
    actor,
    `/v1/me/shop/chests/${chestId}`,
    {},
    instance
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  return PersonalShopChestSchema.parse(await response.json())
}
async function history(actor: string, query = "", instance = app()) {
  const response = await request(actor, `${base}${query}`, {}, instance)
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  return GachaHistorySchema.parse(await response.json())
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
    'chest', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM shop_chest c),
    'pity', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.user_id) FROM shop_gacha_state s),
    'receipt', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM shop_gacha_roll r),
    'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM moderation_action a)
  )::text AS state`)
  return result.rows[0]!.state
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.3F gacha HTTP/contract",
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

    test("guest catalog/detail/pool stay public, paginated and private-field free; reads never create wallet or pity", async () => {
      const actor = await account(),
        f = await fixture(false)
      const before = await state()
      const catalogResponse = await request(
        null,
        `${publicBase}?page=1&limit=100`
      )
      expect(catalogResponse.status).toBe(200)
      expect(catalogResponse.headers.get("Cache-Control")).toBe("no-store")
      const catalogRaw = await catalogResponse.json()
      const catalog = ShopChestCatalogSchema.parse(catalogRaw)
      const chest = catalog.data.find((c) => c.id === f.chestId)!
      expect(chest).toMatchObject({
        saleEnabled: false,
        ready: true,
        price: "5",
        pool: { R: 1, SR: 1, SSR: 1, total: 3 },
      })
      expect(catalog.rule).toEqual(NORMAL_GACHA_RULE)
      expect(catalog.rollEnabled).toBe(true)
      const detailResponse = await request(
        null,
        `${publicBase}/${f.chestId.toUpperCase()}`
      )
      expect(detailResponse.headers.get("Cache-Control")).toBe("no-store")
      expect(
        ShopChestDetailSchema.parse(await detailResponse.json()).data
      ).toEqual(chest)
      const poolResponse = await request(
        null,
        `${publicBase}/${f.chestId}/pool?rarity=SR&limit=1`
      )
      expect(poolResponse.headers.get("Cache-Control")).toBe("no-store")
      const poolRaw = await poolResponse.json(),
        pool = ShopChestPoolSchema.parse(poolRaw)
      expect(pool.meta).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 })
      expect(pool.data[0]).toMatchObject({
        rarity: "SR",
        topic: { id: f.topic.id, name: f.topic.name },
      })
      expect(pool.poolDigest).toBe(chest.pool.digest)
      expect(Object.keys(pool.data[0]!).sort()).toEqual([
        "code",
        "frame",
        "rarity",
        "topic",
      ])
      for (const field of [
        "balance",
        "pity",
        "owned",
        "stock",
        "actorUserId",
        "coinOperationKey",
      ])
        expect(JSON.stringify([catalogRaw, poolRaw])).not.toContain(
          `"${field}"`
        )
      expect(await personal(actor, f.chestId)).toMatchObject({
        balance: "0",
        pity: { sinceSr: 0, sinceSsr: 0, rollCount: "0" },
        canRoll: false,
        rollBlockReason: "chest_closed",
      })
      expect(await history(actor)).toEqual({
        data: [],
        meta: { limit: 20, nextCursor: null },
      })
      expect(await state()).toBe(before)
      for (const path of [
        `${publicBase}?limit=101`,
        `${publicBase}?owner=${actor}`,
        `${publicBase}/${f.chestId}/pool?rarity=limited`,
        `${publicBase}/${f.chestId}/pool?owned=true`,
        `${publicBase}/bad-id`,
      ])
        await error(await request(null, path), 400, "VALIDATION_ERROR", true)
      await error(
        await request(null, `${publicBase}/${randomUUID()}`),
        404,
        "NOT_FOUND",
        true
      )
      expect(await state()).toBe(before)
    })

    test("fresh auth, exact Origin, active database role/account and OPTIONS protect private/admin routes", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      const privatePaths = [
        `/v1/me/shop/chests/${f.chestId}`,
        base,
        `${base}/${input.operationId}`,
        adminBase,
      ]
      for (const path of privatePaths)
        await error(await request(null, path), 401, "UNAUTHORIZED")
      revoked.add(actor)
      await error(await mutation(actor, base, input), 401, "UNAUTHORIZED")
      revoked.delete(actor)
      for (const path of [base, `${adminBase}/${f.chestId}`]) {
        const beforeCalls = sessionCalls
        const response = await request(null, path, {
          method: "OPTIONS",
          headers: {
            Origin: extraOrigin,
            "Access-Control-Request-Method": path === base ? "POST" : "PATCH",
            "Access-Control-Request-Headers": "content-type",
          },
        })
        expect(response.status).toBe(204)
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
          extraOrigin
        )
        expect(sessionCalls).toBe(beforeCalls)
      }
      const before = await state()
      for (const invalid of [
        null,
        `${origin}/`,
        `${origin}.attacker.example`,
        "null",
      ])
        await error(
          await mutation(actor, base, input, app(), invalid),
          403,
          "INVALID_ORIGIN"
        )
      await error(
        await request(actor, `${adminBase}?limit=bad`),
        403,
        "FORBIDDEN"
      )
      await error(
        await mutation(actor, `${adminBase}/${f.chestId}`, {
          expectedVersion: 2,
          saleEnabled: false,
        }),
        403,
        "FORBIDDEN"
      )
      const bannedAdmin = await account("admin")
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, bannedAdmin))
      await error(await request(bannedAdmin, adminBase), 403, "FORBIDDEN")
      afterSession = async () => {
        afterSession = undefined
        await connection.db
          .update(userProfile)
          .set({
            status: "suspended",
            moderatedAt: new Date(),
            moderationReason: "HTTP fixture",
          })
          .where(eq(userProfile.userId, actor))
      }
      try {
        for (const path of privatePaths.slice(0, 3))
          await error(await request(actor, path), 403, "ACCOUNT_RESTRICTED")
        await error(
          await mutation(actor, base, input),
          403,
          "ACCOUNT_RESTRICTED"
        )
      } finally {
        afterSession = undefined
      }
      await error(await request(randomUUID(), base), 403, "ACCOUNT_RESTRICTED")
      expect(await state()).toBe(before)
    })

    test("strict input excludes actor/RNG/economy; JSON, bounds and 16 KiB body limits reject before writes", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      const before = await state()
      for (const field of [
        "actor",
        "userId",
        "seed",
        "rng",
        "rarity",
        "refund",
        "pity",
        "stock",
        "quantity",
      ])
        await error(
          await mutation(actor, base, { ...input, [field]: 1 }),
          400,
          "VALIDATION_ERROR"
        )
      for (const invalid of [
        {},
        [],
        { ...input, chestId: "bad" },
        { ...input, operationId: "bad" },
        { ...input, expectedPrice: 5 },
        { ...input, expectedPrice: "05" },
        { ...input, expectedPrice: (MAX_COIN + 1n).toString() },
        { ...input, expectedChestVersion: 0 },
        { ...input, expectedRuleVersion: 1.5 },
        { ...input, expectedPoolDigest: "A".repeat(64) },
      ])
        await error(
          await mutation(actor, base, invalid),
          400,
          "VALIDATION_ERROR"
        )
      for (const [body, type] of [
        ["{", "application/json"],
        [JSON.stringify(input), "text/plain"],
        [undefined, "application/json"],
      ])
        await error(
          await request(actor, base, {
            method: "POST",
            headers: { Origin: origin, "Content-Type": type! },
            body,
          }),
          400,
          "VALIDATION_ERROR"
        )
      for (const [who, path] of [
        [actor, base],
        [admin, `${adminBase}/${f.chestId}`],
      ] as const) {
        await error(
          await mutation(who, path, { ...input, padding: "a".repeat(16_384) }),
          413,
          "PAYLOAD_TOO_LARGE"
        )
        await error(
          await request(who, path, {
            method: path === base ? "POST" : "PATCH",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              "Content-Length": "20000",
            },
            body: "{}",
          }),
          413,
          "PAYLOAD_TOO_LARGE"
        )
      }
      expect(await state()).toBe(before)
    })

    test("new/random and same-key HTTP retries grant once; cross-actor receipts are indistinguishable from missing", async () => {
      const actor = await account(),
        other = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      const receipts = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          mutation(
            actor,
            base,
            i % 2
              ? {
                  ...input,
                  operationId: input.operationId.toUpperCase(),
                  chestId: input.chestId.toUpperCase(),
                }
              : input,
            app(),
            extraOrigin
          ).then(receipt)
        )
      )
      const original = receipts[0]!
      for (const result of receipts) expect(result).toEqual(original)
      expect(original).toMatchObject({
        duplicate: false,
        price: "5",
        refund: "0",
        refundLedgerId: null,
        balanceAfter: "95",
        sequence: "2",
        pity: { rollSequence: "1", before: { sinceSr: 0, sinceSsr: 0 } },
      })
      const owned = await connection.db
        .select()
        .from(userAvatarFrame)
        .where(eq(userAvatarFrame.userId, actor))
      expect(owned).toHaveLength(1)
      expect(owned[0]).toMatchObject({
        frameId: original.frame.id,
        source: "gacha",
        revokedAt: null,
      })
      const [profile] = await connection.db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, actor))
      expect(profile!.avatarFrameId).toBeNull()
      expect(
        await receipt(
          await request(actor, `${base}/${input.operationId.toUpperCase()}`)
        )
      ).toEqual(original)
      const before = await state()
      const missing = await error(
        await request(other, `${base}/${randomUUID()}`),
        404,
        "NOT_FOUND"
      )
      for (const who of [other, admin])
        expect(
          (
            await error(
              await request(who, `${base}/${input.operationId}`),
              404,
              "NOT_FOUND"
            )
          ).message
        ).toBe(missing.message)
      await error(
        await request(actor, `${base}/${original.id}`),
        404,
        "NOT_FOUND"
      )
      await error(
        await mutation(actor, base, { ...input, expectedPrice: "6" }),
        409,
        "GACHA_IDEMPOTENCY_CONFLICT"
      )
      expect((await history(other)).data).toEqual([])
      expect(await state()).toBe(before)
      expect(await personal(actor, f.chestId)).toMatchObject({
        balance: "95",
        canRoll: true,
        pity: { rollCount: "1", ...original.pity.after },
      })
      for (const field of [
        "actorUserId",
        "coinOperationKey",
        "fingerprint",
        "assetKey",
        "owned",
        "currentBalance",
        "ruleSnapshot",
      ])
        expect(JSON.stringify(original)).not.toContain(`"${field}"`)
    })

    test("hard SSR/duplicate refund and BIGINT projection are exact, stock untouched, history cursors use debit not roll sequence", async () => {
      const actor = await account(),
        f = await fixture()
      await credit(actor, "9007199254740993")
      for (const frame of f.frames)
        await setFrameOwnership(
          connection.db,
          admin,
          actor,
          frame.id,
          true,
          "HTTP fixture"
        )
      const ownedBefore = await connection.db
        .select()
        .from(userAvatarFrame)
        .where(eq(userAvatarFrame.userId, actor))
      // Isolated fixture starts at hard pity, without requiring 49 random HTTP calls.
      await connection.db
        .insert(shopGachaState)
        .values({ userId: actor, sinceSr: 9, sinceSsr: 49, rollCount: 49n })
      const values: GachaReceipt[] = []
      for (let i = 0; i < 3; i++) {
        values.push(
          await receipt(await mutation(actor, base, await quote(f.chestId)))
        )
        if (i < 2) await credit(actor, "1")
      }
      expect(values[0]).toMatchObject({
        duplicate: true,
        frame: { rarity: "SSR" },
        refund: "20",
        balanceAfter: "9007199254741008",
        sequence: "2",
        pity: {
          rollSequence: "50",
          before: { sinceSr: 9, sinceSsr: 49 },
          after: { sinceSr: 0, sinceSsr: 0 },
        },
      })
      expect(values[0]!.refundLedgerId).not.toBeNull()
      expect(
        await connection.db
          .select()
          .from(userAvatarFrame)
          .where(eq(userAvatarFrame.userId, actor))
      ).toEqual(ownedBefore)
      const page = await history(actor, "?limit=2")
      expect(page).toEqual({
        data: [values[2], values[1]],
        meta: { limit: 2, nextCursor: values[1]!.sequence },
      })
      const latest = await receipt(
        await mutation(actor, base, await quote(f.chestId))
      )
      expect(
        await history(actor, `?limit=2&cursor=${page.meta.nextCursor}`)
      ).toEqual({ data: [values[0]], meta: { limit: 2, nextCursor: null } })
      expect((await history(actor)).data).toEqual([
        latest,
        values[2]!,
        values[1]!,
        values[0]!,
      ])
      expect(
        (await history(actor, `?limit=1&cursor=${MAX_COIN}`)).data
      ).toEqual([latest])
      expect((await personal(actor, f.chestId)).balance).toBe(
        latest.balanceAfter
      )
      const before = await state()
      for (const query of [
        "limit=0",
        "limit=101",
        "limit=1.5",
        "cursor=0",
        "cursor=-1",
        "cursor=01",
        "cursor=1.5",
        `cursor=${MAX_COIN + 1n}`,
        `userId=${admin}`,
        "walletId=forged",
      ])
        await error(
          await request(actor, `${base}?${query}`),
          400,
          "VALIDATION_ERROR"
        )
      await error(
        await request(actor, `${base}/bad-id`),
        400,
        "VALIDATION_ERROR"
      )
      expect(await state()).toBe(before)
      const framesAfter = await connection.db
        .select()
        .from(avatarFrame)
        .where(eq(avatarFrame.topicId, f.topic.id))
      expect(
        framesAfter.every(
          (row) =>
            row.shopStock === 0 &&
            row.shopPrice === null &&
            row.shopVersion === 1
        )
      ).toBe(true)
    })

    test("flags block only new rolls; replay/history survive revoke, later balance and retired chest", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      const original = await receipt(await mutation(actor, base, input))
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        original.frame.id,
        false,
        "HTTP fixture"
      )
      await credit(actor)
      const before = await state()
      for (const [flags, status, code, reason] of [
        [{ ...enabled, shop: false }, 503, "SHOP_DISABLED", "shop_disabled"],
        [{ ...enabled, coin: false }, 503, "COIN_DISABLED", "coin_disabled"],
        [
          { ...enabled, frames: false },
          403,
          "AVATAR_FRAMES_DISABLED",
          "avatar_frames_disabled",
        ],
        [{ ...enabled, gacha: false }, 503, "GACHA_DISABLED", "gacha_disabled"],
      ] as const) {
        const disabled = app(flags)
        expect(await personal(actor, f.chestId, disabled)).toMatchObject({
          balance: "195",
          rollEnabled: false,
          canRoll: false,
          rollBlockReason: reason,
        })
        await error(
          await mutation(
            actor,
            base,
            { ...input, operationId: randomUUID() },
            disabled
          ),
          status,
          code
        )
        expect(
          await receipt(await mutation(actor, base, input, disabled))
        ).toEqual(original)
        expect(
          await receipt(
            await request(actor, `${base}/${input.operationId}`, {}, disabled)
          )
        ).toEqual(original)
        expect((await history(actor, "", disabled)).data).toEqual([original])
      }
      expect(await state()).toBe(before)
      await deleteFrameTopic(connection.db, admin, f.topic.id, f.topic.version)
      const retired = await state(),
        disabled = app({
          shop: false,
          coin: false,
          frames: false,
          gacha: false,
        })
      await error(
        await request(null, `${publicBase}/${f.chestId}`),
        404,
        "NOT_FOUND",
        true
      )
      await error(
        await request(null, `${publicBase}/${f.chestId}/pool`),
        404,
        "NOT_FOUND",
        true
      )
      await error(
        await request(actor, `/v1/me/shop/chests/${f.chestId}`),
        404,
        "NOT_FOUND"
      )
      expect(
        await receipt(await mutation(actor, base, input, disabled))
      ).toEqual(original)
      expect((await history(actor, "", disabled)).data).toEqual([original])
      expect(await state()).toBe(retired)
    })

    test("stale quotes/closed/missing pool/insufficient coin fail atomically and personal readiness exposes the block", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      const before = await state()
      for (const patch of [
        { expectedChestVersion: 99 },
        { expectedRuleVersion: 2 },
        { expectedPoolDigest: "0".repeat(64) },
        { expectedPrice: "4" },
      ])
        await error(
          await mutation(actor, base, { ...input, ...patch }),
          409,
          "GACHA_QUOTE_CHANGED"
        )
      await error(
        await mutation(actor, base, { ...input, chestId: randomUUID() }),
        404,
        "NOT_FOUND"
      )
      const empty = await account()
      expect(await personal(empty, f.chestId)).toMatchObject({
        balance: "0",
        canRoll: false,
        rollBlockReason: "insufficient_coin",
      })
      await error(
        await mutation(empty, base, input),
        409,
        "COIN_INSUFFICIENT_BALANCE"
      )
      expect(await state()).toBe(before)
      await connection.db
        .update(avatarFrame)
        .set({ active: false })
        .where(
          eq(avatarFrame.id, f.frames.find((row) => row.rarity === "R")!.id)
        )
      expect(await personal(actor, f.chestId)).toMatchObject({
        canRoll: false,
        rollBlockReason: "pool_unavailable",
        data: { ready: false },
      })
      const unavailable = await state()
      await error(
        await mutation(actor, base, input),
        409,
        "GACHA_POOL_UNAVAILABLE"
      )
      expect(await state()).toBe(unavailable)
      await updateShopChest(deps(), admin, f.chestId, {
        expectedVersion: input.expectedChestVersion,
        saleEnabled: false,
      })
      expect(await personal(actor, f.chestId)).toMatchObject({
        canRoll: false,
        rollBlockReason: "chest_closed",
      })
      await error(
        await mutation(actor, base, await quote(f.chestId)),
        409,
        "GACHA_CHEST_CLOSED"
      )
      const capped = await account()
      await credit(capped)
      const valid = await fixture()
      await connection.db
        .insert(shopGachaState)
        .values({ userId: capped, rollCount: MAX_COIN })
      expect(await personal(capped, valid.chestId)).toMatchObject({
        canRoll: false,
        rollBlockReason: "sequence_limit",
        pity: { rollCount: MAX_COIN.toString() },
      })
      await error(
        await mutation(capped, base, await quote(valid.chestId)),
        409,
        "COIN_AMOUNT_OVERFLOW"
      )
    })

    test("admin HTTP opens/closes with revision/audit, no-op stays unchanged; incomplete and retired chests cannot open", async () => {
      const f = await fixture(false),
        path = `${adminBase}/${f.chestId}`
      for (const invalidOrigin of [null, "https://attacker.example"])
        await error(
          await mutation(
            admin,
            path,
            { expectedVersion: 1, saleEnabled: true },
            app(),
            invalidOrigin
          ),
          403,
          "INVALID_ORIGIN"
        )
      for (const patch of [
        { price: "1" },
        { rates: { SSR: 10000 } },
        { pool: [] },
        { actor: admin },
      ])
        await error(
          await mutation(admin, path, {
            expectedVersion: 1,
            saleEnabled: true,
            ...patch,
          }),
          400,
          "VALIDATION_ERROR"
        )
      await error(
        await mutation(admin, path, { expectedVersion: 0, saleEnabled: true }),
        400,
        "VALIDATION_ERROR"
      )
      await error(
        await request(admin, `${adminBase}?limit=101`),
        400,
        "VALIDATION_ERROR"
      )
      const response = await mutation(admin, path, {
        expectedVersion: 1,
        saleEnabled: true,
      })
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      expect(
        ShopChestSchema.parse(
          ((await response.json()) as { data: unknown }).data
        )
      ).toMatchObject({ version: 2, saleEnabled: true })
      const before = await state()
      expect(
        (await mutation(admin, path, { expectedVersion: 2, saleEnabled: true }))
          .status
      ).toBe(200)
      await error(
        await mutation(admin, path, { expectedVersion: 1, saleEnabled: false }),
        409,
        "GACHA_VERSION_CONFLICT"
      )
      expect(await state()).toBe(before)
      expect(
        (
          await mutation(admin, path, {
            expectedVersion: 2,
            saleEnabled: false,
          })
        ).status
      ).toBe(200)
      await connection.db
        .update(avatarFrame)
        .set({ active: false })
        .where(eq(avatarFrame.id, f.frames[0]!.id))
      await error(
        await mutation(admin, path, { expectedVersion: 3, saleEnabled: true }),
        409,
        "GACHA_POOL_UNAVAILABLE"
      )
      await deleteFrameTopic(connection.db, admin, f.topic.id, f.topic.version)
      await error(
        await mutation(admin, path, { expectedVersion: 4, saleEnabled: true }),
        404,
        "NOT_FOUND"
      )
      const listing = await request(admin, `${adminBase}?limit=100`)
      expect(listing.headers.get("Cache-Control")).toBe("private, no-store")
      const catalog = ShopChestCatalogSchema.parse(await listing.json())
      expect(catalog.data.find((row) => row.id === f.chestId)).toMatchObject({
        retiredAt: expect.any(String),
        topic: { id: null, name: f.topic.name },
        ready: false,
        blockReason: "retired",
      })
      const publicListing = ShopChestCatalogSchema.parse(
        await (await request(null, `${publicBase}?limit=100`)).json()
      )
      expect(publicListing.data.some((row) => row.id === f.chestId)).toBe(false)
    })

    test("early limiter errors stay no-store; service key does not bypass Shop/private/admin and preflight consumes no bucket", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      for (const [who, path, isPublic] of [
        [null, `${publicBase}?limit=bad`, true],
        [actor, `${base}?limit=bad`, false],
        [admin, `${adminBase}?limit=bad`, false],
      ] as const) {
        const instance = app(enabled, connection.db, true)
        const init = { headers: { "x-internal-api-key": "fixture-service" } }
        const before = await state()
        for (let i = 0; i < 10; i++)
          await error(
            await request(who, path, init, instance),
            400,
            "VALIDATION_ERROR",
            isPublic
          )
        await error(
          await request(who, path, init, instance),
          429,
          "RATE_LIMITED",
          isPublic
        )
        const preflight = await request(
          null,
          base,
          {
            method: "OPTIONS",
            headers: {
              Origin: origin,
              "Access-Control-Request-Method": "POST",
            },
          },
          instance
        )
        expect(preflight.status).toBe(204)
        if (path.startsWith(adminBase)) {
          // Admin GET has its own bucket; mutations still use the public bucket.
          await error(
            await mutation(actor, base, { ...input, seed: 1 }, instance),
            400,
            "VALIDATION_ERROR"
          )
        } else
          await error(
            await mutation(actor, base, input, instance),
            429,
            "RATE_LIMITED"
          )
        expect(await state()).toBe(before)
      }
    })

    test("sanitized runtime errors and a lost real COMMIT ACK are recovered with original receipt, never a second draw", async () => {
      const actor = await account(),
        f = await fixture(),
        input = await quote(f.chestId)
      await credit(actor)
      const failed = new Proxy(connection.db, {
        get(target, property, receiver) {
          if (property !== "transaction")
            return Reflect.get(target, property, receiver)
          return async () => {
            throw new Error(
              "SQL secret postgres://fixture:password@example.invalid"
            )
          }
        },
      })
      const before = await state(),
        unavailable = app(enabled, failed)
      for (const [who, path, isPublic] of [
        [null, publicBase, true],
        [actor, base, false],
        [actor, `/v1/me/shop/chests/${f.chestId}`, false],
        [admin, adminBase, false],
      ] as const) {
        const body = await error(
          await request(who, path, {}, unavailable),
          503,
          "SERVICE_UNAVAILABLE",
          isPublic
        )
        expect(body.message).toContain("same operation ID")
        expect(JSON.stringify(body)).not.toMatch(/SQL|password/)
      }
      expect(await state()).toBe(before)
      const lostAck = new Proxy(connection.db, {
        get(target, property, receiver) {
          if (property !== "transaction")
            return Reflect.get(target, property, receiver)
          return async (run: Parameters<Database["transaction"]>[0]) => {
            await target.transaction(run)
            throw new Error("Simulated lost acknowledgement")
          }
        },
      })
      await error(
        await mutation(actor, base, input, app(enabled, lostAck)),
        503,
        "SERVICE_UNAVAILABLE"
      )
      const committed = await state(),
        recovered = await receipt(
          await request(actor, `${base}/${input.operationId}`)
        )
      expect(recovered.balanceAfter).toBe("95")
      expect(await receipt(await mutation(actor, base, input))).toEqual(
        recovered
      )
      expect(await state()).toBe(committed)
      expect((await reconcileCoinDatabase(connection.db)).matches).toBe(true)
    })
  }
)
