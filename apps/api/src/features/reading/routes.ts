import type { OpenAPIHono } from "@hono/zod-openapi"
import { addMinutes, isAfter, parseISO } from "date-fns"
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  chapter,
  cover,
  manga,
  mangaVolume,
  readingHistory,
} from "../../db/schema.js"
import { apiError } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import type { Auth } from "../account/auth.js"
import { privateAccount } from "../account/guard.js"
import {
  normalizeDecimal,
  readableChapter,
  resolveCoverUrl,
  visibleManga,
  type CatalogDependencies,
  type CatalogVisibility,
} from "../catalog/routes.js"
import {
  deleteProgressRoute,
  getProgressRoute,
  listHistoryRoute,
  listMangaHistoryRoute,
  listProgressRoute,
  mergeHistoryRoute,
  putProgressRoute,
  type MangaReadingHistoryItem,
  type MergeHistoryResult,
  type ReadingProgress,
} from "./contract.js"
import { markChapterNotificationsRead } from "../notifications/service.js"

type ReadingDependencies = Pick<
  CatalogDependencies,
  | "database"
  | "assetBaseUrl"
  | "hideR18"
  | "hiddenMangaIds"
  | "hiddenChapterIds"
> & { auth?: Auth }
type ProgressDatabase = Pick<Database, "insert" | "select">

const progressColumns = {
  chapterId: readingHistory.chapterId,
  mangaId: readingHistory.mangaId,
  readAt: readingHistory.readAt,
  updatedAt: readingHistory.updatedAt,
}
type ProgressRow = Omit<ReadingProgress, "readAt" | "updatedAt"> & {
  readAt: Date
  updatedAt: Date
}
type MangaHistoryRow = ProgressRow & {
  chapterLanguage: string
  chapterNumber: string | null
  chapterTitle: string | null
  chapterVolume: string | null
  coverHeight: number | null
  coverKey: string | null
  coverWidth: number | null
  mangaSlug: string
  mangaTitle: string
}
function mapProgress(row: ProgressRow): ReadingProgress {
  return {
    ...row,
    readAt: formatTimestamp(row.readAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}

async function readableChapters(
  database: ProgressDatabase,
  ids: string[],
  visibility: CatalogVisibility
) {
  return database
    .select({
      id: chapter.id,
      mangaId: chapter.mangaId,
    })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .where(
      and(
        inArray(chapter.id, ids),
        readableChapter(visibility),
        visibleManga(visibility)
      )
    )
}

type ProgressWrite = {
  chapterId: string
  mangaId: string
  readAt: Date
  legacy: boolean
}

async function upsertProgress(
  database: ProgressDatabase,
  userId: string,
  entries: ProgressWrite[],
  now: Date
) {
  if (entries.length === 0) return []
  const timedIds = entries
    .filter(({ legacy }) => !legacy)
    .map(({ chapterId }) => chapterId)
  // Same lock order across concurrent merge batches, regardless of client order.
  const ordered = [...entries].sort((a, b) =>
    a.chapterId < b.chapterId ? -1 : a.chapterId > b.chapterId ? 1 : 0
  )
  return database
    .insert(readingHistory)
    .values(
      ordered.map((entry) => ({
        userId,
        chapterId: entry.chapterId,
        mangaId: entry.mangaId,
        readAt: entry.readAt,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: [readingHistory.userId, readingHistory.chapterId],
      set: {
        readAt: sql`excluded.read_at`,
        updatedAt: now,
      },
      setWhere: and(
        timedIds.length > 0
          ? inArray(readingHistory.chapterId, timedIds)
          : sql`false`,
        sql`excluded.read_at > ${readingHistory.readAt}`
      ),
    })
    .returning(progressColumns)
}

export function registerReadingRoutes(
  app: OpenAPIHono,
  dependencies: ReadingDependencies
) {
  const { database } = dependencies
  const visibility: CatalogVisibility = dependencies
  for (const path of [
    "/v1/me/reading-progress/*",
    "/v1/me/reading-history/*",
  ]) {
    app.use(path, privateAccount(dependencies))
  }

  app.openapi(getProgressRoute, async (c) => {
    const { chapterId } = c.req.valid("param")
    const [identity] = await readableChapters(database, [chapterId], visibility)
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
        404
      )
    const [row] = await database
      .select(progressColumns)
      .from(readingHistory)
      .where(
        and(
          eq(readingHistory.userId, c.get("accountUserId")),
          eq(readingHistory.chapterId, chapterId)
        )
      )
    return c.json({ data: row ? mapProgress(row) : null }, 200)
  })

  app.openapi(listProgressRoute, async (c) => {
    const { mangaId } = c.req.valid("query")
    const [identity] = await database
      .select({ id: manga.id })
      .from(manga)
      .where(and(eq(manga.id, mangaId), visibleManga(visibility)))
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
        404
      )
    const rows = await database
      .select(progressColumns)
      .from(readingHistory)
      .innerJoin(chapter, eq(chapter.id, readingHistory.chapterId))
      .innerJoin(manga, eq(manga.id, readingHistory.mangaId))
      .where(
        and(
          eq(readingHistory.userId, c.get("accountUserId")),
          eq(readingHistory.mangaId, mangaId),
          readableChapter(visibility),
          visibleManga(visibility)
        )
      )
      .orderBy(desc(readingHistory.readAt), desc(readingHistory.chapterId))
    return c.json({ data: rows.map(mapProgress) }, 200)
  })

  app.openapi(putProgressRoute, async (c) => {
    const { chapterId } = c.req.valid("param")
    const input = c.req.valid("json")
    const [identity] = await readableChapters(database, [chapterId], visibility)
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
        404
      )
    const now = new Date()
    const readAt = input.readAt ? parseISO(input.readAt) : now
    if (isAfter(readAt, addMinutes(now, 5)))
      return c.json(
        apiError(
          "FUTURE_READ_AT",
          "readAt is more than five minutes in the future",
          c.get("requestId")
        ),
        400
      )
    const userId = c.get("accountUserId")
    const result = await database.transaction(async (tx) => {
      const [written] = await upsertProgress(
        tx,
        userId,
        [{ ...identity, chapterId, ...input, readAt, legacy: false }],
        now
      )
      let result = written
      if (!result) {
        // The conflict row remains locked until this transaction ends.
        const [existing] = await tx
          .select(progressColumns)
          .from(readingHistory)
          .where(
            and(
              eq(readingHistory.userId, userId),
              eq(readingHistory.chapterId, chapterId)
            )
          )
        if (!existing) throw new Error("Progress conflict row is unavailable")
        result = existing
      }
      await markChapterNotificationsRead(tx, userId, [chapterId], now)
      return result
    })
    return c.json({ data: mapProgress(result) }, 200)
  })

  app.openapi(deleteProgressRoute, async (c) => {
    const { chapterId } = c.req.valid("param")
    await database
      .delete(readingHistory)
      .where(
        and(
          eq(readingHistory.userId, c.get("accountUserId")),
          eq(readingHistory.chapterId, chapterId)
        )
      )
    return c.body(null, 204)
  })

  app.openapi(listHistoryRoute, async (c) => {
    const { cursor, limit } = c.req.valid("query")
    const userId = c.get("accountUserId")
    let cursorCondition
    if (cursor) {
      const [anchor] = await database
        .select({ readAt: readingHistory.readAt })
        .from(readingHistory)
        .where(
          and(
            eq(readingHistory.userId, userId),
            eq(readingHistory.chapterId, cursor)
          )
        )
      if (!anchor)
        return c.json(
          apiError(
            "INVALID_CURSOR",
            "History cursor is invalid",
            c.get("requestId")
          ),
          400
        )
      cursorCondition = or(
        lt(readingHistory.readAt, anchor.readAt),
        and(
          eq(readingHistory.readAt, anchor.readAt),
          lt(readingHistory.chapterId, cursor)
        )
      )
    }
    const rows = await database
      .select({
        progress: progressColumns,
        chapter: {
          id: chapter.id,
          volume: mangaVolume.number,
          number: chapter.number,
          title: chapter.title,
          language: chapter.language,
        },
        manga: {
          id: manga.id,
          slug: manga.slug,
          title: manga.title,
        },
        cover: {
          key: cover.storageKey,
          width: cover.width,
          height: cover.height,
        },
      })
      .from(readingHistory)
      .innerJoin(chapter, eq(chapter.id, readingHistory.chapterId))
      .innerJoin(manga, eq(manga.id, readingHistory.mangaId))
      .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
      .leftJoin(
        cover,
        and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
      )
      .where(
        and(
          eq(readingHistory.userId, userId),
          cursorCondition,
          readableChapter(visibility),
          visibleManga(visibility)
        )
      )
      .orderBy(desc(readingHistory.readAt), desc(readingHistory.chapterId))
      .limit(limit + 1)
    const data = rows.slice(0, limit).map((row) => ({
      progress: mapProgress(row.progress),
      chapter: {
        ...row.chapter,
        volume: normalizeDecimal(row.chapter.volume),
        number: normalizeDecimal(row.chapter.number),
      },
      manga: {
        id: row.manga.id,
        slug: row.manga.slug,
        title: row.manga.title,
        cover: row.cover
          ? {
              url: resolveCoverUrl(dependencies.assetBaseUrl, row.cover.key),
              width: row.cover.width,
              height: row.cover.height,
            }
          : null,
      },
    }))
    return c.json(
      {
        data,
        meta: {
          limit,
          nextCursor:
            rows.length > limit ? data.at(-1)!.progress.chapterId : null,
        },
      },
      200
    )
  })

  app.openapi(listMangaHistoryRoute, async (c) => {
    const { cursor, limit } = c.req.valid("query")
    const userId = c.get("accountUserId")
    let cursorAnchor: { mangaId: string; readAt: Date } | undefined
    if (cursor) {
      const [anchor] = await database
        .select({
          mangaId: readingHistory.mangaId,
          readAt: readingHistory.readAt,
        })
        .from(readingHistory)
        .where(
          and(
            eq(readingHistory.userId, userId),
            eq(readingHistory.chapterId, cursor)
          )
        )
      if (!anchor)
        return c.json(
          apiError(
            "INVALID_CURSOR",
            "History cursor is invalid",
            c.get("requestId")
          ),
          400
        )
      cursorAnchor = anchor
    }
    const cursorCondition = cursorAnchor
      ? sql`and (
          latest_read_at < ${cursorAnchor.readAt}
          or (
            latest_read_at = ${cursorAnchor.readAt}
            and manga_id < ${cursorAnchor.mangaId}
          )
        )`
      : sql``
    const visibilityCondition = and(
      readableChapter(visibility),
      visibleManga(visibility)
    )!
    const result = await database.execute(sql<MangaHistoryRow>`
      with ranked_history as (
        select
          ${readingHistory.chapterId} chapter_id,
          ${readingHistory.mangaId} manga_id,
          ${readingHistory.readAt} read_at,
          ${readingHistory.updatedAt} updated_at,
          ${mangaVolume.number} chapter_volume,
          ${chapter.number} chapter_number,
          ${chapter.title} chapter_title,
          ${chapter.language} chapter_language,
          ${manga.slug} manga_slug,
          ${manga.title} manga_title,
          ${cover.storageKey} cover_key,
          ${cover.width} cover_width,
          ${cover.height} cover_height,
          row_number() over (
            partition by ${readingHistory.mangaId}
            order by ${readingHistory.readAt} desc, ${readingHistory.chapterId} desc
          ) chapter_rank,
          max(${readingHistory.readAt}) over (
            partition by ${readingHistory.mangaId}
          ) latest_read_at
        from ${readingHistory}
        inner join ${chapter} on ${chapter.id} = ${readingHistory.chapterId}
        inner join ${manga} on ${manga.id} = ${readingHistory.mangaId}
        left join ${mangaVolume} on ${mangaVolume.id} = ${chapter.volumeId}
        left join ${cover} on ${cover.mangaId} = ${manga.id}
          and ${cover.isPrimary} = true
        where ${readingHistory.userId} = ${userId}
          and ${visibilityCondition}
      ),
      manga_page as (
        select manga_id, latest_read_at
        from ranked_history
        where chapter_rank = 1
          ${cursorCondition}
        order by latest_read_at desc, manga_id desc
        limit ${limit + 1}
      )
      select
        ranked_history.chapter_id "chapterId",
        ranked_history.manga_id "mangaId",
        ranked_history.read_at "readAt",
        ranked_history.updated_at "updatedAt",
        ranked_history.chapter_volume "chapterVolume",
        ranked_history.chapter_number "chapterNumber",
        ranked_history.chapter_title "chapterTitle",
        ranked_history.chapter_language "chapterLanguage",
        ranked_history.manga_slug "mangaSlug",
        ranked_history.manga_title "mangaTitle",
        ranked_history.cover_key "coverKey",
        ranked_history.cover_width "coverWidth",
        ranked_history.cover_height "coverHeight"
      from ranked_history
      inner join manga_page using (manga_id, latest_read_at)
      where ranked_history.chapter_rank <= 3
      order by manga_page.latest_read_at desc, manga_page.manga_id desc,
        ranked_history.chapter_rank asc
    `)
    const groups = new Map<string, MangaReadingHistoryItem>()
    for (const row of result.rows as MangaHistoryRow[]) {
      const chapterItem = {
        progress: mapProgress({
          chapterId: row.chapterId,
          mangaId: row.mangaId,
          readAt: row.readAt,
          updatedAt: row.updatedAt,
        }),
        chapter: {
          id: row.chapterId,
          volume: normalizeDecimal(row.chapterVolume),
          number: normalizeDecimal(row.chapterNumber),
          title: row.chapterTitle,
          language: row.chapterLanguage,
        },
      }
      const group = groups.get(row.mangaId)
      if (group) group.chapters.push(chapterItem)
      else
        groups.set(row.mangaId, {
          manga: {
            id: row.mangaId,
            slug: row.mangaSlug,
            title: row.mangaTitle,
            cover: row.coverKey
              ? {
                  url: resolveCoverUrl(dependencies.assetBaseUrl, row.coverKey),
                  width: row.coverWidth,
                  height: row.coverHeight,
                }
              : null,
          },
          chapters: [chapterItem],
        })
    }
    const page = [...groups.values()]
    const hasMore = page.length > limit
    const data = page.slice(0, limit)
    return c.json(
      {
        data,
        meta: {
          limit,
          nextCursor: hasMore
            ? data.at(-1)!.chapters[0]!.progress.chapterId
            : null,
        },
      },
      200
    )
  })

  app.openapi(mergeHistoryRoute, async (c) => {
    const { entries } = c.req.valid("json")
    const userId = c.get("accountUserId")
    const now = new Date()
    const futureLimit = addMinutes(now, 5)
    const result = await database.transaction(async (tx) => {
      const identities = new Map(
        (
          await readableChapters(
            tx,
            entries.map(({ chapterId }) => chapterId),
            visibility
          )
        ).map((row) => [row.id, row])
      )
      const valid: ProgressWrite[] = []
      const ignored: MergeHistoryResult["ignored"] = []
      for (const entry of entries) {
        const identity = identities.get(entry.chapterId)
        const readAt = entry.readAt ? parseISO(entry.readAt) : now
        const reason = !identity
          ? "not_found"
          : isAfter(readAt, futureLimit)
            ? "future_read_at"
            : null
        if (reason)
          ignored.push({
            chapterId: entry.chapterId,
            reason,
            acknowledged: false,
          })
        else
          valid.push({
            ...identity!,
            ...entry,
            readAt,
            legacy: entry.readAt === undefined,
          })
      }
      const written = await upsertProgress(tx, userId, valid, now)
      const mergedIds = new Set(written.map(({ chapterId }) => chapterId))
      for (const entry of valid) {
        if (!mergedIds.has(entry.chapterId))
          ignored.push({
            chapterId: entry.chapterId,
            reason: entry.legacy ? "legacy_existing" : "stale",
            acknowledged: true,
          })
      }
      await markChapterNotificationsRead(
        tx,
        userId,
        valid.map(({ chapterId }) => chapterId),
        now
      )
      return { merged: written.map(mapProgress), ignored }
    })
    return c.json(result, 200)
  })
}
