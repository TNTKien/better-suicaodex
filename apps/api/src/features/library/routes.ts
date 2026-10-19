import type { OpenAPIHono } from "@hono/zod-openapi"
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import { cover, libraryItem, manga } from "../../db/schema.js"
import { apiError } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import type { Auth } from "../account/auth.js"
import { privateAccount } from "../account/guard.js"
import {
  hydrateMangaRows,
  mangaTitleSearch,
  mangaSummaryColumns,
  type CatalogDependencies,
  visibleManga,
} from "../catalog/routes.js"
import {
  addDailyEngagement,
  engagementBucketDate,
} from "../ranking/engagement.js"
import {
  deleteLibraryItemRoute,
  getLibraryItemRoute,
  listLibraryRoute,
  putLibraryItemRoute,
  type LibraryItem,
  type LibrarySort,
} from "./contract.js"

type LibraryDependencies = Omit<CatalogDependencies, "cache"> & { auth?: Auth }
const libraryColumns = {
  mangaId: libraryItem.mangaId,
  category: libraryItem.category,
  createdAt: libraryItem.createdAt,
  updatedAt: libraryItem.updatedAt,
}
type LibraryRow = Pick<
  typeof libraryItem.$inferSelect,
  keyof typeof libraryColumns
>
type MangaRow = Parameters<typeof hydrateMangaRows>[2][number]

function loadMangaRows(
  database: Pick<Database, "select">,
  ids: string[],
  dependencies: LibraryDependencies
) {
  return database
    .select(mangaSummaryColumns)
    .from(manga)
    .leftJoin(
      cover,
      and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
    )
    .where(and(inArray(manga.id, ids), visibleManga(dependencies)))
}

export function registerLibraryRoutes(
  app: OpenAPIHono,
  dependencies: LibraryDependencies
) {
  const { database, assetBaseUrl } = dependencies
  app.use("/v1/me/library/*", privateAccount(dependencies))

  async function hydrate(
    rows: { item: LibraryRow; manga: MangaRow }[]
  ): Promise<LibraryItem[]> {
    const summaries = await hydrateMangaRows(
      database,
      assetBaseUrl,
      rows.map(({ manga }) => manga),
      dependencies
    )
    return rows.map(({ item }, index) => ({
      category: item.category,
      createdAt: formatTimestamp(item.createdAt),
      updatedAt: formatTimestamp(item.updatedAt),
      manga: summaries[index]!,
    }))
  }

  app.openapi(listLibraryRoute, async (c) => {
    const { category, cursor, limit, q, sort } = c.req.valid("query")
    const userId = c.get("accountUserId")
    const search = q?.replace(/\s+/g, " ").toLowerCase()
    const owned = and(
      eq(libraryItem.userId, userId),
      category ? eq(libraryItem.category, category) : undefined
    )
    const filtered = and(
      owned,
      search ? mangaTitleSearch(search) : undefined,
      visibleManga(dependencies)
    )
    let cursorCondition: SQL | undefined
    if (cursor) {
      const [anchor] = await database
        .select({
          createdAt: sql<string>`${libraryItem.createdAt}::text`,
          latestChapterPublishedAt: sql<
            string | null
          >`${manga.latestChapterPublishedAt}::text`,
        })
        .from(libraryItem)
        .innerJoin(manga, eq(manga.id, libraryItem.mangaId))
        .where(and(filtered, eq(libraryItem.mangaId, cursor)))
      if (!anchor)
        return c.json(
          apiError(
            "INVALID_CURSOR",
            "Library cursor is invalid",
            c.get("requestId")
          ),
          400
        )
      // Keep PostgreSQL precision for imported rows; JS Date would truncate microseconds.
      cursorCondition = libraryCursor(sort, anchor, cursor)
    }
    const rows = await database
      .select({ item: libraryColumns, manga: mangaSummaryColumns })
      .from(libraryItem)
      .innerJoin(manga, eq(manga.id, libraryItem.mangaId))
      .leftJoin(
        cover,
        and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
      )
      .where(and(filtered, cursorCondition))
      .orderBy(...libraryOrder(sort))
      .limit(limit + 1)
    return c.json(
      {
        data: await hydrate(rows.slice(0, limit)),
        meta: {
          limit,
          nextCursor:
            rows.length > limit ? rows[limit - 1]!.item.mangaId : null,
        },
      },
      200
    )
  })

  app.openapi(getLibraryItemRoute, async (c) => {
    const { mangaId } = c.req.valid("param")
    const [mangaRow] = await loadMangaRows(database, [mangaId], dependencies)
    if (!mangaRow)
      return c.json(
        apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
        404
      )
    const [item] = await database
      .select(libraryColumns)
      .from(libraryItem)
      .where(
        and(
          eq(libraryItem.userId, c.get("accountUserId")),
          eq(libraryItem.mangaId, mangaId)
        )
      )
    const data = item ? (await hydrate([{ item, manga: mangaRow }]))[0]! : null
    return c.json({ data }, 200)
  })

  app.openapi(putLibraryItemRoute, async (c) => {
    const { mangaId } = c.req.valid("param")
    const { category } = c.req.valid("json")
    const [mangaRow] = await loadMangaRows(database, [mangaId], dependencies)
    if (!mangaRow)
      return c.json(
        apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
        404
      )
    const now = new Date()
    const userId = c.get("accountUserId")
    const item = await database.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(libraryItem)
        .values({ userId, mangaId, category, createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .returning(libraryColumns)
      if (inserted) {
        await addDailyEngagement(tx, mangaId, engagementBucketDate(now), {
          followAdds: 1n,
        })
        return inserted
      }

      const [updated] = await tx
        .update(libraryItem)
        .set({ category, updatedAt: now })
        .where(
          and(eq(libraryItem.userId, userId), eq(libraryItem.mangaId, mangaId))
        )
        .returning(libraryColumns)
      return updated!
    })
    const [data] = await hydrate([{ item: item!, manga: mangaRow }])
    return c.json({ data: data! }, 200)
  })

  app.openapi(deleteLibraryItemRoute, async (c) => {
    const { mangaId } = c.req.valid("param")
    await database.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(libraryItem)
        .where(
          and(
            eq(libraryItem.userId, c.get("accountUserId")),
            eq(libraryItem.mangaId, mangaId)
          )
        )
        .returning({ mangaId: libraryItem.mangaId })
      if (deleted)
        await addDailyEngagement(tx, mangaId, engagementBucketDate(), {
          followRemoves: 1n,
        })
    })
    return c.body(null, 204)
  })
}

function libraryOrder(sort: LibrarySort) {
  return sort === "latestChapter"
    ? [
        sql`${manga.latestChapterPublishedAt} desc nulls last`,
        desc(libraryItem.createdAt),
        desc(libraryItem.mangaId),
      ]
    : [desc(libraryItem.createdAt), desc(libraryItem.mangaId)]
}

function libraryCursor(
  sort: LibrarySort,
  anchor: { createdAt: string; latestChapterPublishedAt: string | null },
  mangaId: string
) {
  if (sort === "addedAt")
    return sql`(${libraryItem.createdAt}, ${libraryItem.mangaId}) < (${anchor.createdAt}::timestamptz, ${mangaId}::uuid)`

  return anchor.latestChapterPublishedAt
    ? sql`(
        ${manga.latestChapterPublishedAt} is null
        or ${manga.latestChapterPublishedAt} < ${anchor.latestChapterPublishedAt}::timestamptz
        or (
          ${manga.latestChapterPublishedAt} = ${anchor.latestChapterPublishedAt}::timestamptz
          and (${libraryItem.createdAt}, ${libraryItem.mangaId}) < (${anchor.createdAt}::timestamptz, ${mangaId}::uuid)
        )
      )`
    : sql`${manga.latestChapterPublishedAt} is null
        and (${libraryItem.createdAt}, ${libraryItem.mangaId}) < (${anchor.createdAt}::timestamptz, ${mangaId}::uuid)`
}
