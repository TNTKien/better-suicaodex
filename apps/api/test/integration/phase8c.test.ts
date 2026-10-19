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
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import sharp from "sharp"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  chapterPage,
  chapterUploadFinalObject,
  chapterUploadPage,
  chapterUploadSession,
  libraryItem,
  manga,
  mangaGroup,
  mangaLanguage,
  mangaVolume,
  member,
  moderationAction,
  notification,
  organization,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
  userProfile,
} from "../../src/db/schema"
import {
  cleanupChapterUploads,
  processChapterFinalizeJobs,
  type Dependencies as ChapterDependencies,
} from "../../src/features/groups/chapter"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { ChapterStorage } from "../../src/shared/storage"

setDefaultTimeout(120_000)
const origin = "http://localhost:3000"
const noop = () => undefined
const objects = new Map<string, Uint8Array>()
const publicChecksums = new Map<string, string>()
let onPut: (() => Promise<void>) | undefined
let onCopy: (() => Promise<void>) | undefined
const storage: ChapterStorage = {
  async copyToPublic(sourceKey, targetKey, sha256) {
    const source = objects.get(sourceKey)
    if (!source) throw new Error("Staging object not found")
    objects.set(targetKey, Uint8Array.from(source))
    publicChecksums.set(targetKey, sha256)
    const callback = onCopy
    onCopy = undefined
    await callback?.()
  },
  async deletePublic(key) {
    objects.delete(key)
    publicChecksums.delete(key)
  },
  async headPublic(key) {
    return {
      cacheControl: "public, max-age=31536000, immutable",
      contentLength: objects.get(key)?.byteLength,
      contentType: "image/webp",
      metadata: { sha256: publicChecksums.get(key) ?? "" },
    }
  },
  async previewUrl(key) {
    const value = objects.get(key)
    if (!value) throw new Error("Staging object not found")
    return `data:image/webp;base64,${Buffer.from(value).toString("base64")}`
  },
  async put(key, body) {
    objects.set(key, Uint8Array.from(body))
    const callback = onPut
    onPut = undefined
    await callback?.()
  },
  async head(key) {
    return {
      contentLength: objects.get(key)?.byteLength,
      contentType: "image/webp",
    }
  },
  async delete(key) {
    objects.delete(key)
  },
}

let runtime: Runtime
let app: ReturnType<typeof createApp>
let chapterDependencies: ChapterDependencies
let cookie: string
let userId: string
const groupId = randomUUID()
const secondGroupId = randomUUID()
let mangaId: string
let chapterId: string

function request(path: string, method = "GET", body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function upload(root: string, sessionId: string, pageId: string, body: Blob) {
  return uploadPage(`${root}/${chapterId}/uploads`, sessionId, pageId, body)
}

function uploadPage(
  root: string,
  sessionId: string,
  pageId: string,
  body: Blob
) {
  const form = new FormData()
  form.set("pageId", pageId)
  form.set("page", body, "page.bin")
  return app.request(`${root}/${sessionId}/pages`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin },
    body: form,
  })
}

async function createFinalizeFixture(number: string, count = 1) {
  await runtime.database
    .insert(libraryItem)
    .values({ userId, mangaId, category: "following" })
    .onConflictDoNothing()
  const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
  const created = await request(root, "POST", {
    number,
    volumeNumber: null,
    language: "vi",
    title: "Phase 8F fault injection",
  })
  expect(created.status).toBe(201)
  const { data: target } = (await created.json()) as {
    data: { id: string; version: number }
  }
  const uploadRoot = `${root}/${target.id}/uploads`
  const opened = await request(uploadRoot, "POST", {
    mode: "initial",
    expectedVersion: target.version,
  })
  expect(opened.status).toBe(200)
  const { data: session } = (await opened.json()) as { data: { id: string } }
  const source = await sharp({
    create: { width: 40, height: 60, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer()
  const pageIds = Array.from({ length: count }, () => randomUUID())
  for (const pageId of pageIds)
    expect(
      (
        await uploadPage(
          uploadRoot,
          session.id,
          pageId,
          new Blob([source], { type: "image/webp" })
        )
      ).status
    ).toBe(200)
  const sessionPath = `${uploadRoot}/${session.id}`
  expect(
    (await request(`${sessionPath}/order`, "PUT", { pageIds })).status
  ).toBe(200)
  const input = { expectedVersion: target.version, pageIds }
  const finalizePath = `${sessionPath}/finalize`
  expect((await request(finalizePath, "POST", input)).status).toBe(202)
  return {
    targetId: target.id,
    sessionId: session.id,
    pageIds,
    sessionPath,
    finalizePath,
    input,
  }
}

async function expectUnpublished(targetId: string) {
  expect((await app.request(`/v1/chapters/${targetId}`)).status).toBe(404)
  expect(
    await runtime.database
      .select({
        version: chapter.version,
        pagesVersion: chapter.pagesVersion,
        state: chapter.publicationState,
      })
      .from(chapter)
      .where(eq(chapter.id, targetId))
  ).toEqual([{ version: 1, pagesVersion: 0, state: "draft" }])
  expect(
    await runtime.database
      .select()
      .from(chapterPage)
      .where(eq(chapterPage.chapterId, targetId))
  ).toEqual([])
  expect(
    await runtime.database
      .select()
      .from(notification)
      .where(eq(notification.chapterId, targetId))
  ).toEqual([])
  expect(
    await runtime.database
      .select()
      .from(moderationAction)
      .where(
        and(
          eq(moderationAction.targetId, targetId),
          eq(moderationAction.action, "chapter.published")
        )
      )
  ).toEqual([])
}

describe.serial("Phase 8C/8D chapter management", () => {
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
    chapterDependencies = {
      assetBaseUrl: "http://localhost:9000/",
      cache: runtime.cache,
      database: runtime.database,
      logger: noop,
      storage,
    }
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "http://localhost:9000/",
      },
      chapterStorage: storage,
      logger: noop,
      webOrigin: origin,
    })

    const signedUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: `phase8c-${randomUUID()}@example.com`,
        name: "Phase 8C fixture",
        password: "phase8c-fixture-password",
      }),
    })
    expect(signedUp.status).toBe(200)
    userId = ((await signedUp.json()) as { user: { id: string } }).user.id
    cookie = signedUp.headers.get("set-cookie")!.split(";", 1)[0]!

    const memberId = randomUUID()
    await runtime.database.insert(organization).values({
      id: groupId,
      name: "Phase 8C group",
      slug: `phase-8c-${randomUUID()}`,
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
    await runtime.database.insert(organization).values({
      id: secondGroupId,
      name: "Phase 8C second group",
      slug: `phase-8c-second-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: secondGroupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: userId,
    })
    const [createdManga] = await runtime.database
      .insert(manga)
      .values({
        ownerGroupId: groupId,
        slug: `phase-8c-${randomUUID()}`,
        title: "Phase 8C manga",
        searchTitle: "phase 8c manga",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
        publicationState: "published",
        publishedAt: new Date(),
      })
      .returning({ id: manga.id })
    mangaId = createdManga!.id
    await runtime.database.insert(mangaGroup).values({ mangaId, groupId })
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database
      .delete(moderationAction)
      .where(eq(moderationAction.actorUserId, userId))
    if (mangaId)
      await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, secondGroupId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    await runtime.database.delete(user).where(eq(user.id, userId))
    await runtime.close()
  })

  test("management includes processing chapters while the reader excludes them", async () => {
    const incompleteId = randomUUID()
    const nativeId = randomUUID()
    await runtime.database.insert(chapter).values([
      {
        id: incompleteId,

        ownerGroupId: groupId,
        mangaId,
        uploaderUserId: userId,
        number: "999998",
        language: "vi",
        pageCount: 1,
        availablePageCount: 1,
        isFull: false,
        publicationState: "published",
        publishedAt: new Date(),
      },
      {
        id: nativeId,
        ownerGroupId: groupId,
        mangaId,
        uploaderUserId: userId,
        number: "999999",
        language: "vi",
        pageCount: 0,
        availablePageCount: 0,
        isFull: false,
        publicationState: "draft",
      },
    ])
    await runtime.database.insert(chapterGroup).values([
      { chapterId: incompleteId, groupId },
      { chapterId: nativeId, groupId },
    ])

    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    const list = (await (await request(`${root}?limit=100`)).json()) as {
      data: Array<{ id: string }>
    }
    expect(list.data.map(({ id }) => id)).toContain(nativeId)
    expect(list.data.map(({ id }) => id)).toContain(incompleteId)
    expect((await request(`${root}/${incompleteId}`)).status).toBe(200)
    expect((await app.request(`/v1/chapters/${incompleteId}`)).status).toBe(404)
    expect((await request(`${root}/${nativeId}`)).status).toBe(200)

    await runtime.database
      .delete(chapter)
      .where(sql`${chapter.id} in (${incompleteId}, ${nativeId})`)
  })

  test("uploads before creating a chapter and commits once", async () => {
    const chapterRoot = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    const stagingRoot = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapter-uploads`
    const createdSession = await request(stagingRoot, "POST")
    expect(createdSession.status).toBe(200)
    const session = (await createdSession.json()) as {
      data: { chapterId: string | null; id: string; mangaId: string }
    }
    expect(session.data).toMatchObject({ chapterId: null, mangaId })

    const source = await sharp(randomBytes(600 * 900 * 3), {
      raw: { width: 600, height: 900, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer()
    expect(source.byteLength).toBeGreaterThan(16_384)
    const pageId = randomUUID()
    expect(
      (
        await uploadPage(
          stagingRoot,
          session.data.id,
          pageId,
          new Blob([source], { type: "image/png" })
        )
      ).status
    ).toBe(200)
    expect(
      (
        await request(`${stagingRoot}/${session.data.id}/order`, "PUT", {
          pageIds: [pageId],
        })
      ).status
    ).toBe(200)

    const input = {
      number: "9.9",
      volumeNumber: null,
      title: "Staging commit",
      language: "vi",
    }
    await runtime.database
      .update(manga)
      .set({ publicationState: "draft" })
      .where(eq(manga.id, mangaId))
    const denied = [
      await request(chapterRoot, "POST", { ...input, number: "9.8" }),
      await request(stagingRoot, "POST"),
      await request(`${stagingRoot}/${session.data.id}/commit`, "POST", input),
    ]
    await runtime.database
      .update(manga)
      .set({ publicationState: "published" })
      .where(eq(manga.id, mangaId))
    for (const response of denied) {
      expect(response.status).toBe(409)
      expect((await response.json()) as unknown).toMatchObject({
        error: { code: "MANGA_NOT_PUBLISHED" },
      })
    }

    const [baseline] = await runtime.database
      .insert(chapter)
      .values({
        ownerGroupId: groupId,
        mangaId,
        number: input.number,
        language: input.language,
        pageCount: 0,
        availablePageCount: 0,
        isFull: false,
        isDefault: true,
      })
      .returning({ id: chapter.id })
    const committed = await request(
      `${stagingRoot}/${session.data.id}/commit`,
      "POST",
      input
    )
    expect(committed.status).toBe(201)
    const committedBody = (await committed.json()) as {
      data: { id: string; number: string }
    }
    expect(committedBody.data.number).toBe("9.9")
    expect(committedBody).toMatchObject({
      data: {
        isDefault: false,
      },
    })
    await runtime.database.delete(chapter).where(eq(chapter.id, baseline!.id))
    expect(
      (await (await request(chapterRoot)).json()) as unknown
    ).toMatchObject({
      data: [
        {
          id: committedBody.data.id,
          pageCount: 0,
          stagedPageCount: 1,
        },
      ],
    })

    const repeated = await request(
      `${stagingRoot}/${session.data.id}/commit`,
      "POST",
      input
    )
    expect(repeated.status).toBe(201)
    expect((await repeated.json()) as unknown).toMatchObject({
      data: { id: committedBody.data.id },
    })
    expect(
      await runtime.database
        .select({
          chapterId: chapterUploadSession.chapterId,
          mangaId: chapterUploadSession.mangaId,
        })
        .from(chapterUploadSession)
        .where(eq(chapterUploadSession.id, session.data.id))
    ).toEqual([{ chapterId: committedBody.data.id, mangaId }])

    expect(
      (
        await request(`${chapterRoot}/${committedBody.data.id}`, "DELETE", {
          expectedVersion: 1,
        })
      ).status
    ).toBe(204)
    await cleanupChapterUploads(runtime.database, storage, { apply: true })
    expect(objects.size).toBe(0)
  })

  test("creates, versions, uploads, resumes, reorders, cleans, and deletes", async () => {
    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    expect(
      (
        await request(root, "POST", {
          number: "1.2345",
          volumeNumber: null,
          title: null,
          language: "vi",
        })
      ).status
    ).toBe(400)
    const created = await request(root, "POST", {
      number: "1.0",
      volumeNumber: "1.0",
      title: "Khởi đầu",
      language: "vi",
    })
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as {
      data: {
        id: string
        number: string
        version: number
        publicationState: string
        volume: { id: string; number: string }
      }
    }
    chapterId = createdBody.data.id
    expect(createdBody.data).toMatchObject({
      number: "1",
      version: 1,
      publicationState: "draft",
      volume: { number: "1" },
    })
    expect(
      await runtime.database
        .select({ version: manga.version })
        .from(manga)
        .where(eq(manga.id, mangaId))
    ).toEqual([{ version: 2 }])
    const duplicate = await request(root, "POST", {
      number: "1",
      volumeNumber: "1",
      title: "Bản khác",
      language: "vi",
    })
    expect(duplicate.status).toBe(201)
    const duplicateBody = (await duplicate.json()) as { data: { id: string } }
    expect(duplicateBody).toMatchObject({
      data: {
        isDefault: false,
      },
    })
    expect(duplicateBody.data.id).not.toBe(chapterId)
    expect(
      (
        await request(`${root}/${duplicateBody.data.id}`, "DELETE", {
          expectedVersion: 1,
        })
      ).status
    ).toBe(204)
    expect((await app.request(`/v1/chapters/${chapterId}`)).status).toBe(404)
    expect(
      await runtime.database
        .select({ number: mangaVolume.number })
        .from(mangaVolume)
        .where(eq(mangaVolume.mangaId, mangaId))
    ).toHaveLength(1)

    const list = await request(root)
    expect(list.status).toBe(200)
    expect((await list.json()) as unknown).toMatchObject({
      data: [{ id: chapterId, number: "1", stagedPageCount: 0, version: 1 }],
      meta: { total: 1 },
    })

    const newerChapter = await request(root, "POST", {
      number: "2",
      volumeNumber: "0.5",
      title: null,
      language: "vi",
    })
    expect(newerChapter.status).toBe(201)
    const newerChapterId = (
      (await newerChapter.json()) as { data: { id: string } }
    ).data.id
    await runtime.database
      .update(chapter)
      .set({ updatedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(chapter.id, chapterId))
    await runtime.database
      .update(chapter)
      .set({ updatedAt: new Date("2026-01-02T00:00:00Z") })
      .where(eq(chapter.id, newerChapterId))
    expect(
      (
        (await (await request(`${root}?direction=desc`)).json()) as {
          data: { number: string | null }[]
        }
      ).data.map(({ number }) => number)
    ).toEqual(["2", "1"])
    expect(
      (
        (await (await request(`${root}?direction=asc`)).json()) as {
          data: { number: string | null }[]
        }
      ).data.map(({ number }) => number)
    ).toEqual(["1", "2"])
    expect(
      (
        (await (
          await request(`${root}?sort=volume&direction=desc`)
        ).json()) as {
          data: { number: string | null }[]
        }
      ).data.map(({ number }) => number)
    ).toEqual(["1", "2"])
    expect(
      (
        (await (
          await request(`${root}?sort=chapter&direction=desc`)
        ).json()) as {
          data: { number: string | null }[]
        }
      ).data.map(({ number }) => number)
    ).toEqual(["2", "1"])
    expect(
      (
        await request(`${root}/${newerChapterId}`, "DELETE", {
          expectedVersion: 1,
        })
      ).status
    ).toBe(204)

    expect(
      (
        await request(`${root}/${chapterId}`, "PUT", {
          number: "1.5",
          volumeNumber: "1",
          title: "Stale",
          language: "vi",
          expectedVersion: 2,
        })
      ).status
    ).toBe(409)
    const updated = await request(`${root}/${chapterId}`, "PUT", {
      number: "1.5",
      volumeNumber: "1",
      title: "Khởi đầu đã sửa",
      language: "vi",
      expectedVersion: 1,
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()) as unknown).toMatchObject({
      data: { id: chapterId, number: "1.5", version: 2 },
    })

    const session = await request(`${root}/${chapterId}/uploads`, "POST", {
      mode: "initial",
      expectedVersion: 2,
    })
    expect(session.status).toBe(200)
    const sessionBody = (await session.json()) as {
      data: { id: string; state: string; expiresAt: string }
    }
    const sessionId = sessionBody.data.id
    expect(sessionBody.data.state).toBe("open")
    expect(
      (
        (await (
          await request(`${root}/${chapterId}/uploads`, "POST", {
            mode: "initial",
            expectedVersion: 2,
          })
        ).json()) as { data: { id: string } }
      ).data.id
    ).toBe(sessionId)

    const source = await sharp(randomBytes(600 * 900 * 3), {
      raw: { width: 600, height: 900, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer()
    expect(source.byteLength).toBeGreaterThan(16_384)
    const firstPageId = randomUUID()
    const firstPage = await upload(
      root,
      sessionId,
      firstPageId,
      new Blob([source], { type: "image/png" })
    )
    expect(firstPage.status).toBe(200)
    const firstPageBody = (await firstPage.json()) as {
      data: { id: string; previewUrl: string }
    }
    const firstPagePreviewUrl = firstPageBody.data.previewUrl
    expect(firstPageBody as unknown).toMatchObject({
      data: {
        id: firstPageId,
        state: "ready",
        width: 600,
        height: 900,
        previewUrl: expect.stringContaining(firstPageId),
      },
    })
    expect(firstPagePreviewUrl.includes("/uploads/chapters/tmp/")).toBe(true)
    expect(firstPagePreviewUrl.includes("staging.example")).toBe(false)
    const preview = await app.request(firstPagePreviewUrl)
    expect(preview.status).toBe(200)
    expect(preview.headers.get("cache-control")).toBe("public, max-age=300")
    expect(preview.headers.get("content-type")).toContain("image/webp")
    expect((await preview.arrayBuffer()).byteLength).toBeGreaterThan(0)
    expect(objects.size).toBe(1)
    expect(
      (
        await upload(
          root,
          sessionId,
          firstPageId,
          new Blob([source], { type: "image/jpeg" })
        )
      ).status
    ).toBe(200)
    expect(objects.size).toBe(1)

    const different = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: "black",
      },
    })
      .png()
      .toBuffer()
    expect(
      (
        await upload(
          root,
          sessionId,
          firstPageId,
          new Blob([different], { type: "image/png" })
        )
      ).status
    ).toBe(409)
    expect(
      (
        await upload(
          root,
          sessionId,
          randomUUID(),
          new Blob([Buffer.from("BM invalid")], { type: "image/bmp" })
        )
      ).status
    ).toBe(400)

    const secondPageId = randomUUID()
    expect(
      (
        await upload(
          root,
          sessionId,
          secondPageId,
          new Blob([different], { type: "image/png" })
        )
      ).status
    ).toBe(200)
    const ordered = await request(
      `${root}/${chapterId}/uploads/${sessionId}/order`,
      "PUT",
      { pageIds: [secondPageId, firstPageId] }
    )
    expect(ordered.status).toBe(200)
    expect((await ordered.json()) as unknown).toMatchObject({
      data: {
        orderedPageIds: [secondPageId, firstPageId],
        pages: [{ state: "ready" }, { state: "ready" }],
      },
    })
    expect(
      (
        await request(
          `${root}/${chapterId}/uploads/${sessionId}/pages/${firstPageId}`,
          "DELETE"
        )
      ).status
    ).toBe(204)
    const status = await request(`${root}/${chapterId}/uploads/${sessionId}`)
    expect((await status.json()) as unknown).toMatchObject({
      data: {
        orderedPageIds: [secondPageId],
        pages: [
          {
            id: secondPageId,
            previewUrl: expect.stringContaining(secondPageId),
          },
        ],
      },
    })
    expect(
      (await request(`${root}/${chapterId}/uploads/${sessionId}`, "DELETE"))
        .status
    ).toBe(204)
    expect(
      await cleanupChapterUploads(runtime.database, storage, {
        apply: false,
      })
    ).toContainEqual({ id: sessionId, state: "cancelled" })
    expect(
      await cleanupChapterUploads(runtime.database, storage, { apply: true })
    ).toContainEqual({ id: sessionId, state: "cleaned" })
    expect(objects.size).toBe(0)
    expect(
      await runtime.database
        .select()
        .from(chapterUploadPage)
        .where(eq(chapterUploadPage.sessionId, sessionId))
    ).toHaveLength(0)

    const racedSession = await request(`${root}/${chapterId}/uploads`, "POST", {
      mode: "initial",
      expectedVersion: 2,
    })
    const racedSessionId = (
      (await racedSession.json()) as { data: { id: string } }
    ).data.id
    let cleanupDuringUpload: Awaited<ReturnType<typeof cleanupChapterUploads>> =
      []
    onPut = async () => {
      expect(
        (
          await request(
            `${root}/${chapterId}/uploads/${racedSessionId}`,
            "DELETE"
          )
        ).status
      ).toBe(204)
      cleanupDuringUpload = await cleanupChapterUploads(
        runtime.database,
        storage,
        { apply: true }
      )
    }
    expect(
      (
        await upload(
          root,
          racedSessionId,
          randomUUID(),
          new Blob([different], { type: "image/png" })
        )
      ).status
    ).toBe(409)
    expect(cleanupDuringUpload).not.toContainEqual({
      id: racedSessionId,
      state: "cleaned",
    })
    expect(
      await cleanupChapterUploads(runtime.database, storage, {
        apply: true,
        now: addMinutes(new Date(), 3),
      })
    ).toContainEqual({ id: racedSessionId, state: "cleaned" })
    expect(objects.size).toBe(0)

    const staleSession = await request(`${root}/${chapterId}/uploads`, "POST", {
      mode: "initial",
      expectedVersion: 2,
    })
    const staleSessionId = (
      (await staleSession.json()) as { data: { id: string } }
    ).data.id
    expect(
      (
        await request(`${root}/${chapterId}`, "PUT", {
          number: "1.5",
          volumeNumber: null,
          title: "Không còn volume",
          language: "vi",
          expectedVersion: 2,
        })
      ).status
    ).toBe(200)
    expect(
      (
        await upload(
          root,
          staleSessionId,
          randomUUID(),
          new Blob([different], { type: "image/png" })
        )
      ).status
    ).toBe(409)
    const currentSession = await request(
      `${root}/${chapterId}/uploads`,
      "POST",
      { mode: "initial", expectedVersion: 3 }
    )
    expect(currentSession.status).toBe(200)
    const currentSessionId = (
      (await currentSession.json()) as { data: { id: string } }
    ).data.id
    expect(currentSessionId).not.toBe(staleSessionId)

    expect(
      (
        await request(`${root}/${chapterId}`, "PUT", {
          number: "1.5",
          volumeNumber: null,
          title: "Ready to delete",
          language: "vi",
          expectedVersion: 3,
          uploadSessionId: currentSessionId,
        })
      ).status
    ).toBe(200)
    expect(
      (
        (await (
          await request(`${root}/${chapterId}/uploads/${currentSessionId}`)
        ).json()) as { data: { expectedChapterVersion: number } }
      ).data.expectedChapterVersion
    ).toBe(4)
    expect(
      (
        await request(
          `${root}/${chapterId}/uploads/${currentSessionId}/order`,
          "PUT",
          { pageIds: [] }
        )
      ).status
    ).toBe(200)

    expect(
      (
        await request(`${root}/${chapterId}`, "DELETE", {
          expectedVersion: 4,
        })
      ).status
    ).toBe(204)
    expect((await request(`${root}/${chapterId}`)).status).toBe(404)
    expect(
      await runtime.database
        .select({ state: chapterUploadSession.state })
        .from(chapterUploadSession)
        .where(eq(chapterUploadSession.id, currentSessionId))
    ).toEqual([{ state: "cancelled" }])
  })

  test("moving a pinned release into an occupied slot does not displace the destination default", async () => {
    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    const created = [] as Array<{ id: string }>
    for (const number of ["8.125", "9.125"]) {
      const response = await request(root, "POST", { number, language: "vi" })
      expect(response.status).toBe(201)
      const body = (await response.json()) as { data: { id: string } }
      expect(body).toMatchObject({
        data: {
          isDefault: true,
        },
      })
      created.push(body.data)
    }
    const input = { number: "9.125", language: "vi", expectedVersion: 1 }
    expect(
      (
        await request(`${root}/${created[0]!.id}`, "PUT", {
          ...input,
          sourceName: "forged",
        })
      ).status
    ).toBe(400)
    const moved = await request(`${root}/${created[0]!.id}`, "PUT", input)
    expect(moved.status).toBe(200)
    expect(await moved.json()).toMatchObject({
      data: {
        isDefault: false,
      },
    })
    expect(
      await (await request(`${root}/${created[1]!.id}`)).json()
    ).toMatchObject({ data: { isDefault: true } })
    for (const [i, row] of created.entries()) {
      expect(
        (
          await request(`${root}/${row.id}`, "DELETE", {
            expectedVersion: i === 0 ? 2 : 1,
          })
        ).status
      ).toBe(204)
    }
  })

  test("recomputes manga language and readability after published chapter edits", async () => {
    const publishedAt = new Date()
    const [published] = await runtime.database
      .insert(chapter)
      .values({
        ownerGroupId: groupId,
        mangaId,
        number: "2",
        title: "Published chapter",
        language: "vi",
        pageCount: 1,
        availablePageCount: 1,
        isFull: true,
        publicationState: "published",
        publishedAt,
      })
      .returning({ id: chapter.id })
    await runtime.database
      .insert(chapterGroup)
      .values({ chapterId: published!.id, groupId })
    await runtime.database
      .insert(mangaLanguage)
      .values({ mangaId, language: "vi" })
      .onConflictDoNothing()
    await runtime.database
      .update(manga)
      .set({ hasUsableChapters: true, latestChapterPublishedAt: publishedAt })
      .where(eq(manga.id, mangaId))

    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    const updated = await request(`${root}/${published!.id}`, "PUT", {
      number: "2",
      volumeNumber: null,
      title: "Published chapter edited",
      language: "en",
      expectedVersion: 1,
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()) as unknown).toMatchObject({
      data: { language: "en", version: 2 },
    })
    expect(
      await runtime.database
        .select({ language: mangaLanguage.language })
        .from(mangaLanguage)
        .where(eq(mangaLanguage.mangaId, mangaId))
    ).toEqual([{ language: "en" }])

    expect(
      (
        await request(`${root}/${published!.id}`, "DELETE", {
          expectedVersion: 2,
        })
      ).status
    ).toBe(204)
    expect(
      await runtime.database
        .select({
          hasUsableChapters: manga.hasUsableChapters,
          latestChapterPublishedAt: manga.latestChapterPublishedAt,
        })
        .from(manga)
        .where(eq(manga.id, mangaId))
    ).toEqual([{ hasUsableChapters: false, latestChapterPublishedAt: null }])
  })

  test("finalizes once and atomically replaces a published manifest", async () => {
    await runtime.database.insert(libraryItem).values({
      userId,
      mangaId,
      category: "following",
    })
    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    const created = await request(root, "POST", {
      number: "8.8",
      volumeNumber: null,
      title: "Finalize fixture",
      language: "vi",
    })
    expect(created.status).toBe(201)
    const draft = (await created.json()) as {
      data: { id: string; version: number }
    }
    const targetId = draft.data.id
    const opened = await request(`${root}/${targetId}/uploads`, "POST", {
      mode: "initial",
      expectedVersion: draft.data.version,
    })
    const sessionId = ((await opened.json()) as { data: { id: string } }).data
      .id
    const source = await sharp({
      create: {
        width: 80,
        height: 120,
        channels: 3,
        background: "white",
      },
    })
      .webp()
      .toBuffer()
    const firstPageId = randomUUID()
    const secondPageId = randomUUID()
    for (const pageId of [firstPageId, secondPageId])
      expect(
        (
          await uploadPage(
            `${root}/${targetId}/uploads`,
            sessionId,
            pageId,
            new Blob([source], { type: "image/webp" })
          )
        ).status
      ).toBe(200)
    const pageIds = [secondPageId, firstPageId]
    expect(
      (
        await request(`${root}/${targetId}/uploads/${sessionId}/order`, "PUT", {
          pageIds,
        })
      ).status
    ).toBe(200)

    const finalizePath = `${root}/${targetId}/uploads/${sessionId}/finalize`
    const finalizeInput = { expectedVersion: 1, pageIds }
    let concurrentWorker:
      { selected: number; processed: number; failed: number } | undefined
    const queued = await request(finalizePath, "POST", finalizeInput)
    expect(queued.status).toBe(202)
    expect(await queued.json()).toMatchObject({
      data: {
        processingState: "queued",
        publicationState: "draft",
      },
    })
    onCopy = async () => {
      concurrentWorker = await processChapterFinalizeJobs(chapterDependencies)
    }
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 1,
      failed: 0,
    })
    expect(concurrentWorker).toEqual({ selected: 0, processed: 0, failed: 0 })
    const finalized = await request(`${root}/${targetId}`)
    expect(finalized.status).toBe(200)
    const published = (await finalized.json()) as {
      data: {
        pageCount: number
        publicationState: string
        publishedAt: string
        version: number
      }
    }
    expect(published.data).toMatchObject({
      pageCount: 2,
      processingState: "idle",
      publicationState: "published",
      version: 2,
    })
    const initialKeys = [
      `data/${targetId}/001-${secondPageId}.webp`,
      `data/${targetId}/002-${firstPageId}.webp`,
    ]
    expect(
      await runtime.database
        .select({ key: chapterPage.originalKey })
        .from(chapterPage)
        .where(eq(chapterPage.chapterId, targetId))
        .orderBy(chapterPage.position)
    ).toEqual(initialKeys.map((key) => ({ key })))
    expect(
      (await (await app.request(`/v1/chapters/${targetId}`)).json()) as {
        pages: { url: string }[]
        uploader: { id: string | null; name: string }
      }
    ).toMatchObject({
      pages: initialKeys.map((key) => ({
        url: `http://localhost:9000/${key}`,
        replicaUrl: null,
      })),
      pagesVersion: 1,
      uploader: { id: userId, name: "Phase 8C fixture" },
    })
    const [chapterNotification] = await runtime.database
      .select({
        chapterId: notification.chapterId,
        id: notification.id,
        readAt: notification.readAt,
      })
      .from(notification)
      .where(
        and(eq(notification.userId, userId), eq(notification.mangaId, mangaId))
      )
    expect(chapterNotification).toMatchObject({
      chapterId: targetId,
      readAt: null,
    })
    const notificationReadAt = new Date()
    await runtime.database
      .update(notification)
      .set({ readAt: notificationReadAt })
      .where(eq(notification.id, chapterNotification!.id))

    expect((await request(finalizePath, "POST", finalizeInput)).status).toBe(
      202
    )
    expect(
      await runtime.database
        .select({ action: moderationAction.action })
        .from(moderationAction)
        .where(eq(moderationAction.targetId, targetId))
    ).toContainEqual({ action: "chapter.published" })
    expect(
      await cleanupChapterUploads(runtime.database, storage, {
        apply: true,
        now: addMinutes(new Date(), 3),
      })
    ).toContainEqual({ id: sessionId, state: "cleaned" })
    expect((await request(finalizePath, "POST", finalizeInput)).status).toBe(
      202
    )
    expect(initialKeys.every((key) => objects.has(key))).toBe(true)
    expect(
      await runtime.database
        .select({ pagesVersion: chapter.pagesVersion })
        .from(chapter)
        .where(eq(chapter.id, targetId))
    ).toEqual([{ pagesVersion: 1 }])

    const replacement = await request(`${root}/${targetId}/uploads`, "POST", {
      mode: "replacement",
      expectedVersion: 2,
    })
    const replacementData = (
      (await replacement.json()) as {
        data: {
          id: string
          orderedPageIds: string[]
          pages: { id: string; previewUrl: string }[]
        }
      }
    ).data
    const replacementId = replacementData.id
    expect(replacementData.orderedPageIds).toHaveLength(2)
    const previewById = new Map(
      replacementData.pages.map((page) => [page.id, page.previewUrl])
    )
    expect(
      replacementData.orderedPageIds.map((id) => previewById.get(id))
    ).toEqual(initialKeys.map((key) => `http://localhost:9000/${key}`))
    const replacementPageId = randomUUID()
    expect(
      (
        await uploadPage(
          `${root}/${targetId}/uploads`,
          replacementId,
          replacementPageId,
          new Blob([source], { type: "image/webp" })
        )
      ).status
    ).toBe(200)
    const replacementOrder = await request(
      `${root}/${targetId}/uploads/${replacementId}/order`,
      "PUT",
      { pageIds: [replacementPageId, replacementData.orderedPageIds[1]] }
    )
    expect(replacementOrder.status).toBe(200)
    expect(
      (
        await request(
          `${root}/${targetId}/uploads/${replacementId}/pages/${replacementData.orderedPageIds[0]}`,
          "DELETE"
        )
      ).status
    ).toBe(204)

    let readerPagesDuringCopy: string[] = []
    onCopy = async () => {
      readerPagesDuringCopy = (
        (await (await app.request(`/v1/chapters/${targetId}`)).json()) as {
          pages: { url: string }[]
        }
      ).pages.map(({ url }) => url)
    }
    const replaced = await request(
      `${root}/${targetId}/uploads/${replacementId}/finalize`,
      "POST",
      {
        expectedVersion: 2,
        pageIds: [replacementPageId, replacementData.orderedPageIds[1]],
      }
    )
    expect(replaced.status).toBe(202)
    expect(await replaced.json()).toMatchObject({
      data: { processingState: "queued", publicationState: "published" },
    })
    expect(readerPagesDuringCopy).toEqual([])
    expect(
      await processChapterFinalizeJobs({
        ...chapterDependencies,
        storage: {
          ...storage,
          copyToPublic: async () => {
            throw new Error("Injected replacement copy failure")
          },
        },
      })
    ).toEqual({ selected: 1, processed: 0, failed: 1 })
    expect(
      await runtime.database
        .select({ key: chapterPage.originalKey })
        .from(chapterPage)
        .where(eq(chapterPage.chapterId, targetId))
        .orderBy(chapterPage.position)
    ).toEqual(initialKeys.map((key) => ({ key })))
    expect(
      await (await app.request(`/v1/chapters/${targetId}`)).json()
    ).toMatchObject({
      pagesVersion: 1,
      pages: initialKeys.map((key) => ({
        url: `http://localhost:9000/${key}`,
      })),
    })
    expect(
      await runtime.database
        .select({
          chapterId: notification.chapterId,
          readAt: notification.readAt,
        })
        .from(notification)
        .where(eq(notification.id, chapterNotification!.id))
    ).toEqual([{ chapterId: targetId, readAt: notificationReadAt }])
    expect(
      (
        await request(
          `${root}/${targetId}/uploads/${replacementId}/finalize`,
          "POST",
          {
            expectedVersion: 2,
            pageIds: [replacementPageId, replacementData.orderedPageIds[1]],
          }
        )
      ).status
    ).toBe(202)
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 1,
      failed: 0,
    })
    const replacedChapter = await request(`${root}/${targetId}`)
    expect(
      await runtime.database
        .select({ pagesVersion: chapter.pagesVersion })
        .from(chapter)
        .where(eq(chapter.id, targetId))
    ).toEqual([{ pagesVersion: 2 }])
    expect({
      readerPagesDuringCopy,
      body: await replacedChapter.json(),
    }).toMatchObject({
      readerPagesDuringCopy: initialKeys.map(
        (key) => `http://localhost:9000/${key}`
      ),
      body: {
        data: {
          pageCount: 2,
          publicationState: "published",
          publishedAt: published.data.publishedAt,
          version: 3,
        },
      },
    })
    expect(
      await runtime.database
        .select({ key: chapterPage.originalKey })
        .from(chapterPage)
        .where(eq(chapterPage.chapterId, targetId))
        .orderBy(chapterPage.position)
    ).toEqual([
      { key: `data/${targetId}/001-${replacementPageId}.webp` },
      { key: initialKeys[1] },
    ])
    expect(
      await runtime.database
        .select({ action: moderationAction.action })
        .from(moderationAction)
        .where(eq(moderationAction.targetId, targetId))
    ).toContainEqual({ action: "chapter.pages_replaced" })
    expect(
      await runtime.database
        .select({
          chapterId: notification.chapterId,
          readAt: notification.readAt,
        })
        .from(notification)
        .where(eq(notification.id, chapterNotification!.id))
    ).toEqual([{ chapterId: targetId, readAt: notificationReadAt }])
    expect(
      await cleanupChapterUploads(runtime.database, storage, {
        apply: true,
        now: addMinutes(new Date(), 3),
      })
    ).toContainEqual({ id: replacementId, state: "cleaned" })
    expect(
      [`data/${targetId}/001-${replacementPageId}.webp`, initialKeys[1]].every(
        (key) => objects.has(key)
      )
    ).toBe(true)
  })

  test("cleans a copied orphan after the failed manifest page is deleted", async () => {
    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters`
    const created = await request(root, "POST", {
      number: "8.9",
      volumeNumber: null,
      title: "Finalize recovery fixture",
      language: "vi",
    })
    const draft = (await created.json()) as {
      data: { id: string; version: number }
    }
    const targetId = draft.data.id
    const opened = await request(`${root}/${targetId}/uploads`, "POST", {
      mode: "initial",
      expectedVersion: draft.data.version,
    })
    const sessionId = ((await opened.json()) as { data: { id: string } }).data
      .id
    const pageId = randomUUID()
    const source = await sharp({
      create: {
        width: 40,
        height: 60,
        channels: 3,
        background: "black",
      },
    })
      .webp()
      .toBuffer()
    expect(
      (
        await uploadPage(
          `${root}/${targetId}/uploads`,
          sessionId,
          pageId,
          new Blob([source], { type: "image/webp" })
        )
      ).status
    ).toBe(200)
    expect(
      (
        await request(`${root}/${targetId}/uploads/${sessionId}/order`, "PUT", {
          pageIds: [pageId],
        })
      ).status
    ).toBe(200)
    const finalizePath = `${root}/${targetId}/uploads/${sessionId}/finalize`
    const finalizeInput = { expectedVersion: 1, pageIds: [pageId] }

    await runtime.database
      .update(manga)
      .set({ publicationState: "draft" })
      .where(eq(manga.id, mangaId))
    expect((await request(finalizePath, "POST", finalizeInput)).status).toBe(
      409
    )
    await runtime.database
      .update(manga)
      .set({ publicationState: "published" })
      .where(eq(manga.id, mangaId))

    onCopy = async () => {
      await runtime.database
        .update(chapter)
        .set({ version: 2 })
        .where(eq(chapter.id, targetId))
    }
    expect((await request(finalizePath, "POST", finalizeInput)).status).toBe(
      202
    )
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 0,
      failed: 1,
    })
    const finalKey = `data/${targetId}/001-${pageId}.webp`
    expect(objects.has(finalKey)).toBe(true)
    expect(
      await runtime.database
        .select({ key: chapterUploadFinalObject.objectKey })
        .from(chapterUploadFinalObject)
        .where(eq(chapterUploadFinalObject.sessionId, sessionId))
    ).toEqual([{ key: finalKey }])
    expect((await app.request(`/v1/chapters/${targetId}`)).status).toBe(404)
    expect(
      await runtime.database
        .select({
          claim: chapterUploadSession.finalizeClaimToken,
          error: chapterUploadSession.finalizeError,
          state: chapterUploadSession.state,
        })
        .from(chapterUploadSession)
        .where(eq(chapterUploadSession.id, sessionId))
    ).toEqual([
      {
        claim: null,
        error: "Chapter changed since it was loaded",
        state: "open",
      },
    ])
    expect(
      (
        await request(`${root}/${targetId}`, "PUT", {
          number: "8.9",
          volumeNumber: null,
          title: "Finalize recovery fixture",
          language: "vi",
          expectedVersion: 2,
          uploadSessionId: sessionId,
        })
      ).status
    ).toBe(200)
    expect(
      (
        await request(
          `${root}/${targetId}/uploads/${sessionId}/pages/${pageId}`,
          "DELETE"
        )
      ).status
    ).toBe(204)

    await runtime.database
      .update(chapterUploadSession)
      .set({ expiresAt: subMinutes(new Date(), 1) })
      .where(eq(chapterUploadSession.id, sessionId))
    expect(
      await cleanupChapterUploads(runtime.database, storage, { apply: true })
    ).toContainEqual({ id: sessionId, state: "cleaned" })
    expect(objects.has(finalKey)).toBe(false)
    expect(
      await runtime.database
        .select({ key: chapterUploadFinalObject.objectKey })
        .from(chapterUploadFinalObject)
        .where(eq(chapterUploadFinalObject.sessionId, sessionId))
    ).toEqual([])
  })

  test("Phase 8F: completion failure rolls back manifest, projection, audit and notifications", async () => {
    const fixture = await createFinalizeFixture("109")
    const beforeManga = await runtime.database
      .select()
      .from(manga)
      .where(eq(manga.id, mangaId))
    const beforeNotifications = await runtime.database
      .select()
      .from(notification)
      .where(
        and(eq(notification.userId, userId), eq(notification.mangaId, mangaId))
      )
    const constraint = sql.identifier(
      `phase8f_rollback_${fixture.sessionId.replaceAll("-", "")}`
    )
    // A fixture-only DB failure at the last write exercises the real finalize
    // transaction, including writes made after fan-out. Never applied to dev DB.
    const fixtureUuid = sql.raw(`'${fixture.sessionId}'::uuid`)
    await runtime.database.execute(sql`
      alter table ${chapterUploadSession} add constraint ${constraint}
      check (id <> ${fixtureUuid} or state <> 'completed') not valid
    `)
    try {
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 1,
        processed: 0,
        failed: 1,
      })
      await expectUnpublished(fixture.targetId)
      expect(
        await runtime.database.select().from(manga).where(eq(manga.id, mangaId))
      ).toEqual(beforeManga)
      expect(
        await runtime.database
          .select()
          .from(notification)
          .where(
            and(
              eq(notification.userId, userId),
              eq(notification.mangaId, mangaId)
            )
          )
      ).toEqual(beforeNotifications)
      const finalKey = `data/${fixture.targetId}/001-${fixture.pageIds[0]}.webp`
      expect(objects.has(finalKey)).toBe(true)
      expect(
        await runtime.database
          .select({ key: chapterUploadFinalObject.objectKey })
          .from(chapterUploadFinalObject)
          .where(eq(chapterUploadFinalObject.sessionId, fixture.sessionId))
      ).toEqual([{ key: finalKey }])
    } finally {
      await runtime.database.execute(
        sql`alter table ${chapterUploadSession} drop constraint ${constraint}`
      )
    }
    expect(
      (await request(fixture.finalizePath, "POST", fixture.input)).status
    ).toBe(202)
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 1,
      failed: 0,
    })
    expect((await app.request(`/v1/chapters/${fixture.targetId}`)).status).toBe(
      200
    )
    expect(
      await runtime.database
        .select({ chapterId: notification.chapterId })
        .from(notification)
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.mangaId, mangaId)
          )
        )
    ).toEqual([{ chapterId: fixture.targetId }])
  })

  test("Phase 8F: partial copy and interrupted cleanup retain the orphan ledger until retry succeeds", async () => {
    const fixture = await createFinalizeFixture("100", 2)
    const finalKeys = fixture.pageIds.map(
      (id, index) =>
        `data/${fixture.targetId}/${String(index + 1).padStart(3, "0")}-${id}.webp`
    )
    expect(
      await processChapterFinalizeJobs({
        ...chapterDependencies,
        storage: {
          ...storage,
          async copyToPublic(source, target, checksum) {
            if (target === finalKeys[1])
              throw new Error("Injected second-page copy failure")
            await storage.copyToPublic(source, target, checksum)
          },
        },
      })
    ).toEqual({ selected: 1, processed: 0, failed: 1 })
    await expectUnpublished(fixture.targetId)
    expect(objects.has(finalKeys[0]!)).toBe(true)
    expect(objects.has(finalKeys[1]!)).toBe(false)
    await runtime.database
      .update(chapterUploadSession)
      .set({ expiresAt: subMinutes(new Date(), 1) })
      .where(eq(chapterUploadSession.id, fixture.sessionId))
    const cleanupTime = new Date()
    let finalizeWhileCleaning: number | undefined
    expect(
      await cleanupChapterUploads(
        runtime.database,
        {
          ...storage,
          async deletePublic(key) {
            if (key === finalKeys[0]) {
              finalizeWhileCleaning = (
                await request(fixture.finalizePath, "POST", fixture.input)
              ).status
              throw new Error("Injected cleanup interruption")
            }
            await storage.deletePublic(key)
          },
        },
        { apply: true, now: cleanupTime }
      )
    ).toContainEqual({ id: fixture.sessionId, state: "cleaning" })
    expect(finalizeWhileCleaning).toBe(409)
    expect(
      await runtime.database
        .select({ key: chapterUploadFinalObject.objectKey })
        .from(chapterUploadFinalObject)
        .where(eq(chapterUploadFinalObject.sessionId, fixture.sessionId))
        .orderBy(chapterUploadFinalObject.objectKey)
    ).toEqual(finalKeys.map((key) => ({ key })))
    expect(objects.has(finalKeys[0]!)).toBe(true)
    expect(
      await cleanupChapterUploads(runtime.database, storage, {
        apply: true,
        now: addMinutes(cleanupTime, 3),
      })
    ).toContainEqual({ id: fixture.sessionId, state: "cleaned" })
    expect(finalKeys.some((key) => objects.has(key))).toBe(false)
    expect(
      await runtime.database
        .select()
        .from(chapterUploadFinalObject)
        .where(eq(chapterUploadFinalObject.sessionId, fixture.sessionId))
    ).toEqual([])
    expect(
      await runtime.database
        .select()
        .from(chapterUploadPage)
        .where(eq(chapterUploadPage.sessionId, fixture.sessionId))
    ).toEqual([])
  })

  test.each([
    ["source size", "head", { contentLength: 0 }, "101"],
    ["source MIME", "head", { contentType: "image/png" }, "102"],
    ["target size", "headPublic", { contentLength: 0 }, "103"],
    ["target MIME", "headPublic", { contentType: "image/png" }, "104"],
    ["target cache policy", "headPublic", { cacheControl: "no-store" }, "105"],
    ["target checksum", "headPublic", { metadata: { sha256: "wrong" } }, "106"],
  ] as const)(
    "Phase 8F: rejects invalid %s before publishing",
    async (_name, method, mismatch, number) => {
      const fixture = await createFinalizeFixture(number)
      expect(
        await processChapterFinalizeJobs({
          ...chapterDependencies,
          storage: {
            ...storage,
            [method]: async (key: string) => ({
              ...(await storage[method](key)),
              ...mismatch,
            }),
          },
        })
      ).toEqual({ selected: 1, processed: 0, failed: 1 })
      await expectUnpublished(fixture.targetId)
      expect(
        (await request(fixture.finalizePath, "POST", fixture.input)).status
      ).toBe(202)
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 1,
        processed: 1,
        failed: 0,
      })
      expect(
        (await app.request(`/v1/chapters/${fixture.targetId}`)).status
      ).toBe(200)
    }
  )

  test("Phase 8F: cleanup skips a live claim and a stale worker cannot commit after takeover", async () => {
    const fixture = await createFinalizeFixture("107")
    let takeover:
      Awaited<ReturnType<typeof processChapterFinalizeJobs>> | undefined
    onCopy = async () => {
      await runtime.database
        .update(chapterUploadSession)
        .set({ expiresAt: subMinutes(new Date(), 1) })
        .where(eq(chapterUploadSession.id, fixture.sessionId))
      const cleaned = await cleanupChapterUploads(runtime.database, storage, {
        apply: true,
      })
      expect(cleaned.some(({ id }) => id === fixture.sessionId)).toBe(false)
      await runtime.database
        .update(chapterUploadSession)
        .set({ finalizeClaimExpiresAt: subMinutes(new Date(), 1) })
        .where(eq(chapterUploadSession.id, fixture.sessionId))
      takeover = await processChapterFinalizeJobs(chapterDependencies)
    }
    try {
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 1,
        processed: 0,
        failed: 0,
      })
      expect(takeover).toEqual({ selected: 1, processed: 1, failed: 0 })
      expect(
        await runtime.database
          .select({
            version: chapter.version,
            pagesVersion: chapter.pagesVersion,
          })
          .from(chapter)
          .where(eq(chapter.id, fixture.targetId))
      ).toEqual([{ version: 2, pagesVersion: 1 }])
      expect(
        await runtime.database
          .select({ action: moderationAction.action })
          .from(moderationAction)
          .where(
            and(
              eq(moderationAction.targetId, fixture.targetId),
              eq(moderationAction.action, "chapter.published")
            )
          )
      ).toHaveLength(1)
      expect(
        (await request(fixture.finalizePath, "POST", fixture.input)).status
      ).toBe(202)
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 0,
        processed: 0,
        failed: 0,
      })
    } finally {
      onCopy = undefined
    }
  })

  test("Phase 8F: rechecks contributor permissions after copying", async () => {
    const fixture = await createFinalizeFixture("108")
    const ownMembership = and(
      eq(member.organizationId, groupId),
      eq(member.userId, userId)
    )
    onCopy = async () => {
      await runtime.database
        .update(member)
        .set({ role: "member" })
        .where(ownMembership)
    }
    try {
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 1,
        processed: 0,
        failed: 1,
      })
      await expectUnpublished(fixture.targetId)
      expect(
        await runtime.database
          .select({ error: chapterUploadSession.finalizeError })
          .from(chapterUploadSession)
          .where(eq(chapterUploadSession.id, fixture.sessionId))
      ).toEqual([{ error: "Chapter add permission is required" }])
    } finally {
      onCopy = undefined
      await runtime.database
        .update(member)
        .set({ role: "owner" })
        .where(ownMembership)
    }
    expect(
      (await request(fixture.finalizePath, "POST", fixture.input)).status
    ).toBe(202)
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 1,
      failed: 0,
    })
  })

  test("Phase 9A: moderator hide during copy blocks commit and keeps the orphan ledger", async () => {
    const fixture = await createFinalizeFixture("110")
    onCopy = async () => {
      await runtime.database
        .update(chapter)
        .set({ moderationHiddenAt: new Date() })
        .where(eq(chapter.id, fixture.targetId))
    }
    try {
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 1,
        processed: 0,
        failed: 1,
      })
      await expectUnpublished(fixture.targetId)
      expect(
        await runtime.database
          .select({ key: chapterUploadFinalObject.objectKey })
          .from(chapterUploadFinalObject)
          .where(eq(chapterUploadFinalObject.sessionId, fixture.sessionId))
      ).toHaveLength(1)
    } finally {
      onCopy = undefined
      await runtime.database
        .update(chapter)
        .set({ moderationHiddenAt: null })
        .where(eq(chapter.id, fixture.targetId))
    }
    expect(
      (await request(fixture.finalizePath, "POST", fixture.input)).status
    ).toBe(202)
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 1,
      failed: 0,
    })
    const [publishedPage] = await runtime.database
      .select({ key: chapterPage.originalKey })
      .from(chapterPage)
      .where(eq(chapterPage.chapterId, fixture.targetId))
    expect(publishedPage).toBeDefined()
    await runtime.database
      .update(chapter)
      .set({ moderationHiddenAt: new Date() })
      .where(eq(chapter.id, fixture.targetId))
    await cleanupChapterUploads(runtime.database, storage, {
      apply: true,
      now: addMinutes(new Date(), 181),
    })
    expect(
      await runtime.database
        .select({ key: chapterPage.originalKey })
        .from(chapterPage)
        .where(eq(chapterPage.chapterId, fixture.targetId))
    ).toEqual([{ key: publishedPage!.key }])
    expect(objects.has(publishedPage!.key)).toBe(true)
    await runtime.database
      .update(chapter)
      .set({ moderationHiddenAt: null })
      .where(eq(chapter.id, fixture.targetId))
  })

  test("Phase 9C: account restriction during copy blocks finalize until restore", async () => {
    const fixture = await createFinalizeFixture("111")
    onCopy = async () => {
      const now = new Date()
      await runtime.database
        .update(userProfile)
        .set({
          status: "suspended",
          moderatedAt: now,
          moderationReason: "account suspended by administrator",
          updatedAt: now,
        })
        .where(eq(userProfile.userId, userId))
    }
    try {
      expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
        selected: 1,
        processed: 0,
        failed: 1,
      })
      await expectUnpublished(fixture.targetId)
      expect(
        await runtime.database
          .select({ id: notification.id })
          .from(notification)
          .where(eq(notification.chapterId, fixture.targetId))
      ).toHaveLength(0)
    } finally {
      onCopy = undefined
      await runtime.database
        .update(userProfile)
        .set({
          status: "active",
          moderatedAt: null,
          moderatedByUserId: null,
          moderationReason: null,
          updatedAt: new Date(),
        })
        .where(eq(userProfile.userId, userId))
    }
    expect(
      (await request(fixture.finalizePath, "POST", fixture.input)).status
    ).toBe(202)
    expect(await processChapterFinalizeJobs(chapterDependencies)).toEqual({
      selected: 1,
      processed: 1,
      failed: 0,
    })
  })

  test("keeps chapters manageable while the manga is hidden", async () => {
    const root = `/v1/contribution/groups/${groupId}/manga/${mangaId}`
    await runtime.database
      .update(manga)
      .set({ publicationState: "hidden" })
      .where(eq(manga.id, mangaId))
    try {
      expect((await request(`${root}/chapters`)).status).toBe(200)
      expect((await request(`${root}/chapter-uploads`, "POST")).status).toBe(
        200
      )
    } finally {
      await runtime.database
        .update(manga)
        .set({ publicationState: "published" })
        .where(eq(manga.id, mangaId))
    }
  })
})
