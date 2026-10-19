import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { formatISO, subSeconds } from "date-fns"
import { asc, eq, ne, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase } from "../../src/db/client"
import {
  chapter,
  chapterPage,
  chapterTikTokReplica as replica,
  imageServer2Control,
  manga,
  moderationAction,
  organization,
  user,
  userProfile,
} from "../../src/db/schema"
import { createApp } from "../../src/app"
import type { Auth } from "../../src/features/account/auth"
import {
  checkpointReplica,
  claimReplica,
  discoverReplicas,
  failReplica,
  finishReplica,
  heartbeatReplica,
  operateReplica,
  processReplica,
  readyReplicaUrls,
  type ReplicaDependencies,
} from "../../src/features/image-server2/service"
import { ReplicaError } from "../../src/features/image-server2/tiktok"
import {
  BusinessCache,
  stableHash,
  type CacheResource,
} from "../../src/shared/cache"
import { parseImageServer2Env } from "../../src/shared/env"

setDefaultTimeout(60_000)
const parentId = randomUUID()
const ownerGroupId = randomUUID()
const actor = randomUUID()
let db: ReturnType<typeof createDatabase>["db"]
let pool: ReturnType<typeof createDatabase>["pool"]
let deps: ReplicaDependencies
let cache: BusinessCache
let savedControl: typeof imageServer2Control.$inferSelect | undefined
const noop = () => {}
const origin = "http://localhost:3000"
const adminBase = "/v1/admin/image-server2"
function adminApp() {
  return createApp({
    auth: {
      api: {
        getSession: async ({ headers }: { headers: Headers }) =>
          headers.get("x-test-user")
            ? { user: { id: headers.get("x-test-user") } }
            : null,
      },
    } as unknown as Auth,
    catalog: {
      database: db,
      cache,
      assetBaseUrl: "https://assets.example/",
      ...deps.visibility,
      imageServer2ReadEnabled: true,
    },
    imageServer2UploadEnabled: true,
    rateLimit: {},
    logger: noop,
    webOrigin: origin,
  })
}
function adminRequest(path: string, method = "GET", body?: unknown) {
  return adminApp().request(`${adminBase}${path}`, {
    method,
    headers: {
      "x-test-user": actor,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const uploaded = (position: string) => ({
  uri: `tos-test/${position}`,
  url: `https://p21-ad-sg.ibyteimg.com/obj/tos-test/${position}`,
  format: "png",
  byteSize: 100,
  verifiedAt: formatISO(new Date()),
})

async function fixture(version = 1, positions = [0, 1]) {
  const id = randomUUID()
  await db.insert(chapter).values({
    ownerGroupId,
    id,
    mangaId: parentId,
    language: "vi",
    pageCount: 2,
    availablePageCount: 2,
    isFull: true,
    publicationState: "published",
    publishedAt: new Date(),
    pagesVersion: version,
  })
  await db.insert(chapterPage).values(
    positions.map((position) => ({
      chapterId: id,
      position,
      originalKey: `data/${id}/${position}.webp`,
      width: 40,
      height: 80,
    }))
  )
  return id
}
const jobFor = async (id: string) =>
  (await db.select().from(replica).where(eq(replica.chapterId, id)))[0]!
async function freshJob() {
  const id = await fixture()
  await discoverReplicas(deps)
  // Prior tests finish/fail their work; claim is deliberately exercised without a per-ID shortcut.
  const job = await claimReplica(deps)
  expect(job?.chapterId).toBe(id)
  return job!
}
async function terminate(id: string) {
  await db
    .update(replica)
    .set({ state: "failed", claimToken: null, claimExpiresAt: null })
    .where(eq(replica.chapterId, id))
}

describe.serial("TikTok durable replicas", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    ;({ db, pool } = createDatabase(url))
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    ;[savedControl] = await db.select().from(imageServer2Control)
    await db
      .insert(imageServer2Control)
      .values({ id: 1, enabled: true })
      .onConflictDoUpdate({
        target: imageServer2Control.id,
        set: { enabled: true },
      })
    await db.insert(organization).values({
      id: ownerGroupId,
      name: "SV2 owner group",
      slug: `sv2-owner-${ownerGroupId}`,
      createdAt: new Date(),
    })
    await db.insert(manga).values({
      ownerGroupId,
      id: parentId,
      slug: `sv2-${parentId}`,
      title: "SV2 fixture",
      searchTitle: "sv2 fixture",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      hasUsableChapters: true,
    })
    const hidden = await db
      .select({ id: manga.id })
      .from(manga)
      .where(ne(manga.id, parentId))
    deps = {
      database: db,
      visibility: {
        hideR18: true,
        hiddenMangaIds: hidden.map((row) => row.id),
      },
    }
    await db.insert(user).values({
      id: actor,
      name: "SV2 operator",
      email: `${actor}@example.invalid`,
      role: "admin",
    })
    await db.insert(userProfile).values({ userId: actor })
    cache = new BusinessCache(
      parseImageServer2Env({
        DATABASE_URL: url,
        ASSET_BASE_URL: "https://assets.example/",
      }),
      noop
    )
  })
  afterAll(async () => {
    if (!db) return
    if (savedControl)
      await db
        .update(imageServer2Control)
        .set(savedControl)
        .where(eq(imageServer2Control.id, 1))
    else
      await db.delete(imageServer2Control).where(eq(imageServer2Control.id, 1))
    await db
      .delete(moderationAction)
      .where(eq(moderationAction.actorUserId, actor))
    await db.delete(manga).where(eq(manga.id, parentId))
    await db.delete(organization).where(eq(organization.id, ownerGroupId))
    await db.delete(user).where(eq(user.id, actor))
    await cache?.close()
    await pool.end()
  })

  test("legacy generation stays opt-in; operator must be active admin and writes audit", async () => {
    const id = await fixture(0)
    await discoverReplicas(deps)
    expect(await jobFor(id)).toBeUndefined()
    let denied = false
    try {
      await operateReplica(deps, id, {
        action: "enqueue",
        reset: false,
        actor: "not-admin",
      })
    } catch {
      denied = true
    }
    expect(denied).toBe(true)
    expect(
      await operateReplica(deps, id, {
        action: "enqueue",
        reset: false,
        actor,
      })
    ).toBe(true)
    expect((await jobFor(id)).sourceVersion).toBe(0)
    expect(
      await operateReplica(deps, id, {
        action: "enqueue",
        reset: false,
        actor,
      })
    ).toBe(false)
    expect(
      await db
        .select()
        .from(moderationAction)
        .where(eq(moderationAction.targetId, id))
    ).toHaveLength(1)
    await terminate(id)
  })

  test("two workers cannot own one job; concurrent checkpoints preserve both pages", async () => {
    const id = await fixture()
    await Promise.all([discoverReplicas(deps), discoverReplicas(deps)])
    const claims = await Promise.all([claimReplica(deps), claimReplica(deps)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    const job = claims.find(Boolean)!
    expect(await heartbeatReplica(deps, job)).toBe(true)
    expect(await finishReplica(deps, job)).toBe(false)
    expect(
      await Promise.all(
        [0, 1].map((position) =>
          checkpointReplica(deps, job, position, {
            ...job.pages[String(position)]!,
            ...uploaded(String(position)),
          })
        )
      )
    ).toEqual([true, true])
    expect(await finishReplica(deps, job)).toBe(true)
    const done = await jobFor(id)
    const pages = await db
      .select()
      .from(chapterPage)
      .where(eq(chapterPage.chapterId, id))
      .orderBy(chapterPage.position)
    expect(readyReplicaUrls(pages, 1, done)).toHaveLength(2)
    expect(readyReplicaUrls(pages, 2, done)).toBeNull()
    expect(
      readyReplicaUrls(
        [{ ...pages[0]!, originalKey: "new.webp" }, pages[1]!],
        1,
        done
      )
    ).toBeNull()
    expect(
      readyReplicaUrls(pages, 1, { ...done, pages: { "0": done.pages["0"]! } })
    ).toBeNull()
  })

  test("reader returns only complete matching replica; disabled read and partial job use S1", async () => {
    const job = await freshJob()
    const enabled = createApp({
      catalog: {
        database: db,
        cache,
        assetBaseUrl: "https://assets.example/",
        imageServer2ReadEnabled: true,
      },
      logger: noop,
    })
    const disabled = createApp({
      catalog: { database: db, cache, assetBaseUrl: "https://assets.example/" },
      logger: noop,
    })
    const read = async (app: ReturnType<typeof createApp>) =>
      (await (await app.request(`/v1/chapters/${job.chapterId}`)).json()) as {
        pagesVersion: number
        pages: { url: string; replicaUrl: string | null }[]
      }
    await checkpointReplica(deps, job, 0, {
      ...job.pages["0"]!,
      ...uploaded("0"),
    })
    expect((await read(enabled)).pages.map((page) => page.replicaUrl)).toEqual([
      null,
      null,
    ])
    await checkpointReplica(deps, job, 1, {
      ...job.pages["1"]!,
      ...uploaded("1"),
    })
    await finishReplica(deps, job)
    const result = await read(enabled)
    expect(result.pagesVersion).toBe(1)
    expect(result.pages.map((page) => page.replicaUrl)).toEqual([
      uploaded("0").url,
      uploaded("1").url,
    ])
    expect(result.pages[0]!.url).toContain("https://assets.example/data/")
    expect((await read(disabled)).pages.map((page) => page.replicaUrl)).toEqual(
      [null, null]
    )
    await db.transaction(async (tx) => {
      await tx
        .update(chapter)
        .set({ pagesVersion: 2 })
        .where(eq(chapter.id, job.chapterId))
      await tx
        .update(chapterPage)
        .set({ originalKey: "data/new.webp" })
        .where(eq(chapterPage.chapterId, job.chapterId))
    })
    expect((await read(enabled)).pages.map((page) => page.replicaUrl)).toEqual([
      null,
      null,
    ])
    await discoverReplicas(deps)
    expect((await jobFor(job.chapterId)).sourceVersion).toBe(2)
    await terminate(job.chapterId)
  })

  test("replacement rejects old callbacks, metadata changes keep generation, rollback creates no work", async () => {
    const job = await freshJob()
    await db
      .update(chapter)
      .set({ title: "metadata", version: 2 })
      .where(eq(chapter.id, job.chapterId))
    await discoverReplicas(deps)
    expect((await jobFor(job.chapterId)).claimToken).toBe(job.claimToken)
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx
          .update(chapter)
          .set({ pagesVersion: 2 })
          .where(eq(chapter.id, job.chapterId))
        throw new Error("rollback")
      }),
      /rollback/
    )
    expect(await heartbeatReplica(deps, job)).toBe(true)
    await db
      .update(chapter)
      .set({ pagesVersion: 2 })
      .where(eq(chapter.id, job.chapterId))
    expect(
      await checkpointReplica(deps, job, 0, {
        ...job.pages["0"]!,
        ...uploaded("late"),
      })
    ).toBeNull()
    await discoverReplicas(deps)
    expect((await jobFor(job.chapterId)).pages["0"]!.url).toBeNull()
    expect(await finishReplica(deps, job)).toBeNull()
    await terminate(job.chapterId)
  })

  test("expired leases are reclaimable; late owner cannot overwrite a new token", async () => {
    const first = await freshJob()
    await db
      .update(replica)
      .set({ claimExpiresAt: subSeconds(new Date(), 1) })
      .where(eq(replica.chapterId, first.chapterId))
    expect(await heartbeatReplica(deps, first)).toBeNull()
    const next = await claimReplica(deps)
    expect(next!.claimToken).not.toBe(first.claimToken)
    expect(next!.attempts).toBe(2)
    expect(
      await checkpointReplica(deps, first, 0, {
        ...first.pages["0"]!,
        ...uploaded("old"),
      })
    ).toBeNull()
    await failReplica(deps, first, new ReplicaError("AUTH_REQUIRED"))
    expect((await jobFor(first.chapterId)).claimToken).toBe(next!.claimToken)
    await terminate(first.chapterId)
  })

  test("hidden/deleted/emergency-hidden pages cannot checkpoint or expose replicas", async () => {
    const job = await freshJob()
    const hiddenDeps = {
      ...deps,
      visibility: { ...deps.visibility, hiddenChapterIds: [job.chapterId] },
    }
    expect(await heartbeatReplica(hiddenDeps, job)).toBeNull()
    await db
      .update(manga)
      .set({ publicationState: "hidden" })
      .where(eq(manga.id, parentId))
    expect(
      await checkpointReplica(deps, job, 0, {
        ...job.pages["0"]!,
        ...uploaded("hidden"),
      })
    ).toBeNull()
    await failReplica(deps, job, new ReplicaError("CLAIM_ABORTED", true))
    expect((await jobFor(job.chapterId)).state).toBe("pending")
    expect(await claimReplica(deps)).toBeNull()
    await db
      .update(manga)
      .set({ publicationState: "published" })
      .where(eq(manga.id, parentId))
    const resumed = await claimReplica(deps)
    expect(resumed?.chapterId).toBe(job.chapterId)
    await db.delete(chapter).where(eq(chapter.id, job.chapterId))
    expect(await jobFor(job.chapterId)).toBeUndefined()
    expect(await heartbeatReplica(deps, resumed!)).toBeNull()
  })

  test("transient retries retain checkpoints, stop after five attempts, explicit reset clears them", async () => {
    const job = await freshJob()
    await checkpointReplica(deps, job, 0, {
      ...job.pages["0"]!,
      ...uploaded("done"),
    })
    await failReplica(deps, job, new ReplicaError("HTTP_503", true))
    expect((await jobFor(job.chapterId)).state).toBe("retry_wait")
    expect(await claimReplica(deps)).toBeNull()
    await db
      .update(replica)
      .set({ nextRetryAt: subSeconds(new Date(), 1), attempts: 4 })
      .where(eq(replica.chapterId, job.chapterId))
    const last = await claimReplica(deps)
    expect(last!.attempts).toBe(5)
    expect(last!.pages["0"]!.url).toBe(uploaded("done").url)
    await failReplica(deps, last!, new ReplicaError("HTTP_503", true))
    await discoverReplicas(deps)
    expect((await jobFor(job.chapterId)).state).toBe("failed")
    expect(await claimReplica(deps)).toBeNull()
    await operateReplica(deps, job.chapterId, {
      action: "retry",
      reset: false,
      actor,
    })
    expect((await jobFor(job.chapterId)).pages["0"]!.url).not.toBeNull()
    await operateReplica(deps, job.chapterId, {
      action: "retry",
      reset: true,
      actor,
    })
    expect((await jobFor(job.chapterId)).pages["0"]!.url).toBeNull()
    await terminate(job.chapterId)
  })

  test("process resumes only missing pages and auth failure terminates worker loop", async () => {
    const job = await freshJob()
    await checkpointReplica(deps, job, 0, {
      ...job.pages["0"]!,
      ...uploaded("done"),
    })
    const current = await jobFor(job.chapterId)
    let uploads = 0
    expect(
      await processReplica(
        deps,
        current,
        async () => {
          uploads++
          return uploaded("new")
        },
        new AbortController().signal
      )
    ).toBe(true)
    expect(uploads).toBe(1)
    const authJob = await freshJob()
    await assert.rejects(
      processReplica(
        deps,
        authJob,
        async () => {
          throw new ReplicaError("AUTH_REQUIRED")
        },
        new AbortController().signal
      ),
      /AUTH_REQUIRED/
    )
    expect(await jobFor(authJob.chapterId)).toMatchObject({
      state: "failed",
      lastErrorCode: "AUTH_REQUIRED",
    })
  })

  test("migration indexes support discovery and due scans", async () => {
    const indexes = await db.execute(
      sql`select indexname from pg_indexes where tablename in ('chapter', 'chapter_tiktok_replica')`
    )
    expect(indexes.rows.map((row) => row.indexname)).toContain(
      "chapter_replica_discovery_idx"
    )
    expect(indexes.rows.map((row) => row.indexname)).toContain(
      "chapter_tiktok_replica_due_idx"
    )
    const explained = await db.execute(
      sql`explain (format json) select chapter_id from chapter_tiktok_replica where state in ('pending', 'retry_wait') and next_retry_at <= now() limit 20`
    )
    expect(explained.rows.length).toBe(1)
  })

  test("replicas preserve imported one-based and sparse page positions from enqueue through reader", async () => {
    for (const [version, positions] of [
      [0, [1, 2]],
      [1, [1, 4]],
    ] as const) {
      const id = await fixture(version, [...positions])
      const source = await db
        .select()
        .from(chapterPage)
        .where(eq(chapterPage.chapterId, id))
        .orderBy(asc(chapterPage.position))
      if (version === 0) {
        const result = await (
          await adminRequest("/jobs", "POST", {
            action: "enqueue",
            chapterIds: [id],
          })
        ).json()
        expect(result).toMatchObject({ applied: 1, errors: [] })
      } else {
        await discoverReplicas(deps)
      }
      const job = await claimReplica(deps)
      expect(job?.chapterId).toBe(id)
      expect(Object.keys(job!.pages)).toEqual(positions.map(String))
      expect(
        await processReplica(
          deps,
          job!,
          async (page) => uploaded(page.originalKey.split("/").at(-1)!),
          new AbortController().signal
        )
      ).toBe(true)
      const done = await jobFor(id)
      expect(readyReplicaUrls(source, version, done)).toEqual(
        positions.map((position) => uploaded(`${position}.webp`).url)
      )
      expect(
        readyReplicaUrls(
          [{ ...source[0]!, position: 0 }, source[1]!],
          version,
          done
        )
      ).toBeNull()
      const reader = await (
        await adminApp().request(`/v1/chapters/${id}`)
      ).json()
      expect(
        reader.pages.map((page: { replicaUrl: string }) => page.replicaUrl)
      ).toEqual(positions.map((position) => uploaded(`${position}.webp`).url))
      expect(
        await db
          .select()
          .from(chapterPage)
          .where(eq(chapterPage.chapterId, id))
          .orderBy(asc(chapterPage.position))
      ).toEqual(source)
    }
  })

  test("admin API enforces active admin, trusted origin, validation and private responses", async () => {
    const app = adminApp()
    const publicBurst = await Promise.all(
      Array.from({ length: 11 }, () => app.request("/health"))
    )
    expect(publicBurst.some(({ status }) => status === 429)).toBe(true)
    expect((await app.request(`${adminBase}/worker`)).status).toBe(401)
    const response = await app.request(`${adminBase}/worker`, {
      headers: { "x-test-user": actor },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual({
      enabled: true,
      uploadConfigured: true,
      readEnabled: true,
    })
    expect(
      (
        await adminApp().request(`${adminBase}/worker`, {
          method: "PUT",
          headers: { "x-test-user": actor, "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        })
      ).status
    ).toBe(403)
    expect(
      (await adminRequest("/worker", "PUT", { enabled: "false" })).status
    ).toBe(400)
    expect(
      (
        await adminRequest("/jobs", "POST", {
          action: "enqueue",
          chapterIds: [randomUUID()],
          mangaIds: [parentId],
        })
      ).status
    ).toBe(400)
    expect(
      (
        await adminRequest("/jobs", "POST", {
          action: "enqueue",
          chapterIds: Array.from({ length: 101 }, randomUUID),
        })
      ).status
    ).toBe(400)
    expect((await adminRequest("/mangas?page=0")).status).toBe(400)
    try {
      await db.update(user).set({ role: "user" }).where(eq(user.id, actor))
      expect((await adminRequest("/worker")).status).toBe(403)
      expect(
        (await adminRequest("/worker", "PUT", { enabled: false })).status
      ).toBe(403)
      await db.update(user).set({ role: "admin" }).where(eq(user.id, actor))
      await db
        .update(userProfile)
        .set({
          status: "banned",
          moderatedAt: new Date(),
          moderationReason: "Test restriction",
        })
        .where(eq(userProfile.userId, actor))
      expect((await adminRequest("/mangas")).status).toBe(403)
    } finally {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, actor))
      await db
        .update(userProfile)
        .set({ status: "active", moderatedAt: null, moderationReason: null })
        .where(eq(userProfile.userId, actor))
    }
  })

  test("admin lists paginate, include legacy chapters, expose safe progress and enqueue/retry only eligible jobs", async () => {
    const id = await fixture(0)
    const request = {
      action: "enqueue",
      chapterIds: [id],
    }
    expect(
      await (await adminRequest("/jobs", "POST", request)).json()
    ).toMatchObject({ applied: 1, errors: [] })
    expect(
      await (await adminRequest("/jobs", "POST", request)).json()
    ).toMatchObject({ applied: 0 })
    await db
      .update(replica)
      .set({
        state: "failed",
        pages: {
          "0": {
            originalKey: `data/${id}/0.webp`,
            width: 40,
            height: 80,
            ...uploaded("admin"),
          },
          "1": { originalKey: `data/${id}/1.webp`, width: 40, height: 80 },
        },
        lastErrorCode: "AUTH_REQUIRED",
      })
      .where(eq(replica.chapterId, id))
    const details = await (
      await adminRequest(`/mangas/${parentId}/chapters?state=failed&limit=100`)
    ).json()
    expect(
      details.data.find((row: { id: string }) => row.id === id)
    ).toMatchObject({
      verified: 1,
      total: 2,
      state: "failed",
      lastErrorCode: "AUTH_REQUIRED",
    })
    expect(JSON.stringify(details)).not.toContain("tos-test")
    expect(
      await (
        await adminRequest("/jobs", "POST", { ...request, action: "retry" })
      ).json()
    ).toMatchObject({ applied: 1 })
    expect((await jobFor(id)).pages["0"]?.verifiedAt).toBeTruthy()
    expect(
      await (
        await adminRequest("/jobs", "POST", { ...request, action: "retry" })
      ).json()
    ).toMatchObject({ applied: 0 })
    await db.update(chapter).set({ pagesVersion: 1 }).where(eq(chapter.id, id))
    const stale = await (
      await adminRequest(`/mangas/${parentId}/chapters?state=stale`)
    ).json()
    expect(
      stale.data.find((row: { id: string }) => row.id === id)
    ).toMatchObject({ verified: 0, state: "stale" })
    const list = await (
      await adminRequest("/mangas?q=SV2%20fixture&limit=1")
    ).json()
    expect(list.data.map((row: { id: string }) => row.id)).toEqual([parentId])
    const page = await (
      await adminRequest(`/mangas/${parentId}/chapters?limit=1`)
    ).json()
    expect(page.manga).toEqual({ id: parentId, title: "SV2 fixture" })
    expect(page.data).toHaveLength(1)
    expect(page.meta.hasMore).toBe(true)
    const hiddenApp = createApp({
      catalog: {
        database: db,
        cache,
        assetBaseUrl: "https://assets.example/",
        hiddenMangaIds: [parentId],
      },
      auth: {
        api: { getSession: async () => ({ user: { id: actor } }) },
      } as unknown as Auth,
      logger: noop,
    })
    const hidden = await hiddenApp.request(
      `${adminBase}/mangas/${parentId}/chapters`
    )
    expect(hidden.status).toBe(404)
    expect(
      (await adminRequest(`/mangas/${randomUUID()}/chapters`)).status
    ).toBe(404)
    await discoverReplicas(deps)
    await terminate(id)

    const legacy = await fixture(0)
    const invalid = await fixture(0)
    await db.delete(chapterPage).where(eq(chapterPage.chapterId, invalid))
    const scoped = await (
      await adminRequest("/jobs", "POST", {
        action: "enqueue",
        mangaIds: [parentId],
      })
    ).json()
    expect(scoped).toMatchObject({
      applied: 1,
      hasMore: false,
      errors: [{ chapterId: invalid, code: "INVALID_MANIFEST" }],
    })
    expect((await jobFor(legacy)).state).toBe("pending")
    expect(await jobFor(invalid)).toBeUndefined()
    const audit = await db
      .select()
      .from(moderationAction)
      .where(eq(moderationAction.targetId, legacy))
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      actorUserId: actor,
      reason: "Chapter TikTok enqueue",
      action: "chapter.tiktok_enqueue",
    })
    await terminate(legacy)
    await db.delete(chapter).where(eq(chapter.id, invalid))
  })

  test("persisted switch blocks new claims, lets the current chapter finish and audits only changes", async () => {
    const current = await freshJob()
    const nextId = await fixture()
    await discoverReplicas(deps)
    expect(
      (await adminRequest("/worker", "PUT", { enabled: false })).status
    ).toBe(200)
    expect(await (await adminRequest("/worker")).json()).toMatchObject({
      enabled: false,
    })
    await adminRequest("/worker", "PUT", { enabled: false })
    expect(await claimReplica(deps)).toBeNull()
    expect((await jobFor(nextId)).attempts).toBe(0)
    expect(
      await processReplica(
        deps,
        current,
        async () => uploaded("paused"),
        new AbortController().signal
      )
    ).toBe(true)
    expect((await jobFor(current.chapterId)).state).toBe("ready")
    await adminRequest("/worker", "PUT", { enabled: true })
    expect((await claimReplica(deps))?.chapterId).toBe(nextId)
    const audits = await db
      .select()
      .from(moderationAction)
      .where(eq(moderationAction.targetKind, "image_server2"))
      .orderBy(asc(moderationAction.createdAt))
    expect(
      audits.filter((row) => row.actorUserId === actor).map((row) => row.after)
    ).toEqual([{ enabled: false }, { enabled: true }])
    await terminate(nextId)
  })

  test("fresh chapter reads expose ready replicas and isolate read-off policy", async () => {
    class MemoryCache extends BusinessCache {
      values = new Map<string, unknown>()
      override async get<T>(
        resource: CacheResource,
        identity: unknown
      ): Promise<T | null> {
        return (
          (this.values.get(`${resource}:${stableHash(identity)}`) as T) ?? null
        )
      }
      override async set(
        resource: CacheResource,
        identity: unknown,
        value: unknown
      ) {
        this.values.set(`${resource}:${stableHash(identity)}`, value)
        return true
      }
      override async invalidateCatalog() {
        this.values.clear()
        return true
      }
    }
    const memoryCache = new MemoryCache(
      parseImageServer2Env({
        DATABASE_URL: process.env.TEST_DATABASE_URL!,
        ASSET_BASE_URL: "https://assets.example/",
      }),
      noop
    )
    const makeApp = (enabled: boolean) =>
      createApp({
        catalog: {
          database: db,
          cache: memoryCache,
          assetBaseUrl: "https://assets.example/",
          imageServer2ReadEnabled: enabled,
        },
        logger: noop,
      })
    const enabled = makeApp(true)
    const disabled = makeApp(false)
    const job = await freshJob()
    const read = async (app: ReturnType<typeof createApp>) =>
      (await (await app.request(`/v1/chapters/${job.chapterId}`)).json()) as {
        pagesVersion: number
        pages: { replicaUrl: string | null }[]
      }
    expect((await read(enabled)).pages[0]!.replicaUrl).toBeNull()
    expect(
      await processReplica(
        deps,
        job,
        async () => uploaded("cache"),
        new AbortController().signal
      )
    ).toBe(true)
    expect((await read(enabled)).pages[0]!.replicaUrl).not.toBeNull()
    expect((await read(disabled)).pages[0]!.replicaUrl).toBeNull()
    await db
      .update(chapter)
      .set({ pagesVersion: 2 })
      .where(eq(chapter.id, job.chapterId))
    await memoryCache.invalidateCatalog()
    expect(await read(enabled)).toMatchObject({
      pagesVersion: 2,
      pages: [{ replicaUrl: null }, { replicaUrl: null }],
    })
    await discoverReplicas(deps)
    await terminate(job.chapterId)
    await memoryCache.close()
  })
})
