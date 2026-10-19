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
import { and, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  moderationAction,
  notification,
  systemNotice,
  systemNoticeState,
  user,
} from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const origin = "http://localhost:3000"
const accounts: Array<{ id: string; cookie: string }> = []
const noticeIds: string[] = []
const noop = () => undefined

let runtime: Runtime
let app: ReturnType<typeof createApp>
let admin: (typeof accounts)[number]
let reader: (typeof accounts)[number]

async function signUp() {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      email: `phase10c-${randomUUID()}@example.com`,
      name: "Phase 10C user",
      password: "phase10c-integration-password",
    }),
  })
  expect(response.status).toBe(200)
  const account = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(account)
  return account
}

function request(
  actor: (typeof accounts)[number] | null,
  path: string,
  method = "GET",
  body?: unknown,
  requestOrigin = origin
) {
  return app.request(path, {
    method,
    headers: {
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      Origin: requestOrigin,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function createNotice(title: string) {
  const response = await request(admin, "/v1/admin/system-notices", "POST", {
    title,
    content: `**${title}** content`,
  })
  expect(response.status).toBe(201)
  const id = ((await response.json()) as { data: { id: string } }).data.id
  noticeIds.push(id)
  return id
}

describe.serial("Phase 10C system notices", () => {
  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL
    if (!databaseUrl || databaseUrl === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    runtime = await createRuntime(
      parseRuntimeEnv({
        ...process.env,
        NODE_ENV: "test",
        WEB_ORIGIN: origin,
        DATABASE_URL: databaseUrl,
        REDIS_CACHE_ENABLED: "false",
      }),
      noop
    )
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: "https://assets.example/",
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: noop,
      webOrigin: origin,
    })
    admin = await signUp()
    reader = await signUp()
    await runtime.database
      .update(user)
      .set({ role: "admin", createdAt: parseISO("2020-01-01T00:00:00Z") })
      .where(eq(user.id, admin.id))
    await runtime.database
      .update(user)
      .set({ createdAt: parseISO("2020-01-01T00:00:00Z") })
      .where(eq(user.id, reader.id))
  })

  afterAll(async () => {
    if (!runtime) return
    if (noticeIds.length)
      await runtime.database
        .delete(moderationAction)
        .where(
          and(
            eq(moderationAction.targetKind, "system_notice"),
            inArray(moderationAction.targetId, noticeIds)
          )
        )
    await runtime.database
      .delete(systemNotice)
      .where(inArray(systemNotice.id, noticeIds))
    await runtime.database.delete(user).where(
      inArray(
        user.id,
        accounts.map(({ id }) => id)
      )
    )
    await runtime.close()
  })

  test("publishes once, protects CRUD and advances each user's read cursor", async () => {
    expect((await request(null, "/v1/system-notices")).status).toBe(200)
    expect((await request(reader, "/v1/admin/system-notices")).status).toBe(403)
    expect(
      (
        await request(
          admin,
          "/v1/admin/system-notices",
          "POST",
          { title: "Blocked", content: "Blocked" },
          "https://evil.example"
        )
      ).status
    ).toBe(403)

    const first = await createNotice("First notice")
    const second = await createNotice("Second notice")
    const precision = await runtime.database.execute<{ remainder: number }>(
      sql`select mod(extract(microseconds from created_at)::int, 1000) as remainder from system_notice where id = ${second}`
    )
    expect(Number(precision.rows[0]?.remainder)).toBe(0)
    await runtime.database
      .update(systemNotice)
      .set({ createdAt: parseISO("2025-01-01T00:00:00Z") })
      .where(eq(systemNotice.id, first))
    await runtime.database
      .update(systemNotice)
      .set({ createdAt: parseISO("2025-01-02T00:00:00Z") })
      .where(eq(systemNotice.id, second))
    const published = (await (
      await request(null, "/v1/system-notices?limit=1")
    ).json()) as { data: Array<{ id: string }>; meta: { nextCursor: string } }
    expect(published.data).toHaveLength(1)
    expect(published.meta.nextCursor).toBeTruthy()

    const feed = (await (
      await request(reader, "/v1/me/notifications")
    ).json()) as {
      data: Array<{ id: string; type: string; readAt: string | null }>
      meta: { unreadCount: number }
    }
    expect(
      feed.data.filter(({ type }) => type === "system_notice")
    ).toHaveLength(2)
    expect(feed.meta.unreadCount).toBe(2)
    expect(
      await runtime.database
        .select({ id: notification.id })
        .from(notification)
        .where(eq(notification.userId, reader.id))
    ).toHaveLength(0)

    expect(
      (await request(reader, `/v1/me/notifications/${second}/read`, "POST"))
        .status
    ).toBe(200)
    const [cursorAfterSecond] = await runtime.database
      .select()
      .from(systemNoticeState)
      .where(eq(systemNoticeState.userId, reader.id))
    expect(cursorAfterSecond?.readThroughId).toBe(second)
    await request(reader, `/v1/me/notifications/${first}/read`, "POST")
    const [cursorAfterFirst] = await runtime.database
      .select()
      .from(systemNoticeState)
      .where(eq(systemNoticeState.userId, reader.id))
    expect(cursorAfterFirst?.readThroughId).toBe(second)

    const third = await createNotice("Third notice")
    const newAccount = await signUp()
    await runtime.database
      .update(user)
      .set({ createdAt: parseISO("2100-01-01T00:00:00Z") })
      .where(eq(user.id, newAccount.id))
    const newFeed = (await (
      await request(newAccount, "/v1/me/notifications")
    ).json()) as {
      data: Array<{ type: string }>
      meta: { unreadCount: number }
    }
    expect(newFeed.data.some(({ type }) => type === "system_notice")).toBe(
      false
    )
    expect(newFeed.meta.unreadCount).toBe(0)

    const readAll = (await (
      await request(reader, "/v1/me/notifications/read-all", "POST")
    ).json()) as { data: { updated: number }; meta: { unreadCount: number } }
    expect(readAll.data.updated).toBe(1)
    expect(readAll.meta.unreadCount).toBe(0)
    const [state] = await runtime.database
      .select()
      .from(systemNoticeState)
      .where(eq(systemNoticeState.userId, reader.id))
    expect(state?.readThroughId).toBe(third)

    const [before] = await runtime.database
      .select({ createdAt: systemNotice.createdAt })
      .from(systemNotice)
      .where(eq(systemNotice.id, third))
    const changed = await request(
      admin,
      `/v1/admin/system-notices/${third}`,
      "PUT",
      { title: "Third notice edited", content: "Edited" }
    )
    expect(changed.status).toBe(200)
    const [after] = await runtime.database
      .select({ createdAt: systemNotice.createdAt })
      .from(systemNotice)
      .where(eq(systemNotice.id, third))
    expect(after?.createdAt).toEqual(before?.createdAt)
    expect(
      (
        (await (await request(reader, "/v1/me/notifications")).json()) as {
          meta: { unreadCount: number }
        }
      ).meta.unreadCount
    ).toBe(0)
    expect(
      (await request(admin, `/v1/admin/system-notices/${first}`, "DELETE"))
        .status
    ).toBe(200)
    expect(
      await runtime.database
        .select({ action: moderationAction.action })
        .from(moderationAction)
        .where(
          and(
            eq(moderationAction.targetKind, "system_notice"),
            inArray(moderationAction.targetId, noticeIds)
          )
        )
    ).toHaveLength(5)
  })
})
