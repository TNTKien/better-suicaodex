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
import { inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import { moderationAction, user } from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)

const origin = "http://localhost:3000"
const password = "phase9e-fixture-password"
const accounts: Account[] = []
const targetIds = Array.from({ length: 5 }, () => randomUUID())
const idPrefix = randomUUID().slice(0, 24)
const auditIds = [1, 2, 3, 4, 5].map(
  (value) => `${idPrefix}${String(value).padStart(12, "0")}`
)
let runtime: Runtime
let app: ReturnType<typeof createApp>
let admin: Account
let member: Account

type Account = { id: string; cookie: string }

async function signUp(name: string) {
  const email = `phase9e-${randomUUID()}@example.com`
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  })
  expect(response.status).toBe(200)
  const account = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(account)
  return account
}

function request(actor: Account | undefined, path: string, method = "GET") {
  return app.request(path, {
    method,
    headers: { Origin: origin, ...(actor ? { Cookie: actor.cookie } : {}) },
  })
}

describe.serial("Phase 9E-A moderation audit explorer", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")

    const env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      WEB_ORIGIN: origin,
      DATABASE_URL: url,
      REDIS_CACHE_ENABLED: "false",
    })
    runtime = await createRuntime(env, () => undefined)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: "http://localhost:9000/",
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: () => undefined,
      webOrigin: origin,
    })
    admin = await signUp("Phase 9E admin")
    member = await signUp("Phase 9E member")
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(inArray(user.id, [admin.id]))

    const tie = new Date("2026-09-26T10:00:00.000Z")
    await runtime.database.insert(moderationAction).values([
      {
        id: auditIds[0],
        actorUserId: admin.id,
        action: "moderation.manga.hidden",
        targetKind: "manga",
        targetId: targetIds[0]!,
        reason: "Hidden for audit test",
        before: { password: "must-not-leak", visible: true },
        after: { nested: { accessToken: "must-not-leak", visible: false } },
        createdAt: tie,
      },
      {
        id: auditIds[1],
        actorUserId: admin.id,
        action: "moderation.manga.unhidden",
        targetKind: "manga",
        targetId: targetIds[0]!,
        reason: "Unhidden for audit test",
        createdAt: tie,
      },
      {
        id: auditIds[2],
        actorUserId: admin.id,
        action: "moderation.user.status_changed",
        targetKind: "user",
        targetId: targetIds[1]!,
        reason: "Account status changed",
        createdAt: new Date("2026-09-26T09:00:00.000Z"),
      },
      {
        id: auditIds[3],
        actorUserId: null,
        action: "system.tag.imported",
        targetKind: "tag",
        targetId: targetIds[2]!,
        reason: "System import",
        createdAt: new Date("2026-09-26T11:00:00.000Z"),
      },
    ])

    const deletedActorId = `phase9e-deleted-${randomUUID()}`
    await runtime.database.insert(user).values({
      id: deletedActorId,
      name: "Deleted actor",
      email: `${deletedActorId}@example.com`,
      emailVerified: true,
    })
    await runtime.database.insert(moderationAction).values({
      id: auditIds[4],
      actorUserId: deletedActorId,
      action: "moderation.comment.hidden",
      targetKind: "comment",
      targetId: targetIds[3]!,
      reason: "Actor will be deleted",
      createdAt: new Date("2026-09-26T08:00:00.000Z"),
    })
    await runtime.database
      .delete(user)
      .where(inArray(user.id, [deletedActorId]))
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database
      .delete(moderationAction)
      .where(inArray(moderationAction.id, auditIds))
    await runtime.database.delete(user).where(
      inArray(
        user.id,
        accounts.map(({ id }) => id)
      )
    )
    await runtime.close()
  })

  test("is admin-only, read-only and never cacheable", async () => {
    expect((await request(undefined, "/v1/admin/audit")).status).toBe(401)
    expect((await request(member, "/v1/admin/audit")).status).toBe(403)
    const response = await request(admin, "/v1/admin/audit?limit=1")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect((await request(admin, "/v1/admin/audit", "POST")).status).toBe(404)
    expect(
      (await request(admin, `/v1/admin/audit/${auditIds[0]}`, "DELETE")).status
    ).toBe(404)
  })

  test("filters records and redacts credential-shaped snapshot keys", async () => {
    const query = new URLSearchParams({
      targetKind: "manga",
      targetId: targetIds[0]!,
      actorUserId: admin.id,
      action: "moderation.manga.hidden",
      from: "2026-09-26T09:30:00.000Z",
      to: "2026-09-26T10:30:00.000Z",
    })
    const response = await request(admin, `/v1/admin/audit?${query}`)
    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      data: Array<{
        id: string
        actor: { id: string; name: string } | null
        before: Record<string, unknown> | null
        after: { nested?: Record<string, unknown> } | null
      }>
    }
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]?.id).toBe(auditIds[0])
    expect(payload.data[0]?.actor?.id).toBe(admin.id)
    expect(payload.data[0]?.before).toEqual({
      password: "[REDACTED]",
      visible: true,
    })
    expect(payload.data[0]?.after?.nested).toEqual({
      accessToken: "[REDACTED]",
      visible: false,
    })
  })

  test("uses createdAt and id as a stable descending cursor", async () => {
    const first = (await (
      await request(
        admin,
        `/v1/admin/audit?targetKind=manga&targetId=${targetIds[0]}&limit=1`
      )
    ).json()) as {
      data: Array<{ id: string }>
      meta: { nextCursor: string | null }
    }
    expect(first.data[0]?.id).toBe(auditIds[1])
    expect(first.meta.nextCursor).toBe(auditIds[1])

    const second = (await (
      await request(
        admin,
        `/v1/admin/audit?targetKind=manga&targetId=${targetIds[0]}&limit=1&cursor=${first.meta.nextCursor}`
      )
    ).json()) as {
      data: Array<{ id: string }>
      meta: { nextCursor: string | null }
    }
    expect(second.data[0]?.id).toBe(auditIds[0])
    expect(second.meta.nextCursor).toBeNull()
    expect(
      (await request(admin, `/v1/admin/audit?cursor=${randomUUID()}`)).status
    ).toBe(400)
    expect(
      (
        await request(
          admin,
          `/v1/admin/audit?targetKind=manga&cursor=${auditIds[2]}`
        )
      ).status
    ).toBe(400)
  })

  test("keeps orphaned audit records readable after the actor is deleted", async () => {
    const payload = (await (
      await request(admin, `/v1/admin/audit?targetId=${targetIds[3]}`)
    ).json()) as {
      data: Array<{ actor: unknown; actorUserId: string | null }>
    }
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({ actor: null, actorUserId: null })
  })
})
