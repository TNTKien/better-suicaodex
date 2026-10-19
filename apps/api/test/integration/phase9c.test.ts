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
import { eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  comment,
  manga,
  moderationAction,
  organization,
  session,
  user,
  userProfile,
} from "../../src/db/schema"
import { createAdministrator } from "../../src/features/account/administrator"
import {
  isApplicationAdmin,
  setAdministrator,
} from "../../src/features/groups/service"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)

const origin = "http://localhost:3000"
const password = "phase9c-fixture-password"
const fixtureName = `Phase 9C ${randomUUID().slice(0, 8)}`
const accounts: Account[] = []
const mangaId = randomUUID()
const ownerGroupId = randomUUID()
let runtime: Runtime
let app: ReturnType<typeof createApp>
let adminA: Account
let adminB: Account
let target: Account
let member: Account

type Account = { id: string; email: string; cookie: string }

async function signUp(name: string) {
  const email = `phase9c-${randomUUID()}@example.com`
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      "X-Forwarded-For": "203.0.113.10",
    },
    body: JSON.stringify({ email, name, password }),
  })
  expect(response.status).toBe(200)
  const account = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    email,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(account)
  return account
}

async function signIn(account: Account) {
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password }),
  })
  if (response.status === 200)
    account.cookie = response.headers.get("set-cookie")!.split(";", 1)[0]!
  return response
}

function request(
  actor: Account | undefined,
  path: string,
  method = "GET",
  body?: unknown,
  requestOrigin = origin
) {
  return app.request(path, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe.serial("Phase 9C account moderation", () => {
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

    adminA = await signUp(`${fixtureName} admin A`)
    adminB = await signUp(`${fixtureName} admin B`)
    target = await signUp(`${fixtureName} target`)
    member = await signUp(`${fixtureName} member`)
    await runtime.database
      .update(user)
      .set({ createdAt: parseISO("2026-09-25T00:00:00.000Z") })
      .where(inArray(user.id, [target.id, member.id]))
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(inArray(user.id, [adminA.id, adminB.id]))
    await runtime.database.insert(organization).values({
      id: ownerGroupId,
      name: "Phase 9C owner group",
      slug: `phase-9c-owner-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(manga).values({
      ownerGroupId,
      id: mangaId,
      slug: `phase-9c-${randomUUID()}`,
      title: "Phase 9C manga",
      searchTitle: "phase 9c manga",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
      publishedAt: new Date(),
    })
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database.delete(moderationAction).where(
      inArray(
        moderationAction.targetId,
        accounts.map(({ id }) => id)
      )
    )
    await runtime.database.delete(comment).where(eq(comment.mangaId, mangaId))
    await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, ownerGroupId))
    await runtime.database.delete(user).where(
      inArray(
        user.id,
        accounts.map(({ id }) => id)
      )
    )
    await runtime.close()
  })

  test("protects and lists account moderation data without auth secrets", async () => {
    expect((await request(undefined, "/v1/admin/users")).status).toBe(401)
    expect((await request(member, "/v1/admin/users")).status).toBe(403)
    expect(
      (
        await request(
          adminA,
          `/v1/admin/users/${target.id}/status`,
          "PUT",
          { status: "suspended", expectedVersion: 1 },
          "https://example.invalid"
        )
      ).status
    ).toBe(403)

    const response = await request(
      adminA,
      `/v1/admin/users?q=${encodeURIComponent(target.email)}&status=active`
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    const payload = (await response.json()) as {
      data: Array<{ id: string; status: string; version: number }>
    }
    expect(payload.data).toEqual([
      expect.objectContaining({ id: target.id, status: "active", version: 1 }),
    ])

    const byName = await request(
      adminA,
      `/v1/admin/users?q=${encodeURIComponent(`${fixtureName} target`)}`
    )
    expect(byName.status).toBe(200)
    expect((await byName.json()).data).toEqual([
      expect.objectContaining({ id: target.id }),
    ])
    const byId = await request(adminA, `/v1/admin/users?q=${target.id}`)
    expect(byId.status).toBe(200)
    expect((await byId.json()).data).toEqual([
      expect.objectContaining({ id: target.id }),
    ])
    const paged = await request(
      adminA,
      `/v1/admin/users?q=${encodeURIComponent(fixtureName)}&page=1&limit=2`
    )
    expect(paged.status).toBe(200)
    const pagedBody = (await paged.json()) as {
      data: Array<{ id: string }>
      meta: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(pagedBody.meta).toMatchObject({ page: 1, limit: 2, total: 4 })
    expect(pagedBody.meta.totalPages).toBe(2)
    const all = await request(
      adminA,
      `/v1/admin/users?q=${encodeURIComponent(fixtureName)}&limit=20`
    )
    const tiedIds = ((await all.json()) as { data: Array<{ id: string }> }).data
      .map(({ id }) => id)
      .filter((id) => id === target.id || id === member.id)
    // The disposable database uses ICU und, including case-aware text ordering.
    expect(tiedIds).toEqual(
      [target.id, member.id].sort((a, b) => b.localeCompare(a, "und"))
    )

    const detail = await request(adminA, `/v1/admin/users/${target.id}`)
    expect(detail.status).toBe(200)
    const body = await detail.text()
    expect(JSON.parse(body)).toMatchObject({
      data: { linkedProviders: ["credential"] },
    })
    expect(body).not.toMatch(
      /banReason|banExpires|password|session|accessToken|refreshToken|ipAddress|userAgent/
    )

    const sessions = await request(
      adminA,
      `/v1/admin/users/${target.id}/sessions`
    )
    expect(sessions.status).toBe(200)
    const sessionBody = await sessions.text()
    expect(JSON.parse(sessionBody)).toMatchObject({
      data: [
        {
          ipAddress: "203.0.113.10",
          userAgent: expect.stringContaining("Chrome/142"),
        },
      ],
    })
    expect(sessionBody).not.toMatch(/token|cookie/i)
  })

  test("protects production API documentation with an active admin session", async () => {
    const productionApp = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: "http://localhost:9000/",
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: () => undefined,
      production: true,
      webOrigin: origin,
    })
    const documentationRequest = (actor: Account | undefined, path: string) =>
      productionApp.request(path, {
        headers: actor ? { Cookie: actor.cookie } : undefined,
      })

    expect((await documentationRequest(undefined, "/docs")).status).toBe(401)
    expect((await documentationRequest(member, "/docs")).status).toBe(403)

    const docs = await documentationRequest(adminA, "/docs")
    expect(docs.status).toBe(200)
    expect(docs.headers.get("cache-control")).toBe("private, no-store")
    expect(docs.headers.get("content-type")).toContain("text/html")

    expect(
      (await documentationRequest(undefined, "/openapi.json")).status
    ).toBe(401)
    expect((await documentationRequest(adminA, "/openapi.json")).status).toBe(
      200
    )
  })

  test("suspends atomically, revokes cached sessions and still allows sign-in", async () => {
    const createdComment = await request(
      target,
      `/v1/manga/${mangaId}/comments`,
      "POST",
      { body: "Phase 9C self-delete regression" }
    )
    expect(createdComment.status).toBe(201)
    const ownComment = (await createdComment.json()) as {
      id: string
      version: number
    }
    expect((await request(target, "/v1/me")).status).toBe(200)
    const response = await request(
      adminA,
      `/v1/admin/users/${target.id}/status`,
      "PUT",
      { status: "suspended", expectedVersion: 1 }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: target.id,
        status: "suspended",
        version: 2,
        moderationReason: "account suspended by administrator",
      },
    })
    expect((await request(target, "/v1/me")).status).toBe(401)
    expect(
      await (
        await request(adminA, `/v1/admin/users/${target.id}/sessions`)
      ).json()
    ).toEqual({ data: [] })

    expect((await signIn(target)).status).toBe(200)
    const current = await request(target, "/v1/me")
    expect(current.status).toBe(200)
    expect(await current.json()).toMatchObject({
      profile: { status: "suspended" },
    })
    expect(
      (
        await request(target, "/v1/me/profile", "PATCH", {
          bio: "must be blocked",
        })
      ).status
    ).toBe(403)
    expect((await request(undefined, `/v1/profiles/${target.id}`)).status).toBe(
      404
    )
    expect(
      (
        await request(target, `/v1/manga/${mangaId}/comments`, "POST", {
          body: "must be blocked",
        })
      ).status
    ).toBe(403)
    expect(
      await (await request(undefined, `/v1/manga/${mangaId}/comments`)).text()
    ).toContain("Phase 9C self-delete regression")
    const blockedGroup = await request(
      target,
      "/v1/contribution/groups",
      "POST",
      { name: `Phase 9C blocked ${randomUUID().slice(0, 8)}` }
    )
    expect(blockedGroup.status).toBe(403)
    expect(await blockedGroup.json()).toMatchObject({
      error: { code: "ACCOUNT_RESTRICTED" },
    })
    expect(
      (
        await request(target, `/v1/comments/${ownComment.id}`, "DELETE", {
          expectedVersion: ownComment.version,
        })
      ).status
    ).toBe(200)
    expect((await request(target, "/api/auth/sign-out", "POST")).status).toBe(
      200
    )
    expect((await signIn(target)).status).toBe(200)
  })

  test("uses Better Auth permanent ban state until an administrator restores it", async () => {
    const restored = await request(
      adminA,
      `/v1/admin/users/${target.id}/status`,
      "PUT",
      { status: "active", expectedVersion: 2 }
    )
    expect(restored.status).toBe(200)

    const banned = await request(
      adminA,
      `/v1/admin/users/${target.id}/status`,
      "PUT",
      { status: "banned", expectedVersion: 3 }
    )
    expect(banned.status).toBe(200)
    expect((await request(target, "/v1/me")).status).toBe(401)
    const blockedSignIn = await signIn(target)
    expect(blockedSignIn.status).toBe(403)
    expect(await blockedSignIn.json()).toMatchObject({ code: "BANNED_USER" })
    expect((await request(undefined, `/v1/profiles/${target.id}`)).status).toBe(
      404
    )
    const [bannedUser] = await runtime.database
      .select({
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
      })
      .from(user)
      .where(eq(user.id, target.id))
    expect(bannedUser).toEqual({
      banned: true,
      banReason: "account banned by administrator",
      banExpires: null,
    })

    const unbanned = await request(
      adminA,
      `/v1/admin/users/${target.id}/status`,
      "PUT",
      { status: "active", expectedVersion: 4 }
    )
    expect(unbanned.status).toBe(200)
    expect(await unbanned.json()).toMatchObject({
      data: { status: "active", version: 5, moderationReason: null },
    })
    expect((await signIn(target)).status).toBe(200)
  })

  test("rejects stale, no-op and self restriction requests", async () => {
    const noOp = await request(
      adminA,
      `/v1/admin/users/${target.id}/status`,
      "PUT",
      { status: "active", expectedVersion: 5 }
    )
    expect(noOp.status).toBe(409)
    expect(await noOp.json()).toMatchObject({
      error: { code: "STATE_UNCHANGED" },
    })
    const stale = await request(
      adminA,
      `/v1/admin/users/${target.id}/status`,
      "PUT",
      { status: "suspended", expectedVersion: 4 }
    )
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      error: { code: "VERSION_CONFLICT" },
    })
    const self = await request(
      adminA,
      `/v1/admin/users/${adminA.id}/status`,
      "PUT",
      { status: "suspended", expectedVersion: 1 }
    )
    expect(self.status).toBe(409)
    expect(await self.json()).toMatchObject({
      error: { code: "SELF_RESTRICTION" },
    })
    expect(
      (
        await request(adminA, `/v1/admin/users/${target.id}/status`, "PUT", {
          status: "suspended",
          expectedVersion: 5,
          reason: "not accepted",
        })
      ).status
    ).toBe(400)
  })

  test("lets only one concurrent decision commit for the same account version", async () => {
    const responses = await Promise.all([
      request(adminA, `/v1/admin/users/${member.id}/status`, "PUT", {
        status: "suspended",
        expectedVersion: 1,
      }),
      request(adminB, `/v1/admin/users/${member.id}/status`, "PUT", {
        status: "banned",
        expectedVersion: 1,
      }),
    ])
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])
    const [profile] = await runtime.database
      .select({ status: userProfile.status, version: userProfile.version })
      .from(userProfile)
      .where(eq(userProfile.userId, member.id))
    expect(profile?.version).toBe(2)
    expect(
      (
        await request(adminA, `/v1/admin/users/${member.id}/status`, "PUT", {
          status: "active",
          expectedVersion: 2,
        })
      ).status
    ).toBe(200)
  })

  test("administrator grants and revokes use the active account definition", async () => {
    expect(
      (
        await request(adminA, `/v1/admin/users/${member.id}/status`, "PUT", {
          status: "suspended",
          expectedVersion: 3,
        })
      ).status
    ).toBe(200)
    const blockedGrant = await setAdministrator(
      runtime.database,
      member.id,
      "grant",
      adminA.id
    ).then(
      () => null,
      (error: unknown) => error
    )
    expect(blockedGrant).toHaveProperty("code", "ACCOUNT_RESTRICTED")
    expect(
      (
        await request(adminA, `/v1/admin/users/${member.id}/status`, "PUT", {
          status: "active",
          expectedVersion: 4,
        })
      ).status
    ).toBe(200)
    await setAdministrator(runtime.database, member.id, "grant", adminA.id)
    expect(await isApplicationAdmin(runtime.database, member.id)).toBe(true)
    expect(
      (
        await request(adminA, `/v1/admin/users/${member.id}/status`, "PUT", {
          status: "suspended",
          expectedVersion: 5,
        })
      ).status
    ).toBe(200)
    expect(await isApplicationAdmin(runtime.database, member.id)).toBe(false)
    expect((await request(member, "/v1/admin/users")).status).toBe(401)
    expect((await signIn(member)).status).toBe(200)
    expect((await request(member, "/v1/admin/users")).status).toBe(403)
    await setAdministrator(runtime.database, member.id, "revoke", adminA.id)
    expect(
      (
        await request(adminA, `/v1/admin/users/${member.id}/status`, "PUT", {
          status: "active",
          expectedVersion: 6,
        })
      ).status
    ).toBe(200)
  })

  test("serializes competing admin restrictions without losing the last active admin", async () => {
    const responses = await Promise.all([
      request(adminA, `/v1/admin/users/${adminB.id}/status`, "PUT", {
        status: "suspended",
        expectedVersion: 1,
      }),
      request(adminB, `/v1/admin/users/${adminA.id}/status`, "PUT", {
        status: "banned",
        expectedVersion: 1,
      }),
    ])
    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1)

    const rows = await runtime.database
      .select({
        id: user.id,
        status: userProfile.status,
        version: userProfile.version,
      })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(inArray(user.id, [adminA.id, adminB.id]))
    expect(rows.filter(({ status }) => status === "active")).toHaveLength(1)
    const active = rows.find(({ status }) => status === "active")!
    const restricted = rows.find(({ status }) => status !== "active")!
    const actor = active.id === adminA.id ? adminA : adminB
    const restored = await request(
      actor,
      `/v1/admin/users/${restricted.id}/status`,
      "PUT",
      { status: "active", expectedVersion: restricted.version }
    )
    expect(restored.status).toBe(200)
    const restoredAccount = restricted.id === adminA.id ? adminA : adminB
    expect((await signIn(restoredAccount)).status).toBe(200)
  })

  test("rolls back account and session changes when audit insertion fails", async () => {
    await runtime.database.execute(
      sql.raw(`
        create or replace function phase9c_reject_session_delete() returns trigger as $$
        begin
          if old.user_id = '${target.id}' then
            raise exception 'forced session delete failure';
          end if;
          return old;
        end;
        $$ language plpgsql;
        drop trigger if exists phase9c_reject_session_delete on session;
        create trigger phase9c_reject_session_delete before delete on session
        for each row execute function phase9c_reject_session_delete();
      `)
    )
    try {
      expect(
        (
          await request(adminA, `/v1/admin/users/${target.id}/status`, "PUT", {
            status: "suspended",
            expectedVersion: 5,
          })
        ).status
      ).toBe(500)
    } finally {
      await runtime.database.execute(
        sql.raw(`
          drop trigger if exists phase9c_reject_session_delete on session;
          drop function if exists phase9c_reject_session_delete();
        `)
      )
    }
    await runtime.database.execute(
      sql.raw(`
        create or replace function phase9c_reject_audit() returns trigger as $$
        begin
          if new.action = 'account.status.suspended' then
            raise exception 'forced audit failure';
          end if;
          return new;
        end;
        $$ language plpgsql;
        drop trigger if exists phase9c_reject_audit on moderation_action;
        create trigger phase9c_reject_audit before insert on moderation_action
        for each row execute function phase9c_reject_audit();
      `)
    )
    try {
      expect(
        (
          await request(adminA, `/v1/admin/users/${target.id}/status`, "PUT", {
            status: "suspended",
            expectedVersion: 5,
          })
        ).status
      ).toBe(500)
      const [profile] = await runtime.database
        .select({
          status: userProfile.status,
          version: userProfile.version,
          banned: user.banned,
        })
        .from(userProfile)
        .innerJoin(user, eq(user.id, userProfile.userId))
        .where(eq(userProfile.userId, target.id))
      expect(profile).toEqual({ status: "active", version: 5, banned: false })
      expect(
        await runtime.database
          .select({ id: session.id })
          .from(session)
          .where(eq(session.userId, target.id))
      ).not.toHaveLength(0)
    } finally {
      await runtime.database.execute(
        sql.raw(`
          drop trigger if exists phase9c_reject_audit on moderation_action;
          drop function if exists phase9c_reject_audit();
        `)
      )
    }
  })

  test("blocks raw Better Auth admin HTTP routes but keeps server-side APIs usable", async () => {
    const raw = await request(adminA, "/api/auth/admin/ban-user", "POST", {
      userId: member.id,
    })
    expect(raw.status).toBe(404)

    const email = `phase9c-internal-${randomUUID()}@example.com`
    const created = await createAdministrator(runtime.database, runtime.auth, {
      email,
      name: "Phase 9C internal admin",
      password,
      actorUserId: adminA.id,
    })
    accounts.push({ id: created.id, email, cookie: "" })
    expect(created.email).toBe(email)
    expect(await isApplicationAdmin(runtime.database, created.id)).toBe(true)
  })
})
