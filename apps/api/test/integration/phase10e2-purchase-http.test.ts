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
import { createApp } from "../../src/app"
import { createDatabase, type Database } from "../../src/db/client"
import {
  avatarFrame,
  shopPurchase,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import type { Auth } from "../../src/features/account/auth"
import {
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
} from "../../src/features/avatar-frames/service"
import { MAX_COIN } from "../../src/features/coin/contract"
import {
  createCoinService,
  reconcileCoinWallet,
} from "../../src/features/coin/service"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import {
  ShopPurchaseHistorySchema,
  ShopPurchaseReceiptSchema,
  type ShopPurchaseInput,
  type ShopPurchaseReceipt,
} from "../../src/features/shop/contract"

setDefaultTimeout(60_000)
const base = "/v1/me/shop/purchases"
const origin = "http://localhost:3000"
const extraOrigin = "https://sfw.example.com"
const coin = createCoinService({ enabled: true })
const revokedSessions = new Set<string>()
let connection: ReturnType<typeof createDatabase>
let admin: string
let sessionCalls = 0
let freshSession = false
let afterSession: (() => Promise<void>) | undefined
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
      freshSession = query?.disableCookieCache === true
      const id = headers.get("x-test-user")
      await afterSession?.()
      return id && !(freshSession && revokedSessions.has(id))
        ? { user: { id, role: "admin" } }
        : null
    },
  },
} as unknown as Auth
function app(
  flags = { shop: true, coin: true, frames: true },
  database = connection.db
) {
  return createApp({
    auth,
    account: { database },
    catalog: { database, assetBaseUrl: "https://assets.example.com" },
    coin: flags.coin ? coin : createCoinService(),
    shopEnabled: flags.shop,
    avatarFramesEnabled: flags.frames,
    webOrigin: origin,
    allowedWebOrigins: [extraOrigin],
    production: true,
    logger: () => {},
  })
}
async function account(role = "user") {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, role, name: "Shop HTTP fixture", email: `${id}@example.com` })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function frame(patch: Partial<typeof avatarFrame.$inferInsert> = {}) {
  const id = randomUUID()
  const [row] = await connection.db
    .insert(avatarFrame)
    .values({
      id,
      code: `http-${id}`,
      name: `HTTP ${id}`,
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
async function credit(actor: string, amount = "100") {
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `shop-http-fixture:${randomUUID()}`,
      actorUserId: actor,
      sourceType: "fixture.credit",
      sourceId: randomUUID(),
      entries: [{ owner: { kind: "user", id: actor }, mode: "credit", amount }],
    })
  )
}
function request(
  actor: string | null,
  path = base,
  init: RequestInit = {},
  instance = app()
) {
  const headers = new Headers(init.headers)
  if (actor) headers.set("x-test-user", actor)
  return instance.request(path, { ...init, headers })
}
function post(
  actor: string | null,
  input: unknown,
  instance = app(),
  requestOrigin: string | null = origin
) {
  return request(
    actor,
    base,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(requestOrigin ? { Origin: requestOrigin } : {}),
      },
      body: JSON.stringify(input),
    },
    instance
  )
}
async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  const body = (await response.json()) as {
    error: { code: string; requestId: string; message: string }
  }
  expect(body.error.code).toBe(code)
  expect(body.error.requestId).toBe(response.headers.get("X-Request-ID")!)
  return body.error
}
async function receipt(response: Response): Promise<ShopPurchaseReceipt> {
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  const body = (await response.json()) as { data: ShopPurchaseReceipt }
  expect(Object.keys(body)).toEqual(["data"])
  return ShopPurchaseReceiptSchema.parse(body.data)
}
async function history(response: Response) {
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  return ShopPurchaseHistorySchema.parse(await response.json())
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
    'purchase', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM shop_purchase p),
    'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM moderation_action a)
  )::text AS state`)
  return result.rows[0]!.state
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.2E private purchase HTTP",
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

    test("guest/revoked sessions are rejected freshly, OPTIONS bypasses private guards and all responses are no-store", async () => {
      const actor = await account()
      const input = quote(await frame())
      for (const actorId of [null, actor]) {
        if (actorId) revokedSessions.add(actorId)
        await error(await post(actorId, input), 401, "UNAUTHORIZED")
        await error(await request(actorId), 401, "UNAUTHORIZED")
        await error(
          await request(actorId, `${base}/${input.operationId}`),
          401,
          "UNAUTHORIZED"
        )
      }
      expect(freshSession).toBe(true)
      revokedSessions.delete(actor)
      const instance = app()
      const calls = sessionCalls
      const options = await instance.request(base, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      })
      expect(options.status).toBe(204)
      expect(options.headers.get("Access-Control-Allow-Origin")).toBe(origin)
      expect(options.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true"
      )
      expect(options.headers.get("Cache-Control")).toBe("private, no-store")
      expect(sessionCalls).toBe(calls)
      expect(await history(await request(actor))).toEqual({
        data: [],
        meta: { limit: 20, nextCursor: null },
      })
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .walletId
      ).toBeNull()
    })

    test("trusted origins are exact; authenticated users buy without admin rights, not from an arbitrary owner or group wallet", async () => {
      const actor = await account()
      await credit(actor)
      const row = await frame()
      const input = quote(row)
      const before = await state()
      for (const untrusted of [
        null,
        `${origin}/`,
        `${origin}.attacker.example`,
        "https://untrusted.example",
      ])
        await error(
          await post(actor, input, app(), untrusted),
          403,
          "INVALID_ORIGIN"
        )
      for (const key of [
        "userId",
        "owner",
        "walletId",
        "groupId",
        "quantity",
        "stock",
        "source",
        "assetKey",
        "refund",
      ])
        await error(
          await post(actor, { ...input, [key]: "forged" }),
          400,
          "VALIDATION_ERROR"
        )
      expect(await state()).toBe(before)
      expect((await receipt(await post(actor, input))).balanceAfter).toBe("85")
      expect(
        (
          await receipt(
            await post(actor, quote(await frame()), app(), extraOrigin)
          )
        ).balanceAfter
      ).toBe("70")
    })

    test("invalid JSON/content type, missing fields, UUID/price/version and oversized streamed/declared bodies fail before writes", async () => {
      const actor = await account()
      const input = quote(await frame())
      const before = await state()
      for (const invalid of [
        {},
        [],
        { ...input, operationId: "bad" },
        { ...input, frameId: "bad" },
        { ...input, expectedPrice: 15 },
        { ...input, expectedPrice: "1.5" },
        { ...input, expectedPrice: (MAX_COIN + 1n).toString() },
        { ...input, expectedFrameVersion: 0 },
        { ...input, expectedFrameVersion: 1.5 },
        { ...input, expectedFrameVersion: 2_147_483_648 },
      ])
        await error(await post(actor, invalid), 400, "VALIDATION_ERROR")
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
      await error(
        await post(actor, { ...input, padding: "a".repeat(16_384) }),
        413,
        "PAYLOAD_TOO_LARGE"
      )
      await error(
        await request(actor, base, {
          method: "POST",
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
      expect(await state()).toBe(before)
    })

    test("purchase and same-key concurrent HTTP retries return one canonical receipt and existing inventory/equip stay compatible", async () => {
      const actor = await account()
      const row = await frame()
      await credit(actor)
      const input = quote(row)
      const receipts = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          post(
            actor,
            i % 2
              ? {
                  ...input,
                  frameId: input.frameId.toUpperCase(),
                  operationId: input.operationId.toUpperCase(),
                }
              : input
          ).then(receipt)
        )
      )
      for (const value of receipts) expect(value).toEqual(receipts[0])
      const original = receipts[0]!
      expect(original).toMatchObject({
        price: "15",
        sequence: "2",
        balanceAfter: "85",
      })
      expect(
        await receipt(
          await request(actor, `${base}/${input.operationId.toUpperCase()}`)
        )
      ).toEqual(original)
      const purchases = await connection.db
        .select()
        .from(shopPurchase)
        .where(eq(shopPurchase.actorUserId, actor))
      expect(purchases).toHaveLength(1)
      const inventory = await request(actor, "/v1/me/avatar-frames")
      expect(inventory.status).toBe(200)
      const owned = (await inventory.json()) as {
        data: Array<{ frame: { id: string }; selected: boolean }>
        selectedFrameId: string | null
      }
      expect(owned.data).toHaveLength(1)
      expect(owned.data[0]).toMatchObject({
        frame: { id: row.id },
        selected: false,
      })
      expect(owned.selectedFrameId).toBeNull()
      expect(
        (
          await request(actor, "/v1/me/avatar-frame", {
            method: "PUT",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({ frameId: row.id }),
          })
        ).status
      ).toBe(200)
      const before = await state()
      await error(
        await post(actor, { ...input, expectedPrice: "16" }),
        409,
        "SHOP_IDEMPOTENCY_CONFLICT"
      )
      await error(
        await post(actor, { ...input, operationId: randomUUID() }),
        409,
        "SHOP_ALREADY_OWNED"
      )
      expect(await state()).toBe(before)
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .matches
      ).toBe(true)
    })

    test("history uses bounded personal debit sequence cursors, excludes other coin events and stays stable when new purchases arrive", async () => {
      const actor = await account()
      const other = await account()
      await credit(actor, "200")
      await credit(other)
      const values: ShopPurchaseReceipt[] = []
      for (let i = 0; i < 3; i++) {
        values.push(await receipt(await post(actor, quote(await frame()))))
        if (i < 2) await credit(actor, "1")
      }
      await receipt(await post(other, quote(await frame())))
      const page = await history(await request(actor, `${base}?limit=2`))
      expect(page).toEqual({
        data: [values[2], values[1]],
        meta: { limit: 2, nextCursor: "4" },
      })
      const latest = await receipt(await post(actor, quote(await frame())))
      const tail = await history(
        await request(actor, `${base}?limit=2&cursor=${page.meta.nextCursor}`)
      )
      expect(tail).toEqual({
        data: [values[0]],
        meta: { limit: 2, nextCursor: null },
      })
      expect((await history(await request(actor))).data).toEqual([
        latest,
        values[2]!,
        values[1]!,
        values[0]!,
      ])
      expect(await history(await request(actor, `${base}?cursor=1`))).toEqual({
        data: [],
        meta: { limit: 20, nextCursor: null },
      })
      expect(
        (
          await history(
            await request(actor, `${base}?limit=1&cursor=${MAX_COIN}`)
          )
        ).data
      ).toEqual([latest])
      const before = await state()
      for (const query of [
        "limit=0",
        "limit=101",
        "limit=1.5",
        "cursor=0",
        "cursor=-1",
        "cursor=1.5",
        "cursor=01",
        `cursor=${MAX_COIN + 1n}`,
        `userId=${other}`,
        "walletId=forged",
      ])
        await error(
          await request(actor, `${base}?${query}`),
          400,
          "VALIDATION_ERROR"
        )
      await error(
        await request(actor, `${base}/not-a-uuid`),
        400,
        "VALIDATION_ERROR"
      )
      expect(await state()).toBe(before)
    })

    test("receipt is scoped to actor plus operation ID; another user or admin cannot read it or select an arbitrary wallet", async () => {
      const actor = await account()
      const other = await account()
      await credit(actor)
      await credit(other)
      const input = quote(await frame())
      const original = await receipt(await post(actor, input))
      const missing = await error(
        await request(other, `${base}/${randomUUID()}`),
        404,
        "NOT_FOUND"
      )
      const foreign = await error(
        await request(other, `${base}/${input.operationId}`),
        404,
        "NOT_FOUND"
      )
      expect(foreign.message).toBe(missing.message)
      await error(
        await request(admin, `${base}/${input.operationId}`),
        404,
        "NOT_FOUND"
      )
      await error(
        await request(actor, `${base}/${original.id}`),
        404,
        "NOT_FOUND"
      )
      expect((await history(await request(other))).data).toEqual([])
      const before = await state()
      await error(
        await post(other, { ...input, userId: actor }),
        400,
        "VALIDATION_ERROR"
      )
      expect(await state()).toBe(before)
      const own = await receipt(await post(other, input))
      expect(own.id).not.toBe(original.id)
      expect(
        await receipt(await request(other, `${base}/${input.operationId}`))
      ).toEqual(own)
      expect(
        await receipt(await request(actor, `${base}/${input.operationId}`))
      ).toEqual(original)
      const serialized = JSON.stringify(original)
      for (const privateField of [
        "actorUserId",
        "coinOperationKey",
        "fingerprint",
        "assetKey",
        "assetUrl",
        "owned",
        "currentBalance",
      ])
        expect(serialized).not.toContain(`"${privateField}"`)
    })

    test("flags/disabled frames/revocation preserve history and original snapshots; replay never re-grants or returns current balance", async () => {
      const actor = await account()
      const row = await frame()
      const input = quote(row)
      await credit(actor)
      const original = await receipt(await post(actor, input))
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        row.id,
        false,
        "HTTP fixture revoke"
      )
      await credit(actor)
      await updateAvatarFrameShop(connection.db, admin, row.id, {
        expectedVersion: 1,
        expectedShopVersion: 2,
        price: "20",
        stock: 0,
      })
      await updateAvatarFrame(connection.db, admin, row.id, {
        expectedVersion: 2,
        name: "Later name",
        active: false,
      })
      const before = await state()
      for (const flags of [
        { shop: false, coin: true, frames: true },
        { shop: true, coin: false, frames: true },
        { shop: true, coin: true, frames: false },
        { shop: false, coin: false, frames: false },
      ]) {
        const disabled = app(flags)
        expect(
          await receipt(
            await request(actor, `${base}/${input.operationId}`, {}, disabled)
          )
        ).toEqual(original)
        expect(
          (await history(await request(actor, base, {}, disabled))).data
        ).toEqual([original])
        expect(await receipt(await post(actor, input, disabled))).toEqual(
          original
        )
        await error(
          await post(actor, { ...input, operationId: randomUUID() }, disabled),
          flags.shop ? (flags.coin ? 403 : 503) : 503,
          !flags.shop
            ? "SHOP_DISABLED"
            : !flags.coin
              ? "COIN_DISABLED"
              : "AVATAR_FRAMES_DISABLED"
        )
        await error(
          await post(actor, { ...input, expectedPrice: "20" }, disabled),
          409,
          "SHOP_IDEMPOTENCY_CONFLICT"
        )
      }
      expect(await state()).toBe(before)
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: actor }))
          .balance
      ).toBe("185")
      const [owned] = await connection.db
        .select()
        .from(userAvatarFrame)
        .where(
          and(
            eq(userAvatarFrame.userId, actor),
            eq(userAvatarFrame.frameId, row.id)
          )
        )
      expect(owned!.revokedAt).not.toBeNull()
    })

    test("new HTTP purchases expose domain failures without partial writes; BIGINT receipts are exact", async () => {
      const actor = await account()
      await credit(actor)
      const cases = [
        [await frame({ shopStock: 0 }), "SHOP_SOLD_OUT", 409],
        [await frame({ active: false }), "SHOP_FRAME_UNAVAILABLE", 409],
        [
          await frame({ rarity: "SSR", limited: true }),
          "LIMITED_FRAME_PROTECTED",
          403,
        ],
        [await frame({ shopPrice: null }), "SHOP_FRAME_UNAVAILABLE", 409],
        [
          await frame({ assetKey: "../outside.webp" }),
          "SHOP_FRAME_UNAVAILABLE",
          409,
        ],
      ] as const
      const row = await frame()
      const before = await state()
      for (const [item, code, status] of cases)
        await error(await post(actor, quote(item)), status, code)
      await error(
        await post(actor, { ...quote(row), frameId: randomUUID() }),
        404,
        "NOT_FOUND"
      )
      await error(
        await post(actor, { ...quote(row), expectedPrice: "14" }),
        409,
        "SHOP_QUOTE_CHANGED"
      )
      await error(
        await post(actor, { ...quote(row), expectedFrameVersion: 2 }),
        409,
        "SHOP_QUOTE_CHANGED"
      )
      expect(await state()).toBe(before)
      const empty = await account()
      const lazyBefore = await state()
      await error(
        await post(empty, quote(row)),
        409,
        "COIN_INSUFFICIENT_BALANCE"
      )
      expect(await state()).toBe(lazyBefore)
      expect(
        (await reconcileCoinWallet(connection.db, { kind: "user", id: empty }))
          .walletId
      ).toBeNull()
      const bigActor = await account()
      const big = await frame({ shopPrice: 9_007_199_254_740_993n })
      await credit(bigActor, MAX_COIN.toString())
      const bought = await receipt(await post(bigActor, quote(big)))
      expect(bought.price).toBe("9007199254740993")
      expect(bought.balanceAfter).toBe(
        String(MAX_COIN - 9_007_199_254_740_993n)
      )
      expect(
        await receipt(await request(bigActor, `${base}/${bought.operationId}`))
      ).toEqual(bought)
    })

    test("DB/runtime failures are sanitized 503 and a lost acknowledgement after real COMMIT is recoverable over HTTP", async () => {
      const actor = await account()
      await credit(actor)
      const input = quote(await frame())
      const failedDatabase = new Proxy(connection.db, {
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
      const before = await state()
      const unavailable = app(undefined, failedDatabase)
      for (const response of [
        await post(actor, input, unavailable),
        await request(actor, base, {}, unavailable),
        await request(actor, `${base}/${input.operationId}`, {}, unavailable),
      ]) {
        const body = await error(response, 503, "SERVICE_UNAVAILABLE")
        expect(body.message).toContain("same operation ID")
        expect(JSON.stringify(body)).not.toContain("password")
        expect(JSON.stringify(body)).not.toContain("SQL")
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
        await post(actor, input, app(undefined, lostAck)),
        503,
        "SERVICE_UNAVAILABLE"
      )
      const committed = await state()
      const recovered = await receipt(
        await request(actor, `${base}/${input.operationId}`)
      )
      expect(recovered.balanceAfter).toBe("85")
      expect(await receipt(await post(actor, input))).toEqual(recovered)
      expect(await state()).toBe(committed)
    })

    test("audit failure rolls back the HTTP transaction; same-key retry after recovery succeeds", async () => {
      const actor = await account()
      await credit(actor)
      const input = quote(await frame())
      const before = await state()
      await connection.db.execute(
        sql`CREATE FUNCTION shop_http_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected SQL failure'; END $$`
      )
      try {
        await connection.db.execute(
          sql`CREATE TRIGGER shop_http_test_failure BEFORE INSERT ON moderation_action FOR EACH ROW EXECUTE FUNCTION shop_http_test_failure()`
        )
        await error(await post(actor, input), 503, "SERVICE_UNAVAILABLE")
        expect(await state()).toBe(before)
        await error(
          await request(actor, `${base}/${input.operationId}`),
          404,
          "NOT_FOUND"
        )
      } finally {
        await connection.db.execute(
          sql`DROP TRIGGER IF EXISTS shop_http_test_failure ON moderation_action`
        )
        await connection.db.execute(sql`DROP FUNCTION shop_http_test_failure()`)
      }
      expect((await receipt(await post(actor, input))).balanceAfter).toBe("85")
    })

    test("active account is checked inside transactions despite a fresh-looking session, including feature-off history and replay", async () => {
      const actor = await account()
      await credit(actor)
      const input = quote(await frame())
      await receipt(await post(actor, input))
      afterSession = async () => {
        afterSession = undefined
        await connection.db
          .update(userProfile)
          .set({
            status: "suspended",
            moderatedAt: new Date(),
            moderationReason: "HTTP fixture restriction",
          })
          .where(eq(userProfile.userId, actor))
      }
      try {
        const before = await state()
        for (const instance of [
          app(),
          app({ shop: false, coin: false, frames: false }),
        ]) {
          await error(
            await post(actor, input, instance),
            403,
            "ACCOUNT_RESTRICTED"
          )
          await error(
            await request(actor, base, {}, instance),
            403,
            "ACCOUNT_RESTRICTED"
          )
          await error(
            await request(actor, `${base}/${input.operationId}`, {}, instance),
            403,
            "ACCOUNT_RESTRICTED"
          )
        }
        expect(await state()).toBe(before)
      } finally {
        afterSession = undefined
      }
      const banned = await account()
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, banned))
      await error(await request(banned), 403, "ACCOUNT_RESTRICTED")
      await error(await request(randomUUID()), 403, "ACCOUNT_RESTRICTED")
    })

    test("HTTP purchases reconcile against one personal debit and preserved wallet history", async () => {
      expect((await reconcileCoinDatabase(connection.db)).matches).toBe(true)
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
