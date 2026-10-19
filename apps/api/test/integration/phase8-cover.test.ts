import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { addMinutes, subMinutes } from "date-fns"
import { asc, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import sharp from "sharp"

import { createApp } from "../../src/app"
import {
  cover,
  coverUploadOperation,
  coverUploadSession,
  manga,
  mangaGroup,
  member,
  moderationAction,
  organization,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
} from "../../src/db/schema"
import {
  cleanupCoverUploads,
  cleanupCoverUploadSessions,
} from "../../src/features/groups/cover"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { ChapterStorage, CoverStorage } from "../../src/shared/storage"

setDefaultTimeout(120_000)
const origin = "http://localhost:3000"
const noop = () => undefined
const objects = new Map<string, Uint8Array>()
const stagingObjects = new Map<string, Uint8Array>()
let onPut: (() => Promise<void>) | undefined
const storage: CoverStorage = {
  async put(key, body) {
    objects.set(key, Uint8Array.from(body))
    const callback = onPut
    onPut = undefined
    await callback?.()
  },
  async head(key) {
    return {
      cacheControl: "public, max-age=31536000, immutable",
      contentLength: objects.get(key)?.byteLength,
      contentType: "image/webp",
    }
  },
  async delete(key) {
    objects.delete(key)
  },
}
const stagingStorage: ChapterStorage = {
  async put(key, body) {
    stagingObjects.set(key, Uint8Array.from(body))
  },
  async head(key) {
    return {
      contentLength: stagingObjects.get(key)?.byteLength,
      contentType: "image/webp",
    }
  },
  async delete(key) {
    stagingObjects.delete(key)
  },
  async copyToPublic(sourceKey, targetKey) {
    const value = stagingObjects.get(sourceKey)
    if (!value) throw new Error("Missing staging object")
    objects.set(targetKey, Uint8Array.from(value))
  },
  async deletePublic(key) {
    objects.delete(key)
  },
  async headPublic(key) {
    return {
      cacheControl: "public, max-age=31536000, immutable",
      contentLength: objects.get(key)?.byteLength,
      contentType: "image/webp",
    }
  },
  async previewUrl(key) {
    const value = stagingObjects.get(key)
    if (!value) throw new Error("Missing staging object")
    return `data:image/webp;base64,${Buffer.from(value).toString("base64")}`
  },
}

let runtime: Runtime
let app: ReturnType<typeof createApp>
let cookie: string
let userId: string
let memberId: string
const groupId = randomUUID()
let mangaId: string

function upload(body: Blob, expectedVersion: number) {
  const form = new FormData()
  form.set("cover", body, "cover.bin")
  form.set("expectedVersion", String(expectedVersion))
  return app.request(
    `/v1/contribution/groups/${groupId}/manga/${mangaId}/cover`,
    { method: "POST", headers: { Cookie: cookie, Origin: origin }, body: form }
  )
}

function stage(body: Blob, target?: { id: string; version: number }) {
  const form = new FormData()
  form.set("cover", body, "cover.bin")
  if (target) {
    form.set("mangaId", target.id)
    form.set("expectedVersion", String(target.version))
  }
  return app.request(`/v1/contribution/groups/${groupId}/manga/cover-uploads`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin },
    body: form,
  })
}

function commit(
  sessionId: string,
  expectedVersion: number,
  targetId = mangaId
) {
  return app.request(
    `/v1/contribution/groups/${groupId}/manga/${targetId}/cover-uploads/${sessionId}`,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expectedVersion }),
    }
  )
}

function cancel(sessionId: string) {
  return app.request(
    `/v1/contribution/groups/${groupId}/manga/cover-uploads/${sessionId}`,
    { method: "DELETE", headers: { Cookie: cookie, Origin: origin } }
  )
}

async function sourceCover() {
  return sharp(randomBytes(360 * 540 * 3), {
    raw: { width: 360, height: 540, channels: 3 },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
}

describe.serial("Phase 8 manga cover", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    runtime = await createRuntime(
      parseRuntimeEnv({
        ...process.env,
        NODE_ENV: "test",
        WEB_ORIGIN: origin,
        DATABASE_URL: url,
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
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "http://localhost:9000/",
      },
      coverStorage: storage,
      chapterStorage: stagingStorage,
      logger: noop,
      webOrigin: origin,
    })

    const signedUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: `phase8-cover-${randomUUID()}@example.com`,
        name: "Cover fixture",
        password: "phase8-cover-fixture-password",
      }),
    })
    expect(signedUp.status).toBe(200)
    userId = ((await signedUp.json()) as { user: { id: string } }).user.id
    cookie = signedUp.headers.get("set-cookie")!.split(";", 1)[0]!

    memberId = randomUUID()
    await runtime.database.insert(organization).values({
      id: groupId,
      name: "Cover fixture group",
      slug: `cover-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: userId,
    })
    await runtime.database.insert(member).values({
      id: memberId,
      organizationId: groupId,
      userId,
      role: "owner",
      createdAt: new Date(),
    })
    await runtime.database
      .insert(translationGroupMemberProfile)
      .values({ memberId })
    const [createdManga] = await runtime.database
      .insert(manga)
      .values({
        ownerGroupId: groupId,
        slug: `cover-${randomUUID()}`,
        title: "Cover fixture manga",
        searchTitle: "cover fixture manga",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
      })
      .returning({ id: manga.id })
    mangaId = createdManga!.id
    await runtime.database.insert(mangaGroup).values({ mangaId, groupId })
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database
      .delete(moderationAction)
      .where(eq(moderationAction.targetId, mangaId))
    await runtime.database
      .delete(coverUploadOperation)
      .where(eq(coverUploadOperation.mangaId, mangaId))
    await runtime.database
      .delete(coverUploadSession)
      .where(eq(coverUploadSession.groupId, groupId))
    await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    await runtime.database.delete(user).where(eq(user.id, userId))
    await runtime.close()
  })

  test("uploads, replaces, validates, and cleans orphan covers", async () => {
    const source = await sourceCover()
    expect(source.byteLength).toBeGreaterThan(16_384)

    const first = await upload(new Blob([source], { type: "image/jpeg" }), 1)
    const firstBody = (await first.json()) as unknown
    expect({ status: first.status, body: firstBody }).toMatchObject({
      status: 200,
      body: { data: { width: 360, height: 540, version: 2 } },
    })
    expect(objects.size).toBe(3)

    const second = await upload(new Blob([source], { type: "image/png" }), 2)
    expect(second.status).toBe(200)
    const rows = await runtime.database
      .select({ id: cover.id, isPrimary: cover.isPrimary })
      .from(cover)
      .where(eq(cover.mangaId, mangaId))
      .orderBy(asc(cover.createdAt))
    expect(rows).toHaveLength(2)
    expect(rows.map(({ isPrimary }) => isPrimary)).toEqual([false, true])
    expect(objects.size).toBe(6)

    onPut = async () => {
      await runtime.database
        .update(manga)
        .set({ version: 4 })
        .where(eq(manga.id, mangaId))
    }
    const stale = await upload(new Blob([source], { type: "image/jpeg" }), 3)
    expect(stale.status).toBe(409)
    expect(objects.size).toBe(6)

    const bmp = Buffer.alloc(58)
    bmp.write("BM")
    expect(
      (await upload(new Blob([bmp], { type: "image/bmp" }), 4)).status
    ).toBe(400)
    expect(
      (await upload(new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)]), 4)).status
    ).toBe(413)

    const operationId = randomUUID()
    const orphanKeys = [".webp", ".512.webp", ".256.webp"].map(
      (suffix) => `covers/${mangaId}/${operationId}${suffix}`
    )
    for (const key of orphanKeys) await storage.put(key, new Uint8Array([1]))
    const cleanupAt = new Date()
    await runtime.database.insert(coverUploadOperation).values({
      id: operationId,
      mangaId,
      groupId,
      actorUserId: userId,
      originalKey: orphanKeys[0]!,
      mediumKey: orphanKeys[1]!,
      smallKey: orphanKeys[2]!,
      expiresAt: subMinutes(cleanupAt, 1),
    })
    expect(
      await cleanupCoverUploads(runtime.database, storage, {
        apply: true,
        now: cleanupAt,
      })
    ).toEqual([{ id: operationId, state: "cleaning" }])
    expect(
      await cleanupCoverUploads(runtime.database, storage, {
        apply: true,
        now: addMinutes(cleanupAt, 3),
      })
    ).toContainEqual({ id: operationId, state: "cleaned" })
    expect(orphanKeys.some((key) => objects.has(key))).toBe(false)
  })

  test("stages cover selection before commit and cleans cancelled sessions", async () => {
    const source = await sourceCover()
    const stagedResponse = await stage(
      new Blob([source], { type: "image/jpeg" }),
      { id: mangaId, version: 4 }
    )
    expect(stagedResponse.status).toBe(201)
    const staged = (await stagedResponse.json()) as {
      data: { id: string; previewUrl: string }
    }
    expect(staged.data.previewUrl).toContain(staged.data.id)
    expect(staged.data.previewUrl).not.toContain("staging.example.com")
    expect(staged.data.previewUrl).toContain("/uploads/covers/tmp/")
    expect(stagingObjects.size).toBe(3)
    const preview = await app.request(staged.data.previewUrl)
    expect(preview.status).toBe(200)
    expect(preview.headers.get("cache-control")).toBe("public, max-age=300")
    expect(preview.headers.get("content-type")).toContain("image/webp")
    expect((await preview.arrayBuffer()).byteLength).toBeGreaterThan(0)

    const [before] = await runtime.database
      .select({ version: manga.version })
      .from(manga)
      .where(eq(manga.id, mangaId))
    const committed = await commit(staged.data.id, before!.version)
    expect(committed.status).toBe(200)
    expect(await committed.json()).toMatchObject({
      data: { version: before!.version + 1, width: 360, height: 540 },
    })
    expect(stagingObjects.size).toBe(0)
    const [attached] = await runtime.database
      .select()
      .from(coverUploadSession)
      .where(eq(coverUploadSession.id, staged.data.id))
    expect(attached).toMatchObject({
      mangaId,
      state: "attached",
    })
    expect(attached?.stagingCleanedAt).toBeInstanceOf(Date)

    const replacementResponse = await stage(
      new Blob([source], { type: "image/jpeg" }),
      { id: mangaId, version: before!.version + 1 }
    )
    expect(replacementResponse.status).toBe(201)
    const replacement = (await replacementResponse.json()) as {
      data: { id: string }
    }
    expect((await cancel(replacement.data.id)).status).toBe(204)
    expect(stagingObjects.size).toBe(0)
    const [cancelled] = await runtime.database
      .select({ state: coverUploadSession.state })
      .from(coverUploadSession)
      .where(eq(coverUploadSession.id, replacement.data.id))
    expect(cancelled?.state).toBe("cleaned")

    const expiredResponse = await stage(
      new Blob([source], { type: "image/jpeg" })
    )
    const expired = (await expiredResponse.json()) as {
      data: { id: string }
    }
    const cleanupAt = new Date()
    await runtime.database
      .update(coverUploadSession)
      .set({ expiresAt: subMinutes(cleanupAt, 1) })
      .where(eq(coverUploadSession.id, expired.data.id))
    expect(
      await cleanupCoverUploadSessions(runtime.database, stagingStorage, {
        apply: true,
        now: cleanupAt,
      })
    ).toContainEqual({ id: expired.data.id, state: "cleaned" })
    expect(stagingObjects.size).toBe(0)
  })

  test("attaches a staged cover when a create-only member creates manga", async () => {
    const source = await sourceCover()
    const stagedResponse = await stage(
      new Blob([source], { type: "image/jpeg" })
    )
    expect(stagedResponse.status).toBe(201)
    const staged = (await stagedResponse.json()) as { data: { id: string } }
    let createdMangaId: string | undefined
    await runtime.database
      .update(member)
      .set({ role: "member" })
      .where(eq(member.id, memberId))
    await runtime.database
      .update(translationGroupMemberProfile)
      .set({ canAddManga: true, canEditManga: false })
      .where(eq(translationGroupMemberProfile.memberId, memberId))
    try {
      const created = await app.request(
        `/v1/contribution/groups/${groupId}/manga`,
        {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Create-only cover fixture",
            alternativeTitles: [],
            description: null,
            originalLanguage: "ja",
            publicationDemographic: null,
            status: "ongoing",
            contentRating: "safe",
            year: null,
            lastVolume: null,
            lastChapter: null,
            links: {},
            tagIds: [],
            authorIds: [],
            artistIds: [],
            coverUploadId: staged.data.id,
          }),
        }
      )
      expect(created.status).toBe(201)
      const body = (await created.json()) as {
        data: { id: string; publicationState: string; version: number }
      }
      createdMangaId = body.data.id
      expect(body.data.publicationState).toBe("published")
      expect(
        (await commit(staged.data.id, body.data.version, createdMangaId)).status
      ).toBe(200)
    } finally {
      await runtime.database
        .update(member)
        .set({ role: "owner" })
        .where(eq(member.id, memberId))
      await runtime.database
        .delete(coverUploadSession)
        .where(eq(coverUploadSession.id, staged.data.id))
      if (createdMangaId)
        await runtime.database.delete(manga).where(eq(manga.id, createdMangaId))
    }
  })
})
