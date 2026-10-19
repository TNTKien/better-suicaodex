import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { fileURLToPath } from "node:url"

import { and, eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  comment,
  manga,
  mangaEngagementDaily,
  mangaStats,
  organization,
  user,
} from "../../src/db/schema"
import { MangaRankingSchema } from "../../src/features/ranking/contract"
import { engagementBucketDate } from "../../src/features/ranking/engagement"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv, type RuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const noop = () => undefined
const prefix = `phase5a-ranking-${crypto.randomUUID()}`
let runtime: Runtime
let env: RuntimeEnv
let app: ReturnType<typeof createApp>
let mangaIds: string[] = []
let chapterIds: string[] = []
const commentIds: string[] = []
const commentEmail = `${prefix}@example.com`
const ownerGroupId = crypto.randomUUID()

describe.serial("Phase 5A manga ranking", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      ASSET_BASE_URL: "http://localhost:9000/",
      REDIS_CACHE_ENABLED: "false",
      REDIS_PREFIX: `${process.env.REDIS_PREFIX ?? "redive:test"}:phase5a-ranking`,
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })

    await runtime.database.insert(organization).values({
      id: ownerGroupId,
      name: "Phase 5A ranking owner group",
      slug: `${prefix}-owner`,
      createdAt: new Date(),
    })

    const now = new Date()
    const rows = await runtime.database
      .insert(manga)
      .values(
        Array.from({ length: 21 }, (_, index) => ({
          ownerGroupId,

          slug: `${prefix}-${index}`,
          title: `Ranking ${index}`,
          searchTitle: `ranking ${index}`,
          originalLanguage: "ja",
          status: "ongoing" as const,
          contentRating: "safe" as const,
          publicationState: "published" as const,
          hasUsableChapters: true,
          latestChapterPublishedAt: now,
          publishedAt: now,
        }))
      )
      .returning({ id: manga.id })
    mangaIds = rows.map(({ id }) => id)
    chapterIds = (
      await runtime.database
        .insert(chapter)
        .values(
          mangaIds.map((mangaId) => ({
            ownerGroupId,
            mangaId,
            number: "1",
            language: "vi",
            pageCount: 1,
            availablePageCount: 1,
            isFull: true,
            publicationState: "published" as const,
            publishedAt: now,
          }))
        )
        .returning({ id: chapter.id })
    ).map(({ id }) => id)
    await runtime.database.insert(mangaStats).values(
      mangaIds.map((mangaId, index) => {
        const value = BigInt(1_000_000_000 + index)
        return {
          mangaId,
          views: value,
          follows: value * 2n,
          comments: value * 3n,
        }
      })
    )
    await runtime.database.insert(mangaEngagementDaily).values(
      mangaIds.map((mangaId, index) => {
        const value = BigInt(1_000_000_000 + index)
        return {
          mangaId,
          bucketDate: engagementBucketDate(now),
          views: value,
          followAdds: value * 2n,
          comments: value * 3n,
        }
      })
    )
    app = createApp({
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: noop,
    })
  })

  afterAll(async () => {
    if (!runtime) return
    if (commentIds.length)
      await runtime.database
        .delete(comment)
        .where(inArray(comment.id, commentIds))
    if (mangaIds.length)
      await runtime.database.delete(manga).where(inArray(manga.id, mangaIds))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, ownerGroupId))
    await runtime.database.delete(user).where(eq(user.email, commentEmail))
    await runtime.close()
  })

  test("ranks all-time score and raw daily signals deterministically", async () => {
    const detailResponse = await app.request(`/v1/manga/${mangaIds.at(-1)}`)
    expect(detailResponse.status).toBe(200)
    expect(await detailResponse.json()).toMatchObject({
      statistics: {
        views: 1_000_000_020,
        follows: 2_000_000_040,
        comments: 3_000_000_060,
      },
    })

    const scoreResponse = await app.request(
      "/v1/rankings/manga?metric=score&window=all-time&limit=5"
    )
    expect(scoreResponse.status).toBe(200)
    const score = MangaRankingSchema.parse(await scoreResponse.json())
    expect(score.meta.activeSignals).toEqual({
      views: true,
      follows: true,
      comments: true,
    })
    expect(score.meta.insufficientData).toBe(false)
    expect(score.data.map(({ manga }) => manga.id)).toEqual(
      mangaIds.toReversed().slice(0, 5)
    )
    expect(score.data.every(({ score }) => score !== null)).toBe(true)

    const rawResponse = await app.request(
      "/v1/rankings/manga?metric=comments&window=day&limit=3"
    )
    expect(rawResponse.status).toBe(200)
    const raw = MangaRankingSchema.parse(await rawResponse.json())
    expect(raw.data.map(({ manga }) => manga.id)).toEqual(
      mangaIds.toReversed().slice(0, 3)
    )
    expect(raw.data.every(({ score }) => score === null)).toBe(true)
  })

  test("validates bounds and applies emergency visibility", async () => {
    expect((await app.request("/v1/rankings/manga?limit=51")).status).toBe(400)
    const hidden = createApp({
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
        hiddenMangaIds: [mangaIds.at(-1)!],
      },
      logger: noop,
    })
    const ranking = MangaRankingSchema.parse(
      await (
        await hidden.request(
          "/v1/rankings/manga?metric=views&window=all-time&limit=1"
        )
      ).json()
    )
    expect(ranking.data[0]?.manga.id).toBe(mangaIds.at(-2))
  })

  test("updates comment aggregate and daily contribution atomically", async () => {
    const mangaId = mangaIds[0]!
    const [beforeStats] = await runtime.database
      .select({ comments: mangaStats.comments })
      .from(mangaStats)
      .where(eq(mangaStats.mangaId, mangaId))
    const [beforeDaily] = await runtime.database
      .select({ comments: mangaEngagementDaily.comments })
      .from(mangaEngagementDaily)
      .where(
        and(
          eq(mangaEngagementDaily.mangaId, mangaId),
          eq(mangaEngagementDaily.bucketDate, engagementBucketDate())
        )
      )
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({
        name: "Phase 5A Ranking",
        email: commentEmail,
        password: "phase5a-ranking-password",
      }),
    })
    expect(signUp.status).toBe(200)
    const cookie = signUp.headers.get("set-cookie")?.split(";", 1)[0]
    const created = await app.request(
      `/v1/chapters/${chapterIds[0]}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie!,
          Origin: env.WEB_ORIGIN,
        },
        body: JSON.stringify({ body: "Ranking comment" }),
      }
    )
    expect(created.status).toBe(201)
    const { id, version } = (await created.json()) as {
      id: string
      version: number
    }
    commentIds.push(id)
    expect(
      (
        await runtime.database
          .select({ comments: mangaStats.comments })
          .from(mangaStats)
          .where(eq(mangaStats.mangaId, mangaId))
      )[0]?.comments
    ).toBe(beforeStats!.comments + 1n)

    const deleted = await app.request(`/v1/comments/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie!,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ expectedVersion: version }),
    })
    expect(deleted.status).toBe(200)
    expect(
      (
        await runtime.database
          .select({ comments: mangaStats.comments })
          .from(mangaStats)
          .where(eq(mangaStats.mangaId, mangaId))
      )[0]?.comments
    ).toBe(beforeStats!.comments)
    expect(
      (
        await runtime.database
          .select({ comments: mangaEngagementDaily.comments })
          .from(mangaEngagementDaily)
          .where(
            and(
              eq(mangaEngagementDaily.mangaId, mangaId),
              eq(mangaEngagementDaily.bucketDate, engagementBucketDate())
            )
          )
      )[0]?.comments
    ).toBe(beforeDaily!.comments)
  })
})
