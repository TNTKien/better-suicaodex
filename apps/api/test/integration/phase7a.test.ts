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

import { eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  comment,
  manga,
  member as translationGroupMember,
  organization as translationGroup,
  translationGroupApplication,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
  userProfile,
} from "../../src/db/schema"
import {
  CurrentAccountSchema,
  PublicProfileSchema,
} from "../../src/features/account/contract"
import { createRuntime } from "../../src/runtime"
import type { Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { RuntimeEnv } from "../../src/shared/env"

const noop = () => undefined
const primaryEmail = `phase7a-${randomUUID()}@example.com`
const testEmails = [primaryEmail]
const ownerGroupId = randomUUID()
setDefaultTimeout(120_000)

let env: RuntimeEnv
let runtime: Runtime
let app: ReturnType<typeof createApp>
let primaryCookie = ""
let primaryUserId = ""
let mangaIds: string[] = []
let groupIds: string[] = []

async function signUp(email: string, name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: env.WEB_ORIGIN },
    body: JSON.stringify({
      email,
      name,
      password: "phase7a-integration-password",
    }),
  })
  expect(response.status).toBe(200)
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0]
  expect(cookie).toBeTruthy()
  const body = (await response.json()) as { user: { id: string } }
  return { cookie: cookie!, userId: body.user.id }
}

describe.serial("Phase 7A account profiles", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }
    if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL)
      throw new Error("Integration tests require a separate test database")

    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      REDIS_PREFIX: `${process.env.REDIS_PREFIX ?? "redive:test"}:phase7a-test`,
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await runtime.database.insert(translationGroup).values({
      id: ownerGroupId,
      name: "Phase 7A owner group",
      slug: `phase-7a-owner-${ownerGroupId}`,
      createdAt: new Date(),
    })
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      logger: noop,
      webOrigin: env.WEB_ORIGIN,
    })
  })

  afterAll(async () => {
    if (!runtime) return
    if (mangaIds.length) {
      await runtime.database
        .delete(comment)
        .where(inArray(comment.mangaId, mangaIds))
      await runtime.database
        .delete(chapter)
        .where(inArray(chapter.mangaId, mangaIds))
      await runtime.database.delete(manga).where(inArray(manga.id, mangaIds))
    }
    await runtime.database
      .delete(translationGroup)
      .where(eq(translationGroup.id, ownerGroupId))
    if (groupIds.length)
      await runtime.database
        .delete(translationGroup)
        .where(inArray(translationGroup.id, groupIds))
    await runtime.database.delete(user).where(inArray(user.email, testEmails))
    await runtime.close()
  })

  test("provisions and repairs a profile for an authenticated user", async () => {
    const specification = (await (
      await app.request("/openapi.json")
    ).json()) as { paths: Record<string, unknown> }
    expect(specification.paths).toHaveProperty("/v1/me")
    expect(specification.paths).toHaveProperty("/v1/me/profile")
    expect(specification.paths).toHaveProperty("/v1/profiles/{id}")

    const unauthorized = await app.request("/v1/me")
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get("cache-control")).toBe("private, no-store")

    const signedUp = await signUp(primaryEmail, "Phase 7A Reader")
    primaryCookie = signedUp.cookie
    primaryUserId = signedUp.userId

    const [created] = await runtime.database
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.userId, primaryUserId))
    expect(created?.userId).toBe(primaryUserId)

    await runtime.database
      .delete(userProfile)
      .where(eq(userProfile.userId, primaryUserId))
    const current = await app.request("/v1/me", {
      headers: { Cookie: primaryCookie, Origin: env.WEB_ORIGIN },
    })
    expect(current.status).toBe(200)
    expect(current.headers.get("cache-control")).toBe("private, no-store")
    const ownBody = await current.json()
    expect(CurrentAccountSchema.safeParse(ownBody).success).toBe(true)
    expect(ownBody).toMatchObject({
      coinBalance: "0",
      user: { id: primaryUserId, email: primaryEmail, role: "user" },
      profile: { isPublic: true, status: "active" },
      linkedProviders: ["credential"],
    })
    expect(ownBody.profile).not.toHaveProperty("slug")
    expect(JSON.stringify(ownBody)).not.toMatch(
      /accessToken|refreshToken|password|session|issuer|accountId/
    )

    const publicProfile = await app.request(`/v1/profiles/${primaryUserId}`)
    expect(publicProfile.status).toBe(200)
    expect(publicProfile.headers.get("cache-control")).toBe("no-store")
    const publicBody = (await publicProfile.json()) as Record<string, unknown>
    expect(publicBody).toMatchObject({
      name: "Phase 7A Reader",
      bio: null,
      verified: false,
    })
    expect(publicBody).not.toHaveProperty("slug")
    expect(publicBody).not.toHaveProperty("email")
    expect(publicBody).not.toHaveProperty("coinBalance")
    expect(publicBody).not.toHaveProperty("id")
    expect(publicBody).not.toHaveProperty("status")
  })

  test("exposes only public groups and the five latest visible comments by user ID", async () => {
    const database = runtime.database
    const instant = parseISO("2026-09-04T00:00:00Z")
    const mangaRows = await database
      .insert(manga)
      .values([
        {
          ownerGroupId,
          title: "Profile comments",
          searchTitle: "profile comments",
          slug: `profile-${randomUUID()}`,
          originalLanguage: "ja",
          status: "ongoing" as const,
          contentRating: "safe" as const,
          publicationState: "published" as const,
          publishedAt: instant,
        },
        {
          ownerGroupId,
          title: "Hidden manga",
          searchTitle: "hidden manga",
          slug: `profile-${randomUUID()}`,
          originalLanguage: "ja",
          status: "ongoing" as const,
          contentRating: "safe" as const,
          publicationState: "hidden" as const,
        },
        {
          ownerGroupId,
          title: "R18 manga",
          searchTitle: "r18 manga",
          slug: `profile-${randomUUID()}`,
          originalLanguage: "ja",
          status: "ongoing" as const,
          contentRating: "pornographic" as const,
          publicationState: "published" as const,
          publishedAt: instant,
        },
      ])
      .returning({ id: manga.id })
    mangaIds = mangaRows.map(({ id }) => id)
    const chapterRows = await database
      .insert(chapter)
      .values(
        [true, false].map((isFull, i) => ({
          ownerGroupId,
          mangaId: mangaIds[0]!,
          number: i === 0 ? "176.0000" : String(i + 1),
          language: "vi",
          pageCount: 1,
          availablePageCount: 1,
          isFull,
          publicationState: "published" as const,
          publishedAt: instant,
        }))
      )
      .returning({ id: chapter.id })
    const normal = await database
      .insert(comment)
      .values(
        Array.from({ length: 7 }, (_, i) => ({
          userId: primaryUserId,
          mangaId: mangaIds[0]!,
          chapterId: i % 2 ? chapterRows[0]!.id : null,
          body: `Public comment ${i}`,
          createdAt: instant,
        }))
      )
      .returning({ id: comment.id })
    await database.insert(comment).values([
      {
        userId: primaryUserId,
        mangaId: mangaIds[0]!,
        body: "Deleted body",
        deletedAt: instant,
      },
      {
        userId: primaryUserId,
        mangaId: mangaIds[0]!,
        body: "Hidden body",
        status: "hidden",
      },
      {
        userId: primaryUserId,
        mangaId: mangaIds[0]!,
        body: "Unusable chapter",
        chapterId: chapterRows[1]!.id,
      },
      {
        userId: primaryUserId,
        mangaId: mangaIds[1]!,
        body: "Hidden manga body",
      },
      { userId: primaryUserId, mangaId: mangaIds[2]!, body: "R18 body" },
    ])
    const groupRows = await database
      .insert(translationGroup)
      .values(
        Array.from({ length: 5 }, (_, i) => ({
          id: randomUUID(),
          name: `Profile group ${i}`,
          slug: `profile-${randomUUID()}`,
          createdAt: instant,
        }))
      )
      .returning({ id: translationGroup.id })
    groupIds = groupRows.map(({ id }) => id)
    await database.insert(translationGroupProfile).values(
      groupIds.map((organizationId, i) => ({
        organizationId,
        publicationState:
          i === 3 ? ("hidden" as const) : ("published" as const),
        deletedAt: i === 4 ? instant : null,
      }))
    )
    // Phase 8A allows only one pending/approved membership; exercise each visibility independently.
    for (const [i, groupId] of groupIds.entries()) {
      if (i === 1 || i === 2)
        await database.insert(translationGroupApplication).values({
          organizationId: groupId,
          userId: primaryUserId,
          type: "join",
          status: i === 1 ? "pending" : "rejected",
        })
      else {
        const memberId = randomUUID()
        await database.insert(translationGroupMember).values({
          id: memberId,
          organizationId: groupId,
          userId: primaryUserId,
          role: "member",
          createdAt: instant,
        })
        await database
          .insert(translationGroupMemberProfile)
          .values({ memberId })
      }
      const profile = (await (
        await app.request(`/v1/profiles/${primaryUserId}`)
      ).json()) as { groups: { id: string; isLeader: boolean }[] }
      expect(profile.groups.map(({ id }) => id)).toEqual(
        i === 0 ? [groupId] : []
      )
      if (i === 0) expect(profile.groups[0]?.isLeader).toBe(false)
      await database
        .delete(translationGroupMember)
        .where(eq(translationGroupMember.userId, primaryUserId))
      await database
        .delete(translationGroupApplication)
        .where(eq(translationGroupApplication.userId, primaryUserId))
    }
    const memberId = randomUUID()
    await database.insert(translationGroupMember).values({
      id: memberId,
      organizationId: groupIds[0]!,
      userId: primaryUserId,
      role: "owner",
      createdAt: instant,
    })
    await database.insert(translationGroupMemberProfile).values({ memberId })

    const load = async (identifier: string, target = app) => {
      const response = await target.request(`/v1/profiles/${identifier}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(PublicProfileSchema.safeParse(body).success).toBe(true)
      expect(Object.keys(body).sort()).toEqual([
        "avatarFrame",
        "bio",
        "commentCount",
        "createdAt",
        "groups",
        "image",
        "name",
        "recentComments",
        "verified",
      ])
      expect(JSON.stringify(body)).not.toMatch(
        /email|emailVerified|linkedProviders|userId|password|accessToken|Hidden body|Deleted body|Unusable chapter/
      )
      return PublicProfileSchema.parse(body)
    }
    const result = await load(primaryUserId)
    expect(result.groups.map(({ id }) => id)).toEqual([groupIds[0]!])
    expect(result.groups[0]?.isLeader).toBe(true)
    expect(result.commentCount).toBe(7)
    expect(result.recentComments.map(({ id }) => id)).toEqual(
      normal
        .map(({ id }) => id)
        .sort()
        .reverse()
        .slice(0, 5)
    )
    // UUIDv7 values created in the same millisecond are not insertion-ordered.
    for (const item of result.recentComments) {
      expect(item.chapter?.number ?? null).toBe(
        normal.findIndex(({ id }) => id === item.id) % 2 ? "176" : null
      )
    }

    const configured = (visibility: {
      hideR18?: boolean
      hiddenMangaIds?: string[]
      hiddenChapterIds?: string[]
    }) =>
      createApp({
        account: { database },
        catalog: {
          database,
          cache: runtime.cache,
          assetBaseUrl: "https://assets.example.test/",
          ...visibility,
        },
        logger: noop,
      })
    expect(
      (
        await load(
          primaryUserId,
          configured({ hiddenChapterIds: [chapterRows[0]!.id] })
        )
      ).commentCount
    ).toBe(4)
    const hidden = await load(
      primaryUserId,
      configured({ hiddenMangaIds: [mangaIds[0]!] })
    )
    expect(hidden.commentCount).toBe(0)
    expect(hidden.recentComments).toEqual([])
    expect(
      (await load(primaryUserId, configured({ hideR18: false }))).commentCount
    ).toBe(8)
  })

  test("validates profile updates without accepting application slugs", async () => {
    const updated = await app.request("/v1/me/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: primaryCookie,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({
        bio: "  Tiểu sử ngắn  ",
        isPublic: false,
      }),
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      profile: {
        bio: "Tiểu sử ngắn",
        isPublic: false,
      },
    })
    expect((await app.request(`/v1/profiles/${primaryUserId}`)).status).toBe(
      404
    )

    for (const body of [
      {},
      { slug: "UPPERCASE" },
      { bio: "x".repeat(2_001) },
    ]) {
      const invalid = await app.request("/v1/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: primaryCookie,
          Origin: env.WEB_ORIGIN,
        },
        body: JSON.stringify(body),
      })
      expect(invalid.status).toBe(400)
    }

    const visible = await app.request("/v1/me/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: primaryCookie,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ bio: "", isPublic: true }),
    })
    expect(visible.status).toBe(200)
    expect(await visible.json()).toMatchObject({
      profile: { bio: null, isPublic: true },
    })
    expect((await app.request(`/v1/profiles/${primaryUserId}`)).status).toBe(
      200
    )
    expect((await app.request("/v1/profiles/no")).status).toBe(404)
    expect((await app.request("/v1/profiles/missing-profile")).status).toBe(404)

    const coreUpdate = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: primaryCookie,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ name: "Phase 7A Active Reader" }),
    })
    expect(coreUpdate.status).toBe(200)
  })

  test("allows suspended self reads but blocks mutations and public access", async () => {
    const status = "suspended"
    const now = new Date()
    await runtime.database
      .update(userProfile)
      .set({
        status,
        moderatedAt: now,
        moderationReason: "phase7a_test",
        updatedAt: now,
      })
      .where(eq(userProfile.userId, primaryUserId))

    const current = await app.request("/v1/me", {
      headers: { Cookie: primaryCookie, Origin: env.WEB_ORIGIN },
    })
    expect(current.status).toBe(200)
    expect(await current.json()).toMatchObject({ profile: { status } })

    const update = await app.request("/v1/me/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: primaryCookie,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ bio: "Blocked" }),
    })
    expect(update.status).toBe(403)
    expect(await update.json()).toMatchObject({
      error: { code: "ACCOUNT_RESTRICTED" },
    })

    const coreUpdate = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: primaryCookie,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ name: "Blocked suspended" }),
    })
    expect(coreUpdate.status).toBe(403)

    expect((await app.request(`/v1/profiles/${primaryUserId}`)).status).toBe(
      404
    )

    const [storedUser] = await runtime.database
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, primaryUserId))
    expect(storedUser?.name).toBe("Phase 7A Active Reader")
  })
})
