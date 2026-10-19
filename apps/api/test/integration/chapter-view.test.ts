import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { addSeconds } from "date-fns"
import { eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { fileURLToPath } from "node:url"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  chapterStats,
  manga,
  mangaEngagementDaily,
  mangaGroup,
  mangaStats,
  organization as translationGroup,
  translationGroupMangaEngagementDaily,
  translationGroupMangaViewStats,
  translationGroupProfile,
} from "../../src/db/schema"
import {
  addViewEngagement,
  engagementBucketDate,
} from "../../src/features/ranking/engagement"
import { GroupRankingSchema } from "../../src/features/ranking/contract"
import { createRuntime, type Runtime } from "../../src/runtime"
import type { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const noop = () => undefined
const secret = "chapter-view-test-secret-with-at-least-thirty-two-bytes"
const locks = new Set<string>()
const viewCache = {
  status: "healthy",
  acquireLock: async (name: string) => {
    if (locks.has(name)) return null
    locks.add(name)
    return async () => {
      locks.delete(name)
    }
  },
} as unknown as BusinessCache

let runtime: Runtime
let mangaId = ""
let chapterId = ""
const groupIds = [crypto.randomUUID(), crypto.randomUUID()]
let currentTime = new Date("2026-09-09T01:00:00.000Z")
let app: ReturnType<typeof createApp>

describe.serial("chapter view ingestion", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    const env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      ASSET_BASE_URL: "http://localhost:9000/",
      REDIS_CACHE_ENABLED: "false",
      REDIS_PREFIX: "redive:test:chapter-view",
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await runtime.database.insert(translationGroup).values(
      groupIds.map((id, index) => ({
        id,
        name: `View credit group ${index + 1}`,
        slug: `view-credit-group-${id}`,
        createdAt: currentTime,
      }))
    )
    const [createdManga] = await runtime.database
      .insert(manga)
      .values({
        ownerGroupId: groupIds[0]!,
        slug: `chapter-view-${crypto.randomUUID()}`,
        title: "Chapter view test",
        searchTitle: "chapter view test",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
        publicationState: "published",
        publishedAt: currentTime,
        hasUsableChapters: true,
      })
      .returning({ id: manga.id })
    mangaId = createdManga!.id
    await runtime.database.insert(translationGroupProfile).values(
      groupIds.map((organizationId) => ({
        organizationId,
        approvalStatus: "approved" as const,
        publicationState: "published" as const,
      }))
    )
    await runtime.database
      .insert(mangaGroup)
      .values(groupIds.map((groupId) => ({ groupId, mangaId })))
    const [createdChapter] = await runtime.database
      .insert(chapter)
      .values({
        ownerGroupId: groupIds[0]!,
        mangaId,
        number: "1",
        language: "vi",
        pageCount: 4,
        availablePageCount: 4,
        isFull: true,
        publicationState: "published",
        publishedAt: currentTime,
      })
      .returning({ id: chapter.id })
    chapterId = createdChapter!.id
    await runtime.database
      .insert(chapterGroup)
      .values(groupIds.map((groupId) => ({ groupId, chapterId })))
    app = createApp({
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: viewCache,
        database: runtime.database,
      },
      logger: noop,
      viewTracking: { now: () => currentTime, secret },
    })
  })

  afterAll(async () => {
    if (runtime && mangaId)
      await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    if (runtime)
      await runtime.database
        .delete(translationGroup)
        .where(inArray(translationGroup.id, groupIds))
    await runtime?.close()
  })

  test("counts once after the server duration threshold", async () => {
    const start = await app.request(`/v1/chapters/${chapterId}/view-session`, {
      method: "POST",
    })
    expect(start.status).toBe(200)
    const cookie = start.headers.get("set-cookie")!.split(";")[0]!
    const session = (await start.json()) as {
      token: string
      requiredPages: number
      requiredSeconds: number
    }
    expect(session).toMatchObject({ requiredPages: 3, requiredSeconds: 3 })

    const complete = () =>
      app.request(`/v1/chapters/${chapterId}/view`, {
        body: JSON.stringify({ token: session.token, seenPages: 4 }),
        headers: { cookie, "content-type": "application/json" },
        method: "POST",
      })

    currentTime = addSeconds(currentTime, 2)
    expect(await (await complete()).json()).toMatchObject({
      counted: false,
      retryAfterSeconds: 1,
    })
    currentTime = addSeconds(currentTime, 1)
    expect(await (await complete()).json()).toMatchObject({
      counted: true,
      viewCount: 1,
    })
    expect(await (await complete()).json()).toMatchObject({
      alreadyCounted: true,
      counted: false,
    })

    const [chapterValue] = await runtime.database
      .select({ views: chapterStats.views })
      .from(chapterStats)
      .where(eq(chapterStats.chapterId, chapterId))
    const [mangaValue] = await runtime.database
      .select({ views: mangaStats.views })
      .from(mangaStats)
      .where(eq(mangaStats.mangaId, mangaId))
    const [dailyValue] = await runtime.database
      .select({ views: mangaEngagementDaily.views })
      .from(mangaEngagementDaily)
      .where(eq(mangaEngagementDaily.mangaId, mangaId))
    const groupValues = await runtime.database
      .select({ views: translationGroupMangaViewStats.views })
      .from(translationGroupMangaViewStats)
      .where(eq(translationGroupMangaViewStats.mangaId, mangaId))
    const groupDailyValues = await runtime.database
      .select({
        actualViews: translationGroupMangaEngagementDaily.actualViews,
        views: translationGroupMangaEngagementDaily.views,
      })
      .from(translationGroupMangaEngagementDaily)
      .where(eq(translationGroupMangaEngagementDaily.mangaId, mangaId))
    expect(chapterValue?.views).toBe(1n)
    expect(mangaValue?.views).toBe(1n)
    expect(dailyValue).toEqual({ views: 1n })
    expect(groupValues.map(({ views }) => views).sort()).toEqual([0.5, 0.5])
    expect(
      groupDailyValues
        .map(({ actualViews, views }) => ({ actualViews, views }))
        .sort((left, right) => left.views - right.views)
    ).toEqual([
      { actualViews: 1n, views: 0.5 },
      { actualViews: 1n, views: 0.5 },
    ])
    expect(engagementBucketDate(currentTime)).toBe("2026-09-09")
    await addViewEngagement(
      runtime.database,
      chapterId,
      mangaId,
      addSeconds(currentTime, 1)
    )
    expect(
      (
        await runtime.database
          .select({
            actualViews: translationGroupMangaEngagementDaily.actualViews,
            views: translationGroupMangaEngagementDaily.views,
          })
          .from(translationGroupMangaEngagementDaily)
          .where(eq(translationGroupMangaEngagementDaily.mangaId, mangaId))
      )
        .map(({ actualViews, views }) => ({ actualViews, views }))
        .sort((left, right) => left.views - right.views)
    ).toEqual([
      { actualViews: 2n, views: 1 },
      { actualViews: 2n, views: 1 },
    ])

    const today = new Date()
    await runtime.database
      .update(chapter)
      .set({ publishedAt: today })
      .where(eq(chapter.id, chapterId))
    await runtime.database
      .update(translationGroupMangaEngagementDaily)
      .set({ bucketDate: engagementBucketDate(today) })
      .where(eq(translationGroupMangaEngagementDaily.mangaId, mangaId))
    const rankingResponse = await app.request(
      "/v1/rankings/groups?window=day&limit=5"
    )
    expect(rankingResponse.status).toBe(200)
    const ranking = GroupRankingSchema.parse(await rankingResponse.json())
    expect(ranking.data.slice(0, 2).map(({ group }) => group.id)).toEqual(
      groupIds.toSorted()
    )
    expect(
      ranking.data.slice(0, 2).map(({ views, chapters, score }) => ({
        chapters,
        score,
        views,
      }))
    ).toEqual([
      { chapters: 1, score: 10, views: 2 },
      { chapters: 1, score: 10, views: 2 },
    ])

    const allTimeRanking = GroupRankingSchema.parse(
      await (
        await app.request("/v1/rankings/groups?window=all-time&limit=5")
      ).json()
    )
    expect(
      allTimeRanking.data
        .slice(0, 2)
        .map(({ views, chapters }) => ({ chapters, views }))
    ).toEqual([
      { chapters: 1, views: 2 },
      { chapters: 1, views: 2 },
    ])

    const unavailableApp = createApp({
      catalog: {
        assetBaseUrl: "http://localhost:9000/",
        cache: {
          status: "disabled",
          acquireLock: async () => null,
        } as unknown as BusinessCache,
        database: runtime.database,
      },
      logger: noop,
      viewTracking: { now: () => currentTime, secret },
    })
    const unavailableStart = await unavailableApp.request(
      `/v1/chapters/${chapterId}/view-session`,
      { method: "POST" }
    )
    const unavailableCookie = unavailableStart.headers
      .get("set-cookie")!
      .split(";")[0]!
    const unavailableSession = (await unavailableStart.json()) as {
      token: string
      requiredSeconds: number
    }
    currentTime = addSeconds(currentTime, unavailableSession.requiredSeconds)
    const unavailableResult = await unavailableApp.request(
      `/v1/chapters/${chapterId}/view`,
      {
        body: JSON.stringify({
          token: unavailableSession.token,
          seenPages: 4,
        }),
        headers: {
          cookie: unavailableCookie,
          "content-type": "application/json",
        },
        method: "POST",
      }
    )
    expect(await unavailableResult.json()).toMatchObject({
      counted: false,
      trackingAvailable: false,
    })
    const [unchangedManga] = await runtime.database
      .select({ views: mangaStats.views })
      .from(mangaStats)
      .where(eq(mangaStats.mangaId, mangaId))
    expect(unchangedManga?.views).toBe(2n)
  })
})
