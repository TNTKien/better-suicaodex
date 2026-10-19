import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import { tz } from "@date-fns/tz"
import {
  addMinutes,
  addMilliseconds,
  formatRFC3339,
  subMinutes,
} from "date-fns"
import { and, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  cover,
  libraryItem,
  manga,
  notification,
  organization,
  readingHistory,
  user,
  userProfile,
} from "../../src/db/schema"
import type {
  ReadingProgress,
  MergeHistoryResult,
} from "../../src/features/reading/contract"
import { fanOutChapterNotification } from "../../src/features/notifications/service"
import { createRuntime, type Runtime } from "../../src/runtime"
import { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv, type RuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const noop = () => undefined
const stamp = (value: Date) =>
  formatRFC3339(value, { fractionDigits: 3, in: tz("UTC") })
const baseTime = subMinutes(new Date(), 20)
const time = (offset = 0) => stamp(addMilliseconds(baseTime, offset))
const emails = [0, 1].map(() => `phase7b-${randomUUID()}@example.com`)
const ownerGroupId = randomUUID()
let runtime: Runtime
let env: RuntimeEnv
let app: ReturnType<typeof createApp>
const accounts: { userId: string; cookie: string }[] = []
const mangaIds: string[] = []
let chapters: string[] = []
let foreignChapter = ""
let r18Chapter = ""
let emptyChapter = ""

function request(
  path: string,
  method = "GET",
  body?: unknown,
  account = 0,
  target = app
) {
  return target.request(path, {
    method,
    headers: {
      Cookie: accounts[account]!.cookie,
      Origin: env.WEB_ORIGIN,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
const progressPath = (id: string) => `/v1/me/reading-progress/${id}`
const mergePath = "/v1/me/reading-history/merge"
async function readProgress(id: string, account = 0) {
  const response = await request(progressPath(id), "GET", undefined, account)
  expect(response.status).toBe(200)
  return ((await response.json()) as { data: ReadingProgress | null }).data
}
async function groupedHistoryChapterIds(target = app) {
  const history = (await (
    await request("/v1/me/reading-history/manga", "GET", undefined, 0, target)
  ).json()) as {
    data: { chapters: { progress: ReadingProgress }[] }[]
  }
  return history.data.flatMap(({ chapters }) =>
    chapters.map(({ progress }) => progress.chapterId)
  )
}
async function clearHistory() {
  await runtime.database.delete(readingHistory).where(
    inArray(
      readingHistory.userId,
      accounts.map(({ userId }) => userId)
    )
  )
}

// Coordinate real transactions by observing the lock, not by guessing network latency.
async function waitForNotificationLock(blockerPid: number) {
  const deadline = performance.now() + 30_000
  while (performance.now() < deadline) {
    const result = await runtime.database.execute<{ blocked: boolean }>(sql`
      select exists (
        select 1 from pg_stat_activity
        where ${blockerPid} = any(pg_blocking_pids(pid))
          and query ilike '%notification%'
      ) as blocked
    `)
    if (result.rows[0]?.blocked) return
    await Bun.sleep(25)
  }
  throw new Error(
    "Notification transaction did not reach the expected row lock"
  )
}
function makeApp(
  visibility: {
    hiddenChapterIds?: string[]
    hiddenMangaIds?: string[]
    hideR18?: boolean
  } = {},
  cache = runtime.cache
) {
  return createApp({
    auth: runtime.auth,
    catalog: {
      database: runtime.database,
      assetBaseUrl: "http://localhost:9000/",
      cache,
      ...visibility,
    },
    logger: noop,
    webOrigin: env.WEB_ORIGIN,
  })
}

describe.serial("Phase 7B reading progress and history", () => {
  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL ||
      process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
    )
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      REDIS_CACHE_ENABLED: "false",
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await runtime.database.insert(organization).values({
      id: ownerGroupId,
      name: "Phase 7B owner group",
      slug: `phase-7b-owner-${ownerGroupId}`,
      createdAt: new Date(),
    })
    app = makeApp()
    for (const email of emails) {
      const result = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: env.WEB_ORIGIN },
        body: JSON.stringify({
          email,
          name: "Phase 7B reader",
          password: "phase7b-integration-password",
        }),
      })
      expect(result.status).toBe(200)
      const data = (await result.json()) as { user: { id: string } }
      accounts.push({
        userId: data.user.id,
        cookie: result.headers.get("set-cookie")!.split(";", 1)[0]!,
      })
    }
    for (let index = 0; index < 3; index++) {
      const [row] = await runtime.database
        .insert(manga)
        .values({
          ownerGroupId,

          slug: `phase7b-${randomUUID()}`,
          title: `Phase 7B Manga ${index}`,
          searchTitle: "phase7b",
          originalLanguage: "ja",
          status: "ongoing",
          contentRating: index === 2 ? "pornographic" : "safe",
          publicationState: "published",
          publishedAt: baseTime,
          hasUsableChapters: true,
        })
        .returning({ id: manga.id })
      mangaIds.push(row!.id)
    }
    await runtime.database.insert(cover).values({
      mangaId: mangaIds[0]!,
      storageKey:
        "covers/018f0000-0000-7000-8000-000000000001/018f0000-0000-7000-8000-000000000002.webp",
      isPrimary: true,
      width: 512,
      height: 720,
    })
    const normalChapters = await runtime.database
      .insert(chapter)
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          ownerGroupId,
          mangaId: mangaIds[0]!,
          number: String(i + 1),
          title: `Chapter ${i + 1}`,
          language: "vi",
          pageCount: 4,
          availablePageCount: 4,
          isFull: true,
          publicationState: "published" as const,
          publishedAt: baseTime,
        }))
      )
      .returning({ id: chapter.id, number: chapter.number })
    chapters = normalChapters
      .sort((a, b) => Number(a.number) - Number(b.number))
      .map(({ id }) => id)
    for (const [mangaId, pageCount] of [
      [mangaIds[1]!, 4],
      [mangaIds[2]!, 4],
      [mangaIds[0]!, 0],
    ] as const) {
      const [row] = await runtime.database
        .insert(chapter)
        .values({
          ownerGroupId,
          mangaId,
          number: "99",
          language: "vi",
          pageCount,
          availablePageCount: pageCount,
          isFull: true,
          publicationState: "published",
          publishedAt: baseTime,
        })
        .returning({ id: chapter.id })
      if (pageCount === 0) emptyChapter = row!.id
      else if (mangaId === mangaIds[1]) foreignChapter = row!.id
      else r18Chapter = row!.id
    }
  })

  afterAll(async () => {
    if (!runtime) return
    if (mangaIds.length)
      await runtime.database.delete(manga).where(inArray(manga.id, mangaIds))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, ownerGroupId))
    await runtime.database.delete(user).where(inArray(user.email, emails))
    await runtime.close()
  })

  test("requires a private session and validates chapter/timestamp ownership", async () => {
    const paths = [
      [progressPath(chapters[0]!), "GET"],
      [progressPath(chapters[0]!), "PUT"],
      [progressPath(chapters[0]!), "DELETE"],
      [`/v1/me/reading-progress?mangaId=${mangaIds[0]}`, "GET"],
      ["/v1/me/reading-history", "GET"],
      ["/v1/me/reading-history/manga", "GET"],
      [mergePath, "POST"],
    ] as const
    for (const [path, method] of paths) {
      const response = await app.request(path, { method })
      expect(response.status).toBe(401)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
    }
    expect(await readProgress(chapters[0]!)).toBeNull()
    expect((await request(progressPath(emptyChapter))).status).toBe(404)
    expect((await request(progressPath(emptyChapter), "PUT", {})).status).toBe(
      404
    )
    expect(
      (await request(`/v1/me/reading-progress?mangaId=${randomUUID()}`)).status
    ).toBe(404)
    const response = await request(progressPath(chapters[0]!), "PUT", {
      readAt: time(123),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.json()).toMatchObject({
      data: {
        chapterId: chapters[0],
        mangaId: mangaIds[0],
        readAt: time(123),
      },
    })
    expect(await readProgress(chapters[0]!, 1)).toBeNull()
    expect(
      await (
        await request(
          `/v1/me/reading-progress?mangaId=${mangaIds[0]}`,
          "GET",
          undefined,
          1
        )
      ).json()
    ).toEqual({ data: [] })
    for (const body of [
      { lastPage: -1 },
      { mangaId: mangaIds[1] },
      { userId: accounts[1]!.userId },
      { readAt: "invalid" },
      { readAt: stamp(addMinutes(new Date(), 6)) },
    ]) {
      const invalid = await request(progressPath(chapters[0]!), "PUT", body)
      expect(invalid.status).toBe(400)
      expect(invalid.headers.get("cache-control")).toBe("private, no-store")
    }
    expect((await request(progressPath(randomUUID()), "PUT", {})).status).toBe(
      404
    )
    expect((await request(progressPath(chapters[1]!), "PUT", {})).status).toBe(
      200
    )
  })

  test("converges out-of-order writes by timestamp", async () => {
    await clearHistory()
    const id = chapters[0]!
    const results = await Promise.all(
      [456, 458, 457, 455].map((offset) =>
        request(progressPath(id), "PUT", { readAt: time(offset) })
      )
    )
    expect(results.every(({ status }) => status === 200)).toBe(true)
    const newest = await readProgress(id)
    expect(newest).toMatchObject({ readAt: time(458) })
    for (const input of [{ readAt: time(455) }, { readAt: time(458) }]) {
      expect((await request(progressPath(id), "PUT", input)).status).toBe(200)
      expect(await readProgress(id)).toEqual(newest)
    }
    await request(progressPath(id), "PUT", { readAt: time(459) })
    expect(await readProgress(id)).toMatchObject({ readAt: time(459) })
    const rows = await runtime.database
      .select()
      .from(readingHistory)
      .where(eq(readingHistory.userId, accounts[0]!.userId))
    expect(rows).toHaveLength(1)
  })

  test("merges atomically with retry-safe partial acknowledgement and insert-only legacy fallback", async () => {
    await clearHistory()
    const unknown = randomUUID()
    const entries = [
      { chapterId: chapters[0]!, readAt: time() },
      { chapterId: unknown, readAt: time() },
      {
        chapterId: chapters[2]!,
        readAt: stamp(addMinutes(new Date(), 10)),
      },
      { chapterId: r18Chapter, readAt: time() },
    ]
    const response = await request(mergePath, "POST", { entries })
    expect(response.status).toBe(200)
    const result = (await response.json()) as MergeHistoryResult
    expect(result.merged).toHaveLength(1)
    expect(result.merged[0]).toMatchObject({
      chapterId: chapters[0],
      readAt: time(),
    })
    expect(result.ignored).toEqual(
      expect.arrayContaining([
        { chapterId: unknown, reason: "not_found", acknowledged: false },
        {
          chapterId: chapters[2],
          reason: "future_read_at",
          acknowledged: false,
        },
        { chapterId: r18Chapter, reason: "not_found", acknowledged: false },
      ])
    )
    const replay = (await (
      await request(mergePath, "POST", { entries })
    ).json()) as MergeHistoryResult
    expect(replay.merged).toEqual([])
    expect(replay.ignored).toContainEqual({
      chapterId: chapters[0],
      reason: "stale",
      acknowledged: true,
    })
    expect(await readProgress(chapters[0]!)).toEqual(result.merged[0]!)
    const legacy = {
      entries: [{ chapterId: chapters[0]! }, { chapterId: chapters[3]! }],
    }
    const legacyResult = (await (
      await request(mergePath, "POST", legacy)
    ).json()) as MergeHistoryResult
    expect(legacyResult.ignored).toEqual([
      { chapterId: chapters[0], reason: "legacy_existing", acknowledged: true },
    ])
    expect(legacyResult.merged).toHaveLength(1)
    const fallback = await readProgress(chapters[3]!)
    await request(mergePath, "POST", legacy)
    expect(await readProgress(chapters[3]!)).toEqual(fallback)
    expect(await readProgress(chapters[0]!)).toEqual(result.merged[0]!)

    const id = chapters[4]!
    const concurrent = await Promise.all([
      request(mergePath, "POST", {
        entries: [{ chapterId: id, readAt: time(1) }],
      }),
      request(progressPath(id), "PUT", { readAt: time(1) }),
      request(mergePath, "POST", {
        entries: [{ chapterId: id, readAt: time() }],
      }),
    ])
    expect(concurrent.every(({ status }) => status === 200)).toBe(true)
    expect(await readProgress(id)).toMatchObject({
      readAt: time(1),
    })
    for (const body of [
      { entries: [] },
      {
        entries: Array.from({ length: 101 }, () => ({
          chapterId: randomUUID(),
        })),
      },
      {
        entries: [{ chapterId: id }, { chapterId: id.toUpperCase() }],
      },
      {
        entries: [
          { chapterId: chapters[5] },
          { chapterId: id, readAt: "invalid" },
        ],
      },
    ])
      expect((await request(mergePath, "POST", body)).status).toBe(400)
    expect(await readProgress(chapters[5]!)).toBeNull()
  })

  test("groups history by manga with three newest chapters and manga pagination", async () => {
    await clearHistory()
    await request(mergePath, "POST", {
      entries: [
        { chapterId: foreignChapter, readAt: time(50) },
        ...chapters.slice(0, 4).map((chapterId, index) => ({
          chapterId,
          readAt: time(100 + index),
        })),
      ],
    })
    const first = (await (
      await request("/v1/me/reading-history/manga?limit=1")
    ).json()) as {
      data: {
        manga: { id: string }
        chapters: { progress: ReadingProgress }[]
      }[]
      meta: { nextCursor: string | null }
    }
    expect(first.data).toHaveLength(1)
    expect(first.data[0]!.manga.id).toBe(mangaIds[0])
    expect(
      first.data[0]!.chapters.map(({ progress }) => progress.chapterId)
    ).toEqual([chapters[3], chapters[2], chapters[1]])
    expect(first.meta.nextCursor).toBe(chapters[3])

    const second = (await (
      await request(
        `/v1/me/reading-history/manga?limit=1&cursor=${first.meta.nextCursor}`
      )
    ).json()) as typeof first
    expect(second.data.map(({ manga }) => manga.id)).toEqual([mangaIds[1]])
    expect(second.meta.nextCursor).toBeNull()

    expect((await request(progressPath(chapters[3]!), "DELETE")).status).toBe(
      204
    )
    const afterDelete = (await (
      await request("/v1/me/reading-history/manga?limit=1")
    ).json()) as typeof first
    expect(
      afterDelete.data[0]!.chapters.map(({ progress }) => progress.chapterId)
    ).toEqual([chapters[2], chapters[1], chapters[0]])
    expect(
      (await request(`/v1/me/reading-history/manga?cursor=${randomUUID()}`))
        .status
    ).toBe(400)
    await request(progressPath(chapters[5]!), "PUT", {}, 1)
    expect(
      (await request(`/v1/me/reading-history/manga?cursor=${chapters[5]}`))
        .status
    ).toBe(400)
  })

  test("paginates ties, isolates user cursors and filters current visibility without deleting rows", async () => {
    await clearHistory()
    const ids = chapters.slice(0, 3)
    await request(mergePath, "POST", {
      entries: ids.map((chapterId) => ({
        chapterId,
        readAt: time(),
      })),
    })
    await request(progressPath(foreignChapter), "PUT", { readAt: time() }, 1)
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const response = await request(
        `/v1/me/reading-history?limit=1${cursor ? `&cursor=${cursor}` : ""}`
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        data: {
          progress: ReadingProgress
          manga: { title: string; cover: { url: string } }
          chapter: { language: string }
        }[]
        meta: { nextCursor: string | null }
      }
      expect(body.data).toHaveLength(1)
      expect(body.data[0]!.manga).toMatchObject({
        title: "Phase 7B Manga 0",
        cover: {
          url: "http://localhost:9000/covers/018f0000-0000-7000-8000-000000000001/018f0000-0000-7000-8000-000000000002.512.webp",
        },
      })
      expect(body.data[0]!.chapter).toMatchObject({
        language: "vi",
      })
      expect(body.data[0]!.chapter).not.toHaveProperty("pageCount")
      expect(body.data[0]!.progress).not.toHaveProperty("userId")
      seen.push(body.data[0]!.progress.chapterId)
      cursor = body.meta.nextCursor
    } while (cursor && seen.length < 10)
    expect(seen).toEqual([...ids].sort().reverse())
    for (const bad of [foreignChapter, randomUUID()]) {
      const response = await request(`/v1/me/reading-history?cursor=${bad}`)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        error: { code: "INVALID_CURSOR" },
      })
    }
    const restrictedVisibility = makeApp({ hiddenChapterIds: [ids[0]!] })
    expect(
      (
        await request(
          progressPath(ids[0]!),
          "GET",
          undefined,
          0,
          restrictedVisibility
        )
      ).status
    ).toBe(404)
    expect(
      (await request(progressPath(ids[0]!), "PUT", {}, 0, restrictedVisibility))
        .status
    ).toBe(404)
    const filtered = (await (
      await request(
        `/v1/me/reading-progress?mangaId=${mangaIds[0]}`,
        "GET",
        undefined,
        0,
        restrictedVisibility
      )
    ).json()) as { data: ReadingProgress[] }
    expect(filtered.data.map(({ chapterId }) => chapterId)).not.toContain(
      ids[0]!
    )
    const allHidden = makeApp({ hiddenMangaIds: [mangaIds[0]!] })
    expect(
      (
        await request(
          `/v1/me/reading-progress?mangaId=${mangaIds[0]}`,
          "GET",
          undefined,
          0,
          allHidden
        )
      ).status
    ).toBe(404)
    for (const state of [
      { publicationState: "hidden" as const },
      { deletedAt: new Date() },
      { isFull: false },
    ]) {
      await runtime.database
        .update(chapter)
        .set(state)
        .where(eq(chapter.id, ids[1]!))
      expect((await request(progressPath(ids[1]!))).status).toBe(404)
      const history = (await (
        await request("/v1/me/reading-history")
      ).json()) as { data: { progress: ReadingProgress }[] }
      expect(
        history.data.map(({ progress }) => progress.chapterId)
      ).not.toContain(ids[1]!)
      expect(
        await groupedHistoryChapterIds(restrictedVisibility)
      ).not.toContain(ids[1]!)
      await runtime.database
        .update(chapter)
        .set({ publicationState: "published", deletedAt: null, isFull: true })
        .where(eq(chapter.id, ids[1]!))
    }
    for (const state of [
      { publicationState: "hidden" as const },
      { deletedAt: new Date() },
    ]) {
      await runtime.database
        .update(manga)
        .set(state)
        .where(eq(manga.id, mangaIds[0]!))
      expect((await request(progressPath(ids[0]!))).status).toBe(404)
      expect(
        (await request(`/v1/me/reading-progress?mangaId=${mangaIds[0]}`)).status
      ).toBe(404)
      expect(
        await (await request("/v1/me/reading-history")).json()
      ).toMatchObject({ data: [] })
      expect(await groupedHistoryChapterIds(allHidden)).toEqual([])
      await runtime.database
        .update(manga)
        .set({ publicationState: "published", deletedAt: null })
        .where(eq(manga.id, mangaIds[0]!))
    }
    const r18App = makeApp({ hideR18: false })
    expect(
      (await request(progressPath(r18Chapter), "PUT", {}, 0, r18App)).status
    ).toBe(200)
    for (const target of [allHidden, app]) {
      const history = (await (
        await request("/v1/me/reading-history", "GET", undefined, 0, target)
      ).json()) as { data: { progress: ReadingProgress }[] }
      expect(
        history.data.map(({ progress }) => progress.chapterId)
      ).not.toContain(r18Chapter)
      expect(await groupedHistoryChapterIds(target)).not.toContain(r18Chapter)
      if (target === allHidden) expect(history.data).toEqual([])
    }
    const stored = await runtime.database
      .select()
      .from(readingHistory)
      .where(eq(readingHistory.userId, accounts[0]!.userId))
    expect(stored).toHaveLength(4)
  })

  test("lists, reads and auto-reads only the account's visible notifications", async () => {
    await runtime.database.delete(notification).where(
      inArray(
        notification.userId,
        accounts.map(({ userId }) => userId)
      )
    )
    const createdAt = [0, 1, 2, 3].map((offset) =>
      addMilliseconds(baseTime, offset)
    )
    const inserted = await runtime.database
      .insert(notification)
      .values([
        {
          userId: accounts[0]!.userId,
          type: "manga_new_chapter",
          mangaId: mangaIds[0]!,
          chapterId: chapters[0]!,
          createdAt: createdAt[0],
        },
        {
          userId: accounts[0]!.userId,
          type: "manga_new_chapter",
          mangaId: mangaIds[1]!,
          chapterId: foreignChapter,
          createdAt: createdAt[2],
        },
        {
          userId: accounts[0]!.userId,
          type: "manga_new_chapter",
          mangaId: mangaIds[2]!,
          chapterId: r18Chapter,
          createdAt: createdAt[3],
        },
        {
          userId: accounts[1]!.userId,
          type: "manga_new_chapter",
          mangaId: mangaIds[0]!,
          chapterId: chapters[1]!,
          createdAt: createdAt[1],
        },
      ])
      .returning({
        id: notification.id,
        userId: notification.userId,
        mangaId: notification.mangaId,
      })
    const own = inserted.filter(({ userId }) => userId === accounts[0]!.userId)
    const foreign = inserted.find(
      ({ userId }) => userId === accounts[1]!.userId
    )!

    const firstPage = (await (
      await request("/v1/me/notifications?limit=1")
    ).json()) as {
      data: { id: string; manga: { id: string }; chapter: { id: string } }[]
      meta: { limit: number; nextCursor: string | null; unreadCount: number }
    }
    expect(firstPage).toMatchObject({
      data: [{ manga: { id: mangaIds[1] }, chapter: { id: foreignChapter } }],
      meta: { limit: 1, unreadCount: 2 },
    })
    expect(firstPage.meta.nextCursor).toBe(firstPage.data[0]!.id)
    expect(
      (await request(`/v1/me/notifications?cursor=${foreign.id}`, "GET")).status
    ).toBe(400)
    const hidden = makeApp({ hiddenMangaIds: [mangaIds[1]!] })
    expect(
      await (
        await request("/v1/me/notifications", "GET", undefined, 0, hidden)
      ).json()
    ).toMatchObject({
      data: [{ manga: { id: mangaIds[0] } }],
      meta: { unreadCount: 1 },
    })

    expect(
      (await request(`/v1/me/notifications/${foreign.id}/read`, "POST")).status
    ).toBe(404)
    const newest = own.find(({ mangaId }) => mangaId === mangaIds[1])!
    const firstRead = (await (
      await request(`/v1/me/notifications/${newest.id}/read`, "POST")
    ).json()) as { data: { readAt: string }; meta: { unreadCount: number } }
    const repeatedRead = (await (
      await request(`/v1/me/notifications/${newest.id}/read`, "POST")
    ).json()) as { data: { readAt: string }; meta: { unreadCount: number } }
    expect(repeatedRead.data.readAt).toBe(firstRead.data.readAt)
    expect(repeatedRead.meta.unreadCount).toBe(1)
    expect(
      await (await request("/v1/me/notifications/read-all", "POST")).json()
    ).toMatchObject({ data: { updated: 1 }, meta: { unreadCount: 0 } })

    const mangaNotification = own.find(
      ({ mangaId }) => mangaId === mangaIds[0]
    )!
    await runtime.database
      .update(notification)
      .set({ chapterId: chapters[2]!, readAt: null })
      .where(eq(notification.id, mangaNotification.id))
    expect((await request(progressPath(chapters[2]!), "PUT", {})).status).toBe(
      200
    )
    expect(
      await runtime.database
        .select({ readAt: notification.readAt })
        .from(notification)
        .where(eq(notification.id, mangaNotification.id))
    ).toEqual([{ readAt: expect.any(Date) }])

    await runtime.database
      .update(notification)
      .set({ chapterId: chapters[3]!, readAt: null })
      .where(eq(notification.id, mangaNotification.id))
    expect(
      (
        await request(mergePath, "POST", {
          entries: [{ chapterId: chapters[3] }],
        })
      ).status
    ).toBe(200)
    expect(
      await runtime.database
        .select({ readAt: notification.readAt })
        .from(notification)
        .where(eq(notification.id, mangaNotification.id))
    ).toEqual([{ readAt: expect.any(Date) }])
  })

  test.each(["timestamp", "chapter ID"])(
    "Phase 8F: concurrent fan-out keeps the newest %s",
    async (orderBy) => {
      const userId = accounts[1]!.userId
      const mangaId = mangaIds[0]!
      const ids = chapters.slice(0, 2).sort()
      // Timestamp wins even when the newer event has the smaller chapter ID.
      const [olderId, newerId] = orderBy === "timestamp" ? ids.reverse() : ids
      const events = [
        {
          chapterId: olderId!,
          mangaId,
          publishedAt: baseTime,
          sessionId: randomUUID(),
        },
        {
          chapterId: newerId!,
          mangaId,
          publishedAt:
            orderBy === "timestamp" ? addMilliseconds(baseTime, 1) : baseTime,
          sessionId: randomUUID(),
        },
      ]
      await runtime.database
        .insert(libraryItem)
        .values({ userId, mangaId, category: "following" })
        .onConflictDoNothing()

      for (const first of [0, 1]) {
        await runtime.database
          .delete(notification)
          .where(eq(notification.userId, userId))
        let competing: Promise<void> | undefined
        try {
          await runtime.database.transaction(async (tx) => {
            await fanOutChapterNotification(tx, events[first]!, {}, noop)
            const { rows } = await tx.execute<{ pid: number }>(
              sql`select pg_backend_pid() as pid`
            )
            competing = runtime.database.transaction(async (other) => {
              await fanOutChapterNotification(
                other,
                events[1 - first]!,
                {},
                noop
              )
            })
            // Attach a rejection handler while the first transaction holds the lock.
            void competing.catch(noop)
            await waitForNotificationLock(rows[0]!.pid)
          })
        } finally {
          await competing
        }
        const readAt = new Date()
        expect(
          await runtime.database
            .select({
              chapterId: notification.chapterId,
              createdAt: notification.createdAt,
              readAt: notification.readAt,
            })
            .from(notification)
            .where(eq(notification.userId, userId))
        ).toEqual([
          {
            chapterId: newerId,
            createdAt: events[1]!.publishedAt,
            readAt: null,
          },
        ])
        await runtime.database
          .update(notification)
          .set({ readAt })
          .where(eq(notification.userId, userId))
        for (const event of events)
          await runtime.database.transaction((tx) =>
            fanOutChapterNotification(tx, event, {}, noop)
          )
        expect(
          await runtime.database
            .select({ readAt: notification.readAt })
            .from(notification)
            .where(eq(notification.userId, userId))
        ).toEqual([{ readAt }])
      }
    }
  )

  test.each(["insert", "update"])(
    "Phase 8F: notification %s rolls back with publication",
    async (mode) => {
      const userId = accounts[1]!.userId
      const mangaId = mangaIds[0]!
      const targetId = chapters[2]!
      await runtime.database
        .delete(notification)
        .where(eq(notification.userId, userId))
      await runtime.database
        .insert(libraryItem)
        .values({ userId, mangaId, category: "following" })
        .onConflictDoNothing()
      if (mode === "update")
        await runtime.database.insert(notification).values({
          userId,
          type: "manga_new_chapter",
          mangaId,
          chapterId: chapters[0]!,
          createdAt: baseTime,
          readAt: baseTime,
        })
      const before = await runtime.database
        .select()
        .from(notification)
        .where(eq(notification.userId, userId))
      await runtime.database
        .update(chapter)
        .set({ publicationState: "draft" })
        .where(eq(chapter.id, targetId))
      try {
        await assert.rejects(
          runtime.database.transaction(async (tx) => {
            await tx
              .update(chapter)
              .set({ publicationState: "published" })
              .where(eq(chapter.id, targetId))
            await fanOutChapterNotification(
              tx,
              {
                chapterId: targetId,
                mangaId,
                publishedAt: new Date(),
                sessionId: randomUUID(),
              },
              {},
              noop
            )
            expect(
              await tx
                .select({ chapterId: notification.chapterId })
                .from(notification)
                .where(eq(notification.userId, userId))
            ).toEqual([{ chapterId: targetId }])
            throw new Error("Injected publication rollback")
          }),
          /Injected publication rollback/
        )
        expect(
          await runtime.database
            .select()
            .from(notification)
            .where(eq(notification.userId, userId))
        ).toEqual(before)
        expect(
          await runtime.database
            .select({ state: chapter.publicationState })
            .from(chapter)
            .where(eq(chapter.id, targetId))
        ).toEqual([{ state: "draft" }])
      } finally {
        await runtime.database
          .update(chapter)
          .set({ publicationState: "published" })
          .where(eq(chapter.id, targetId))
      }
    }
  )

  test("Phase 8F: read-all does not consume a newer event while waiting for its row lock", async () => {
    const userId = accounts[1]!.userId
    const mangaId = mangaIds[0]!
    await runtime.database
      .delete(notification)
      .where(eq(notification.userId, userId))
    await runtime.database
      .insert(libraryItem)
      .values({ userId, mangaId, category: "following" })
      .onConflictDoNothing()
    const [row] = await runtime.database
      .insert(notification)
      .values({
        userId,
        type: "manga_new_chapter",
        mangaId,
        chapterId: chapters[0]!,
        createdAt: baseTime,
      })
      .returning({ id: notification.id })
    let pending: Promise<Response> | undefined
    try {
      await runtime.database.transaction(async (tx) => {
        await tx
          .select()
          .from(notification)
          .where(eq(notification.id, row!.id))
          .for("update")
        const { rows } = await tx.execute<{ pid: number }>(
          sql`select pg_backend_pid() as pid`
        )
        pending = request("/v1/me/notifications/read-all", "POST", undefined, 1)
        void pending.catch(noop)
        await waitForNotificationLock(rows[0]!.pid)
        await fanOutChapterNotification(
          tx,
          {
            chapterId: chapters[1]!,
            mangaId,
            publishedAt: new Date(),
            sessionId: randomUUID(),
          },
          {},
          noop
        )
      })
    } finally {
      await pending
    }
    const response = await pending!
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: { updated: 0 },
      meta: { unreadCount: 1 },
    })
    expect(
      await runtime.database
        .select({
          chapterId: notification.chapterId,
          readAt: notification.readAt,
        })
        .from(notification)
        .where(eq(notification.id, row!.id))
    ).toEqual([{ chapterId: chapters[1], readAt: null }])
  })

  test("works without Redis and allows restricted users to read and delete only their own progress", async () => {
    await clearHistory()
    const failedCache = new BusinessCache(
      {
        ...env,
        REDIS_CACHE_ENABLED: true,
        REDIS_URL: "redis://127.0.0.1:1",
        REDIS_CONNECT_TIMEOUT_MS: 50,
      },
      noop
    )
    try {
      await failedCache.connect()
      expect(failedCache.status).toBe("degraded")
      const degradedApp = makeApp({}, failedCache)
      const id = chapters[0]!
      expect(
        (await request(progressPath(id), "PUT", {}, 0, degradedApp)).status
      ).toBe(200)
      expect(
        (
          await request(
            `/v1/me/reading-progress?mangaId=${mangaIds[0]}`,
            "GET",
            undefined,
            0,
            degradedApp
          )
        ).status
      ).toBe(200)
      for (const status of ["suspended", "banned"] as const) {
        await runtime.database
          .update(userProfile)
          .set({
            status,
            moderatedAt: new Date(),
            moderationReason: "phase7b_test",
          })
          .where(eq(userProfile.userId, accounts[0]!.userId))
        await request(progressPath(id), "PUT", { readAt: time(2) }, 1)
        expect((await request(progressPath(id))).status).toBe(200)
        expect((await request("/v1/me/reading-history")).status).toBe(200)
        expect(
          (await request(`/v1/me/reading-progress?mangaId=${mangaIds[0]}`))
            .status
        ).toBe(200)
        expect((await request(progressPath(id), "PUT", {})).status).toBe(403)
        expect(
          (
            await request(mergePath, "POST", {
              entries: [{ chapterId: id }],
            })
          ).status
        ).toBe(403)
        const hidden = makeApp({ hiddenChapterIds: [id] })
        for (let retry = 0; retry < 2; retry++)
          expect(
            (await request(progressPath(id), "DELETE", undefined, 0, hidden))
              .status
          ).toBe(204)
        expect(await readProgress(id)).toBeNull()
        expect(await readProgress(id, 1)).toMatchObject({ readAt: time(2) })
      }
      const other = await runtime.database
        .select()
        .from(readingHistory)
        .where(
          and(
            eq(readingHistory.userId, accounts[1]!.userId),
            eq(readingHistory.chapterId, id)
          )
        )
      expect(other).toHaveLength(1)
    } finally {
      await failedCache.close()
    }
  })
})
