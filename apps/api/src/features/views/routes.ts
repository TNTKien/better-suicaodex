import { randomUUID } from "node:crypto"
import { differenceInSeconds } from "date-fns"

import type { OpenAPIHono } from "@hono/zod-openapi"
import { and, eq, gt } from "drizzle-orm"
import { getSignedCookie, setSignedCookie } from "hono/cookie"

import {
  chapter,
  chapterStats,
  coinViewReceipt,
  manga,
} from "../../db/schema.js"
import { stableHash, type BusinessCache } from "../../shared/cache.js"
import { apiError } from "../../shared/contract.js"
import {
  readableChapter,
  visibleManga,
  type CatalogDependencies,
  type CatalogVisibility,
} from "../catalog/routes.js"
import { addViewEngagement } from "../ranking/engagement.js"
import { acceptCoinView } from "../coin/views.js"
import type { CoinService } from "../coin/service.js"
import { completeChapterViewRoute, startChapterViewRoute } from "./contract.js"
import {
  CHAPTER_VIEW_COOKIE,
  CHAPTER_VIEW_WINDOW_SECONDS,
  chapterViewThreshold,
  createChapterViewToken,
  verifyChapterViewToken,
} from "./tracking.js"

type ViewDependencies = Pick<
  CatalogDependencies,
  "database" | "hiddenChapterIds" | "hiddenMangaIds" | "hideR18"
> & {
  cache: Pick<BusinessCache, "acquireLock" | "status"> &
    Partial<Pick<BusinessCache, "lockRemainingMilliseconds">>
  now?: () => Date
  secret?: string
  secureCookie?: boolean
  coin?: CoinService
  excludedCoinGroupIds?: readonly string[]
}

async function viewableChapter(
  dependencies: ViewDependencies,
  id: string,
  visibility: CatalogVisibility
) {
  const [row] = await dependencies.database
    .select({
      id: chapter.id,
      mangaId: chapter.mangaId,
      pageCount: chapter.availablePageCount,
      views: chapterStats.views,
    })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .leftJoin(chapterStats, eq(chapterStats.chapterId, chapter.id))
    .where(
      and(
        eq(chapter.id, id),
        readableChapter(visibility),
        visibleManga(visibility)
      )
    )
    .limit(1)
  return row ?? null
}

export function registerViewRoutes(
  app: OpenAPIHono,
  dependencies: ViewDependencies
) {
  const visibility: CatalogVisibility = dependencies
  const now = dependencies.now ?? (() => new Date())

  app.openapi(startChapterViewRoute, async (c) => {
    const { id } = c.req.valid("param")
    const identity = await viewableChapter(dependencies, id, visibility)
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
        404
      )
    if (!dependencies.secret)
      return c.json(
        apiError(
          "VIEW_TRACKING_UNAVAILABLE",
          "View tracking is unavailable",
          c.get("requestId")
        ),
        503
      )

    const existing = await getSignedCookie(
      c,
      dependencies.secret,
      CHAPTER_VIEW_COOKIE
    )
    const sessionId = typeof existing === "string" ? existing : randomUUID()
    if (typeof existing !== "string") {
      await setSignedCookie(
        c,
        CHAPTER_VIEW_COOKIE,
        sessionId,
        dependencies.secret,
        {
          httpOnly: true,
          maxAge: 365 * 24 * 60 * 60,
          path: "/",
          sameSite: "Lax",
          secure: dependencies.secureCookie ?? false,
        }
      )
    }

    const required = chapterViewThreshold(identity.pageCount)
    return c.json(
      {
        token: createChapterViewToken(
          id,
          sessionId,
          dependencies.secret,
          now()
        ),
        requiredPages: required,
        requiredSeconds: required,
      },
      200
    )
  })

  app.openapi(completeChapterViewRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { seenPages, token } = c.req.valid("json")
    const identity = await viewableChapter(dependencies, id, visibility)
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
        404
      )
    if (!dependencies.secret)
      return c.json(
        apiError(
          "VIEW_TRACKING_UNAVAILABLE",
          "View tracking is unavailable",
          c.get("requestId")
        ),
        503
      )

    const sessionId = await getSignedCookie(
      c,
      dependencies.secret,
      CHAPTER_VIEW_COOKIE
    )
    const currentTime = now()
    const parsed =
      typeof sessionId === "string"
        ? verifyChapterViewToken(
            token,
            id,
            sessionId,
            dependencies.secret,
            currentTime
          )
        : null
    if (!parsed)
      return c.json(
        apiError(
          "INVALID_VIEW_SESSION",
          "View session is invalid or expired",
          c.get("requestId")
        ),
        403
      )

    const requiredPages = chapterViewThreshold(identity.pageCount)
    const seenSeconds = Math.max(
      0,
      differenceInSeconds(currentTime, parsed.startedAt)
    )
    const retryAfterSeconds = Math.max(0, requiredPages - seenSeconds)
    const base = {
      alreadyCounted: false,
      trackingAvailable: true,
      viewCount: Number(identity.views ?? 0),
      seenPages,
      seenSeconds,
      requiredPages,
      retryAfterSeconds,
    }
    if (retryAfterSeconds > 0) return c.json({ ...base, counted: false }, 200)

    if (dependencies.coin?.enabled) {
      const cachedRemainingMilliseconds =
        (await dependencies.cache.lockRemainingMilliseconds?.(
          `chapter-view:${stableHash([sessionId, id])}`
        )) ?? 0
      const accepted = await dependencies.database.transaction((tx) =>
        acceptCoinView(tx, dependencies.coin!, {
          sessionHash: stableHash([sessionId, id]),
          chapterId: id,
          mangaId: identity.mangaId,
          now: currentTime,
          excludedGroupIds: dependencies.excludedCoinGroupIds ?? [],
          cachedRemainingMilliseconds,
        })
      )
      return c.json({ ...base, ...accepted, retryAfterSeconds: 0 }, 200)
    }

    // Disabling rewards must not forget an already accepted DB view window.
    if (dependencies.coin) {
      const [receipt] = await dependencies.database
        .select({ eventId: coinViewReceipt.eventId })
        .from(coinViewReceipt)
        .where(
          and(
            eq(coinViewReceipt.sessionHash, stableHash([sessionId, id])),
            eq(coinViewReceipt.chapterId, id),
            gt(coinViewReceipt.expiresAt, currentTime)
          )
        )
        .limit(1)
      if (receipt)
        return c.json(
          {
            ...base,
            counted: false,
            alreadyCounted: true,
            retryAfterSeconds: 0,
          },
          200
        )
    }

    const release = await dependencies.cache.acquireLock(
      `chapter-view:${stableHash([sessionId, id])}`,
      CHAPTER_VIEW_WINDOW_SECONDS
    )
    if (!release) {
      const trackingAvailable = dependencies.cache.status === "healthy"
      return c.json(
        {
          ...base,
          counted: false,
          alreadyCounted: trackingAvailable,
          trackingAvailable,
          retryAfterSeconds: 0,
        },
        200
      )
    }

    try {
      const viewCount = await dependencies.database.transaction((transaction) =>
        addViewEngagement(transaction, id, identity.mangaId, currentTime)
      )
      return c.json(
        {
          ...base,
          counted: true,
          viewCount,
          retryAfterSeconds: 0,
        },
        200
      )
    } catch (error) {
      await release()
      throw error
    }
  })
}
