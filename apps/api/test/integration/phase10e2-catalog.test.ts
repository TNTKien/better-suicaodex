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
import { parseISO } from "date-fns"
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { z } from "@hono/zod-openapi"
import { createApp } from "../../src/app"
import { createDatabase } from "../../src/db/client"
import {
  avatarFrame,
  avatarFrameTopic,
  coinWallet,
  moderationAction,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import type { Auth } from "../../src/features/account/auth"
import {
  AdminAvatarFrameSchema,
  UpdateAvatarFrameShopSchema,
} from "../../src/features/avatar-frames/contract"
import { updateAvatarFrameShop } from "../../src/features/avatar-frames/service"
import { createCoinService } from "../../src/features/coin/service"
import { MAX_COIN } from "../../src/features/coin/contract"
import { ShopAvatarFrameSchema } from "../../src/features/shop/contract"
import type { BusinessCache } from "../../src/shared/cache"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>
let admin: string
let reader: string
const origin = "http://localhost:3000"
const coin = createCoinService({ enabled: true })
let invalidations = 0
let freshSession = false
const auth = {
  api: {
    getSession: async ({
      headers,
      query,
    }: {
      headers: Headers
      query?: { disableCookieCache?: boolean }
    }) => {
      freshSession = query?.disableCookieCache === true
      const id = headers.get("x-test-user")
      return id ? { user: { id, role: "admin" } } : null
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
    shopEnabled: flags.shop,
    coin: flags.coin ? coin : createCoinService(),
    avatarFramesEnabled: flags.frames,
    catalog: {
      database,
      assetBaseUrl: "https://assets.example.com",
      cache: {
        status: "disabled",
        invalidateCatalog: async () => {
          invalidations++
        },
      } as unknown as BusinessCache,
    },
    webOrigin: origin,
    logger: () => {},
  })
}
async function account(role = "user") {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, role, name: "Shop fixture", email: `${id}@example.com` })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function frame(patch: Partial<typeof avatarFrame.$inferInsert> = {}) {
  const id = randomUUID()
  const [row] = await connection.db
    .insert(avatarFrame)
    .values({
      id,
      code: `catalog-${id}`,
      name: `Catalog ${id}`,
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
async function get(path: string, actor?: string, instance = app()) {
  return instance.request(path, {
    headers: actor ? { "x-test-user": actor } : {},
  })
}
type Catalog = {
  data: Array<
    z.infer<typeof ShopAvatarFrameSchema> & {
      owned?: boolean
      canPurchase?: boolean
      purchaseBlockReason?: string | null
    }
  >
  meta: { total: number; totalPages: number; page: number; limit: number }
  purchaseEnabled: boolean
  balance?: string
}
async function catalog(path: string, actor?: string, instance = app()) {
  const response = await get(path, actor, instance)
  expect(response.status).toBe(200)
  return (await response.json()) as Catalog
}
async function patch(
  id: string,
  input: unknown,
  actor = admin,
  instance = app(),
  requestOrigin = origin
) {
  return instance.request(`/v1/admin/avatar-frames/${id}/shop`, {
    method: "PATCH",
    headers: {
      "x-test-user": actor,
      Origin: requestOrigin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}
async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  expect(
    ((await response.json()) as { error: { code: string } }).error.code
  ).toBe(code)
  expect(response.headers.get("Cache-Control")).toContain("no-store")
}
async function row(id: string) {
  return (
    await connection.db.select().from(avatarFrame).where(eq(avatarFrame.id, id))
  )[0]!
}
async function audit(id: string) {
  return connection.db
    .select()
    .from(moderationAction)
    .where(
      and(
        eq(moderationAction.targetId, id),
        eq(moderationAction.action, "avatar_frame.shop_updated")
      )
    )
}
async function financialState() {
  const result = await connection.db.execute(sql`SELECT jsonb_build_object(
    'wallet', (SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM coin_wallet w),
    'operation', (SELECT jsonb_agg(to_jsonb(o) ORDER BY o.key) FROM coin_operation o),
    'ledger', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM coin_ledger l),
    'ownership', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.user_id, f.frame_id) FROM user_avatar_frame f),
    'purchase', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM shop_purchase p)
  ) AS state`)
  return result.rows[0]!.state
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.2C Shop catalog and commerce",
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
      await migrate(connection.db, {
        migrationsFolder: fileURLToPath(
          new URL("../../drizzle", import.meta.url)
        ),
      })
      admin = await account("admin")
      reader = await account()
    })
    afterAll(async () => {
      await connection?.pool.end()
    })

    test("public eligibility, sold out, detail and topics use one catalog without private fields", async () => {
      const name = `eligibility-${randomUUID()}`
      const [topic] = await connection.db
        .insert(avatarFrameTopic)
        .values({ name })
        .returning()
      const available = await frame({ name, topicId: topic!.id })
      const sold = await frame({ name, shopStock: 0 })
      const hidden = [
        await frame({ name, topicId: topic!.id, active: false }),
        await frame({ name, rarity: "SSR", limited: true }),
        await frame({ name, shopPrice: null }),
        await frame({ name, assetKey: "../outside.webp" }),
        await frame({ name, previewKey: "https://outside.example/frame.webp" }),
        await frame({ name, assetKey: "" }),
      ]
      const [draft] = await connection.db
        .insert(avatarFrame)
        .values({
          code: `draft-${randomUUID()}`,
          name,
          rarity: "R",
          shopPrice: 5n,
        })
        .returning()
      const path = `/v1/shop/avatar-frames?q=${name}`
      const guest = await catalog(path)
      expect(await catalog(path, reader)).toEqual(guest)
      expect(guest.meta.total).toBe(2)
      expect(guest.data.map(({ frame }) => frame.id).sort()).toEqual(
        [available.id, sold.id].sort()
      )
      const detail = await get(`/v1/shop/avatar-frames/${sold.id}`)
      expect(detail.headers.get("Cache-Control")).toBe("no-store")
      expect(
        (
          (await detail.json()) as {
            data: z.infer<typeof ShopAvatarFrameSchema>
          }
        ).data.availability
      ).toBe("sold_out")
      for (const unavailable of [...hidden, draft!])
        await error(
          await get(`/v1/shop/avatar-frames/${unavailable.id}`),
          404,
          "NOT_FOUND"
        )
      await error(
        await get(`/v1/shop/avatar-frames/${randomUUID()}`),
        404,
        "NOT_FOUND"
      )
      const serialized = JSON.stringify(guest)
      for (const privateKey of [
        "owned",
        "balance",
        "sha256",
        "assetKey",
        "shopVersion",
        "sourceSha256",
      ])
        expect(serialized).not.toContain(`"${privateKey}"`)
      const topics = (await (
        await get("/v1/shop/avatar-frame-topics")
      ).json()) as { data: Array<{ id: string; frameCount: number }> }
      expect(topics.data.find(({ id }) => id === topic!.id)?.frameCount).toBe(1)
      expect(
        (await catalog(`${path}&topicId=none`)).data.map(
          ({ frame }) => frame.id
        )
      ).toEqual([sold.id])
      expect(
        (await catalog(`${path}&topicId=${topic!.id}`)).data[0]?.frame.id
      ).toBe(available.id)
    })

    test("search, rarity, pagination and createdAt/id descending order; strict queries", async () => {
      const name = `ordering-${randomUUID()}`
      const at = parseISO("2026-10-04T00:00:00Z")
      const a = await frame({ name, createdAt: at })
      const b = await frame({ name, createdAt: at })
      const c = await frame({
        name,
        rarity: "R",
        createdAt: parseISO("2026-10-05T00:00:00Z"),
      })
      const first = await catalog(`/v1/shop/avatar-frames?q=${name}&limit=2`)
      expect(first.data.map(({ frame }) => frame.id)).toEqual([
        c.id,
        ...[a.id, b.id].sort().reverse().slice(0, 1),
      ])
      expect(first.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 })
      expect(
        (await catalog(`/v1/shop/avatar-frames?q=${name}&limit=2&page=2`))
          .data[0]?.frame.id
      ).toBe([a.id, b.id].sort()[0])
      expect(
        (await catalog(`/v1/shop/avatar-frames?q=${name}&rarity=R`)).data.map(
          ({ frame }) => frame.id
        )
      ).toEqual([c.id])
      expect(
        (await catalog(`/v1/shop/avatar-frames?q=${a.code}`)).data[0]?.frame.id
      ).toBe(a.id)
      for (const query of [
        "page=0",
        "limit=101",
        "q=%20",
        "rarity=SSSR",
        "topicId=bad",
        "sort=asc",
      ])
        await error(
          await get(`/v1/shop/avatar-frames?${query}`),
          400,
          "VALIDATION_ERROR"
        )
    })

    test("private projection is fresh, personal, read-only and does not create a wallet", async () => {
      const name = `private-${randomUUID()}`
      const owned = await frame({ name, shopStock: 0 })
      const sold = await frame({ name, shopStock: 0 })
      const revoked = await frame({ name })
      await connection.db.insert(userAvatarFrame).values([
        { userId: reader, frameId: owned.id },
        { userId: reader, frameId: revoked.id, revokedAt: new Date() },
      ])
      const before = await financialState()
      const path = `/v1/me/shop/avatar-frames?q=${name}`
      const personal = await catalog(path, reader)
      expect(freshSession).toBe(true)
      expect(personal.balance).toBe("0")
      expect(
        personal.data.find(({ frame }) => frame.id === owned.id)
          ?.purchaseBlockReason
      ).toBe("already_owned")
      expect(
        personal.data.find(({ frame }) => frame.id === sold.id)
          ?.purchaseBlockReason
      ).toBe("sold_out")
      expect(
        personal.data.find(({ frame }) => frame.id === revoked.id)
          ?.purchaseBlockReason
      ).toBe("insufficient_coin")
      expect(
        personal.data.find(({ frame }) => frame.id === revoked.id)?.owned
      ).toBe(false)
      expect(await financialState()).toEqual(before)
      expect(
        await connection.db
          .select()
          .from(coinWallet)
          .where(eq(coinWallet.userId, reader))
      ).toHaveLength(0)
      const another = await account()
      expect(
        (await catalog(path, another)).data.some(({ owned }) => owned)
      ).toBe(false)
      await error(await get(path), 401, "UNAUTHORIZED")
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, another))
      await error(await get(path, another), 403, "ACCOUNT_RESTRICTED")
      const restricted = await account()
      await connection.db
        .update(userProfile)
        .set({
          status: "suspended",
          moderatedAt: new Date(),
          moderationReason: "Catalog test restriction",
        })
        .where(eq(userProfile.userId, restricted))
      await error(await get(path, restricted), 403, "ACCOUNT_RESTRICTED")
      const response = await get(path, reader)
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    })

    test("flags remain readable with correct block precedence; funded user can purchase only as a projection", async () => {
      const item = await frame()
      const actor = await account()
      await connection.db.transaction((tx) =>
        coin.apply(tx, {
          key: `test.catalog:${actor}`,
          actorUserId: actor,
          sourceType: "test.catalog",
          sourceId: item.id,
          entries: [
            {
              owner: { kind: "user", id: actor },
              mode: "credit",
              amount: "15",
            },
          ],
        })
      )
      const path = `/v1/me/shop/avatar-frames?q=${item.code}`
      const before = await financialState()
      const ready = await catalog(path, actor)
      expect(ready.balance).toBe("15")
      expect(ready.data[0]?.canPurchase).toBe(true)
      expect(ready.data[0]?.purchaseBlockReason).toBeNull()
      for (const [flags, reason] of [
        [{ shop: false, coin: false, frames: false }, "shop_disabled"],
        [{ shop: true, coin: false, frames: false }, "coin_disabled"],
        [{ shop: true, coin: true, frames: false }, "avatar_frames_disabled"],
      ] as const) {
        const instance = app(flags)
        expect(
          (
            await catalog(
              `/v1/shop/avatar-frames?q=${item.code}`,
              undefined,
              instance
            )
          ).purchaseEnabled
        ).toBe(false)
        expect(
          (await catalog(path, actor, instance)).data[0]?.purchaseBlockReason
        ).toBe(reason)
      }
      expect(await financialState()).toEqual(before)
    })

    test("admin stock/price revisions and audits are atomic, exact BIGINT; no-op has no side effects", async () => {
      const item = await frame()
      const before = await financialState()
      invalidations = 0
      const stock = await patch(item.id, {
        expectedVersion: 1,
        expectedShopVersion: 1,
        stock: 9,
      })
      expect(stock.status).toBe(200)
      const stockResult = (
        (await stock.json()) as { data: z.infer<typeof AdminAvatarFrameSchema> }
      ).data
      expect(stockResult.version).toBe(1)
      expect(stockResult.shop).toEqual({ price: "15", stock: 9, version: 2 })
      const price = await patch(item.id, {
        expectedVersion: 1,
        expectedShopVersion: 2,
        price: MAX_COIN.toString(),
      })
      expect(price.status).toBe(200)
      const result = (
        (await price.json()) as { data: z.infer<typeof AdminAvatarFrameSchema> }
      ).data
      expect(result.version).toBe(2)
      expect(result.shop).toEqual({
        price: MAX_COIN.toString(),
        stock: 9,
        version: 3,
      })
      const unchanged = await row(item.id)
      expect(
        (
          await patch(item.id, {
            expectedVersion: 2,
            expectedShopVersion: 3,
            stock: 9,
            price: MAX_COIN.toString(),
          })
        ).status
      ).toBe(200)
      expect(await row(item.id)).toEqual(unchanged)
      const actions = await audit(item.id)
      expect(actions).toHaveLength(2)
      expect(
        actions.find(({ before }) => before?.shopVersion === 2)?.after
      ).toEqual({
        price: MAX_COIN.toString(),
        stock: 9,
        version: 2,
        shopVersion: 3,
      })
      expect(invalidations).toBe(0)
      expect(await financialState()).toEqual(before)
      const adminCatalog = await get(
        `/v1/admin/avatar-frames?q=${item.code}`,
        admin
      )
      expect(
        (
          (await adminCatalog.json()) as {
            data: z.infer<typeof AdminAvatarFrameSchema>[]
          }
        ).data[0]?.shop
      ).toEqual(result.shop)
    })

    test("admin guards, strict commerce boundary, metadata does not reset commerce", async () => {
      const item = await frame()
      const input = { expectedVersion: 1, expectedShopVersion: 1, stock: 4 }
      await error(await patch(item.id, input, reader), 403, "FORBIDDEN")
      await error(
        await patch(item.id, input, admin, app(), "https://untrusted.example"),
        403,
        "INVALID_ORIGIN"
      )
      for (const invalid of [
        { expectedVersion: 1, expectedShopVersion: 1 },
        { ...input, price: 15 },
        { ...input, price: "0" },
        { ...input, price: "01" },
        { ...input, price: (MAX_COIN + 1n).toString() },
        { ...input, stock: -1 },
        { ...input, stock: 2_147_483_648 },
        { ...input, expectedVersion: 2_147_483_648 },
        { ...input, expectedShopVersion: 0 },
        { ...input, active: false },
      ])
        await error(await patch(item.id, invalid), 400, "VALIDATION_ERROR")
      await error(
        await patch(item.id, { ...input, padding: "x".repeat(16_384) }),
        413,
        "PAYLOAD_TOO_LARGE"
      )
      const metadata = await app().request(
        `/v1/admin/avatar-frames/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "x-test-user": admin,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 1, rarity: "R" }),
        }
      )
      expect(metadata.status).toBe(200)
      const updated = await row(item.id)
      expect(updated.shopPrice).toBe(15n)
      expect(updated.shopStock).toBe(10)
      expect(updated.shopVersion).toBe(1)
      const override = await app().request(
        `/v1/admin/avatar-frames/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "x-test-user": admin,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 2, shopStock: 9 }),
        }
      )
      await error(override, 400, "VALIDATION_ERROR")
      const limited = await frame({ rarity: "SSR", limited: true })
      expect(
        (
          await patch(limited.id, {
            expectedVersion: 1,
            expectedShopVersion: 1,
            price: "200",
            stock: 50,
          })
        ).status
      ).toBe(200)
      await error(
        await get(`/v1/shop/avatar-frames/${limited.id}`),
        404,
        "NOT_FOUND"
      )
      const preflight = await app().request(
        `/v1/admin/avatar-frames/${item.id}/shop`,
        {
          method: "OPTIONS",
          headers: { Origin: origin, "Access-Control-Request-Method": "PATCH" },
        }
      )
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin)
    })

    test("active admin is rechecked inside the transaction, not trusted from session/middleware", async () => {
      const actor = await account("admin")
      const item = await frame()
      const database = new Proxy(connection.db, {
        get(target, property, receiver) {
          if (property === "transaction")
            return async (...args: Parameters<typeof target.transaction>) => {
              await connection.db
                .update(user)
                .set({ role: "user" })
                .where(eq(user.id, actor))
              return target.transaction(...args)
            }
          return Reflect.get(target, property, receiver)
        },
      })
      await error(
        await patch(
          item.id,
          { expectedVersion: 1, expectedShopVersion: 1, stock: 1 },
          actor,
          app(undefined, database)
        ),
        403,
        "FORBIDDEN"
      )
      expect((await row(item.id)).shopStock).toBe(10)
      expect(await audit(item.id)).toHaveLength(0)
      const bannedAdmin = await account("admin")
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, bannedAdmin))
      await error(
        await patch(
          item.id,
          { expectedVersion: 1, expectedShopVersion: 1, stock: 1 },
          bannedAdmin
        ),
        403,
        "FORBIDDEN"
      )
    })

    test("two admins cannot overwrite each other; concurrent stock decrement invalidates stale form", async () => {
      const item = await frame()
      const second = await account("admin")
      const results = await Promise.all([
        patch(item.id, {
          expectedVersion: 1,
          expectedShopVersion: 1,
          stock: 7,
        }),
        patch(
          item.id,
          { expectedVersion: 1, expectedShopVersion: 1, stock: 8 },
          second
        ),
      ])
      expect(results.map(({ status }) => status).sort()).toEqual([200, 409])
      await error(
        results.find(({ status }) => status === 409)!,
        409,
        "SHOP_VERSION_CONFLICT"
      )
      expect(await audit(item.id)).toHaveLength(1)
      const stale = await row(item.id)
      let release!: () => void
      let locked!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const ready = new Promise<void>((resolve) => {
        locked = resolve
      })
      // Exercise the purchase writer's planned frame lock/decrement, without implementing D.
      const decrement = connection.db.transaction(async (tx) => {
        await tx
          .select()
          .from(avatarFrame)
          .where(eq(avatarFrame.id, item.id))
          .for("update")
        locked()
        await gate
        await tx
          .update(avatarFrame)
          .set({
            shopStock: stale.shopStock - 1,
            shopVersion: stale.shopVersion + 1,
          })
          .where(eq(avatarFrame.id, item.id))
      })
      await ready
      const edit = patch(item.id, {
        expectedVersion: stale.version,
        expectedShopVersion: stale.shopVersion,
        stock: 100,
      })
      release()
      await decrement
      await error(await edit, 409, "SHOP_VERSION_CONFLICT")
      expect((await row(item.id)).shopStock).toBe(stale.shopStock - 1)
      await error(
        await patch(item.id, {
          expectedVersion: 99,
          expectedShopVersion: 99,
          price: "20",
        }),
        409,
        "VERSION_CONFLICT"
      )
    })

    test("revision exhaustion rolls back explicitly; unchanged fields at max revision remain no-op", async () => {
      const item = await frame({ version: 2_147_483_647 })
      await error(
        await patch(item.id, {
          expectedVersion: 2_147_483_647,
          expectedShopVersion: 1,
          price: "20",
        }),
        409,
        "VERSION_CONFLICT"
      )
      expect(
        (
          await patch(item.id, {
            expectedVersion: 2_147_483_647,
            expectedShopVersion: 1,
            stock: 9,
          })
        ).status
      ).toBe(200)
      await connection.db
        .update(avatarFrame)
        .set({ shopVersion: 2_147_483_647 })
        .where(eq(avatarFrame.id, item.id))
      const before = await row(item.id)
      await error(
        await patch(item.id, {
          expectedVersion: before.version,
          expectedShopVersion: before.shopVersion,
          stock: 8,
        }),
        409,
        "SHOP_VERSION_CONFLICT"
      )
      expect(
        (
          await patch(item.id, {
            expectedVersion: before.version,
            expectedShopVersion: before.shopVersion,
            stock: 9,
          })
        ).status
      ).toBe(200)
      expect(await row(item.id)).toEqual(before)
    })

    test("audit failure rolls back config; unknown database errors are sanitized 503", async () => {
      const item = await frame()
      const before = await row(item.id)
      const financeBefore = await financialState()
      await connection.db
        .execute(sql`CREATE FUNCTION shop_catalog_test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = 'avatar_frame.shop_updated' THEN RAISE EXCEPTION 'private SQL/credential test'; END IF; RETURN NEW; END $$`)
      await connection.db.execute(
        sql`CREATE TRIGGER shop_catalog_test_audit_fail BEFORE INSERT ON moderation_action FOR EACH ROW EXECUTE FUNCTION shop_catalog_test_audit_fail()`
      )
      try {
        await error(
          await patch(item.id, {
            expectedVersion: 1,
            expectedShopVersion: 1,
            stock: 1,
          }),
          503,
          "SERVICE_UNAVAILABLE"
        )
        expect(await row(item.id)).toEqual(before)
        expect(await audit(item.id)).toHaveLength(0)
      } finally {
        await connection.db.execute(
          sql`DROP TRIGGER shop_catalog_test_audit_fail ON moderation_action`
        )
        await connection.db.execute(
          sql`DROP FUNCTION shop_catalog_test_audit_fail()`
        )
      }
      const database = new Proxy(connection.db, {
        get(target, property, receiver) {
          if (property === "select")
            return () => {
              throw new Error("secret SQL/credentials")
            }
          return Reflect.get(target, property, receiver)
        },
      })
      const response = await get(
        "/v1/shop/avatar-frames",
        undefined,
        app(undefined, database)
      )
      await error(response, 503, "SERVICE_UNAVAILABLE")
      expect(await financialState()).toEqual(financeBefore)
      const validated = UpdateAvatarFrameShopSchema.parse({
        expectedVersion: 1,
        expectedShopVersion: 1,
        stock: 1,
      })
      const denied = await updateAvatarFrameShop(
        connection.db,
        reader,
        item.id,
        validated
      ).then(
        () => null,
        (cause: unknown) => cause
      )
      expect(denied).toMatchObject({ status: 403, code: "FORBIDDEN" })
    })
  }
)
