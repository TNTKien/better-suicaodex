import type { OpenAPIHono } from "@hono/zod-openapi"
import { compareAsc, parseISO } from "date-fns"
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { Database } from "../../db/client.js"
import {
  chapter,
  manga,
  mangaVolume,
  notification,
  organization,
  systemNotice,
  systemNoticeState,
  user,
} from "../../db/schema.js"
import { apiError } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import type { Auth } from "../account/auth.js"
import { privateAccount } from "../account/guard.js"
import {
  normalizeDecimal,
  readableChapter,
  visibleManga,
  type CatalogDependencies,
  type CatalogVisibility,
} from "../catalog/routes.js"
import {
  listNotificationsRoute,
  readAllNotificationsRoute,
  readNotificationRoute,
  type Notification,
} from "./contract.js"

type NotificationDependencies = Pick<
  CatalogDependencies,
  "database" | "hiddenChapterIds" | "hiddenMangaIds" | "hideR18"
> & { auth?: Auth }
type Reader = Pick<Database, "select">
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
type Cursor = { createdAt: Date; id: string }
type NoticeContext = {
  userCreatedAt: Date
  readThroughCreatedAt: Date | null
  readThroughId: string | null
  stateUpdatedAt: Date | null
}
type NotificationRow = {
  id: string
  type: Exclude<Notification["type"], "system_notice">
  createdAt: Date
  readAt: Date | null
  mangaId: string | null
  mangaSlug: string | null
  mangaTitle: string | null
  chapterId: string | null
  chapterVolume: string | null
  chapterNumber: string | null
  chapterTitle: string | null
  groupId: string | null
  groupName: string | null
  actorId: string | null
  actorName: string | null
}

const notificationActor = alias(user, "notification_actor")

const visibleNotification = (userId: string, visibility: CatalogVisibility) =>
  and(
    eq(notification.userId, userId),
    or(
      and(
        eq(notification.type, "manga_new_chapter"),
        visibleManga(visibility),
        readableChapter(visibility)
      ),
      and(
        ne(notification.type, "manga_new_chapter"),
        isNotNull(notification.groupId)
      )
    )
  )

const olderThan = <T extends typeof notification | typeof systemNotice>(
  table: T,
  cursor?: Cursor
) =>
  cursor
    ? or(
        lt(table.createdAt, cursor.createdAt),
        and(eq(table.createdAt, cursor.createdAt), lt(table.id, cursor.id))
      )
    : undefined

const newerThan = (cursor?: Cursor) =>
  cursor
    ? or(
        gt(systemNotice.createdAt, cursor.createdAt),
        and(
          eq(systemNotice.createdAt, cursor.createdAt),
          gt(systemNotice.id, cursor.id)
        )
      )
    : undefined

async function noticeContext(
  database: Reader,
  userId: string
): Promise<NoticeContext> {
  const [row] = await database
    .select({
      userCreatedAt: user.createdAt,
      readThroughCreatedAt: systemNoticeState.readThroughCreatedAt,
      readThroughId: systemNoticeState.readThroughId,
      stateUpdatedAt: systemNoticeState.updatedAt,
    })
    .from(user)
    .leftJoin(systemNoticeState, eq(systemNoticeState.userId, user.id))
    .where(eq(user.id, userId))
  if (!row) throw new Error("Notification account is unavailable")
  return row
}

const readCursor = (context: NoticeContext): Cursor | undefined =>
  context.readThroughCreatedAt && context.readThroughId
    ? {
        createdAt: context.readThroughCreatedAt,
        id: context.readThroughId,
      }
    : undefined

async function unreadCount(
  database: Reader,
  userId: string,
  visibility: CatalogVisibility
) {
  const context = await noticeContext(database, userId)
  const [normal, global] = await Promise.all([
    database
      .select({ value: count() })
      .from(notification)
      .leftJoin(chapter, eq(chapter.id, notification.chapterId))
      .leftJoin(manga, eq(manga.id, notification.mangaId))
      .where(
        and(
          visibleNotification(userId, visibility),
          isNull(notification.readAt)
        )
      ),
    database
      .select({ value: count() })
      .from(systemNotice)
      .where(
        and(
          gt(systemNotice.createdAt, context.userCreatedAt),
          newerThan(readCursor(context))
        )
      ),
  ])
  return (normal[0]?.value ?? 0) + (global[0]?.value ?? 0)
}

function mapNotification(row: NotificationRow): Notification {
  const base = {
    id: row.id,
    createdAt: formatTimestamp(row.createdAt),
    readAt: row.readAt ? formatTimestamp(row.readAt) : null,
  }
  if (row.type === "manga_new_chapter") {
    if (!row.mangaId || !row.mangaSlug || !row.mangaTitle || !row.chapterId)
      throw new Error("Chapter notification target is unavailable")
    return {
      ...base,
      type: row.type,
      manga: {
        id: row.mangaId,
        slug: row.mangaSlug,
        title: row.mangaTitle,
      },
      chapter: {
        id: row.chapterId,
        volume: normalizeDecimal(row.chapterVolume),
        number: normalizeDecimal(row.chapterNumber),
        title: row.chapterTitle,
      },
    }
  }
  if (!row.groupId || !row.groupName)
    throw new Error("Group notification target is unavailable")
  return {
    ...base,
    type: row.type,
    group: { id: row.groupId, name: row.groupName },
    actor:
      row.actorId && row.actorName
        ? { id: row.actorId, name: row.actorName }
        : null,
  }
}

function isAfter(left: Cursor, right?: Cursor) {
  if (!right) return true
  const order = compareAsc(left.createdAt, right.createdAt)
  return order > 0 || (order === 0 && left.id > right.id)
}

async function advanceNoticeCursor(
  tx: Transaction,
  userId: string,
  cursor: Cursor,
  now: Date
) {
  await tx
    .insert(systemNoticeState)
    .values({
      userId,
      readThroughCreatedAt: cursor.createdAt,
      readThroughId: cursor.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemNoticeState.userId,
      set: {
        readThroughCreatedAt: cursor.createdAt,
        readThroughId: cursor.id,
        updatedAt: now,
      },
      setWhere: or(
        lt(systemNoticeState.readThroughCreatedAt, cursor.createdAt),
        and(
          eq(systemNoticeState.readThroughCreatedAt, cursor.createdAt),
          lt(systemNoticeState.readThroughId, cursor.id)
        )
      ),
    })
}

export function registerNotificationRoutes(
  app: OpenAPIHono,
  dependencies: NotificationDependencies
) {
  const { database } = dependencies
  const visibility: CatalogVisibility = dependencies
  app.use("/v1/me/notifications/*", privateAccount(dependencies))

  app.openapi(listNotificationsRoute, async (c) => {
    const { cursor, limit } = c.req.valid("query")
    const userId = c.get("accountUserId")
    const context = await noticeContext(database, userId)
    let anchor: Cursor | undefined
    if (cursor) {
      const [normalAnchor, noticeAnchor] = await Promise.all([
        database
          .select({ createdAt: notification.createdAt })
          .from(notification)
          .leftJoin(chapter, eq(chapter.id, notification.chapterId))
          .leftJoin(manga, eq(manga.id, notification.mangaId))
          .where(
            and(
              eq(notification.id, cursor),
              visibleNotification(userId, visibility)
            )
          ),
        database
          .select({ createdAt: systemNotice.createdAt })
          .from(systemNotice)
          .where(
            and(
              eq(systemNotice.id, cursor),
              gt(systemNotice.createdAt, context.userCreatedAt)
            )
          ),
      ])
      const found = normalAnchor[0] ?? noticeAnchor[0]
      if (!found)
        return c.json(
          apiError(
            "INVALID_CURSOR",
            "Notification cursor is invalid",
            c.get("requestId")
          ),
          400
        )
      anchor = { createdAt: found.createdAt, id: cursor }
    }

    const [normalRows, noticeRows, unread] = await Promise.all([
      database
        .select({
          id: notification.id,
          type: notification.type,
          createdAt: notification.createdAt,
          readAt: notification.readAt,
          mangaId: manga.id,
          mangaSlug: manga.slug,
          mangaTitle: manga.title,
          chapterId: chapter.id,
          chapterVolume: mangaVolume.number,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          groupId: organization.id,
          groupName: organization.name,
          actorId: notificationActor.id,
          actorName: notificationActor.name,
        })
        .from(notification)
        .leftJoin(chapter, eq(chapter.id, notification.chapterId))
        .leftJoin(manga, eq(manga.id, notification.mangaId))
        .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
        .leftJoin(organization, eq(organization.id, notification.groupId))
        .leftJoin(
          notificationActor,
          eq(notificationActor.id, notification.actorUserId)
        )
        .where(
          and(
            visibleNotification(userId, visibility),
            olderThan(notification, anchor)
          )
        )
        .orderBy(desc(notification.createdAt), desc(notification.id))
        .limit(limit + 1),
      database
        .select({
          id: systemNotice.id,
          title: systemNotice.title,
          createdAt: systemNotice.createdAt,
        })
        .from(systemNotice)
        .where(
          and(
            gt(systemNotice.createdAt, context.userCreatedAt),
            olderThan(systemNotice, anchor)
          )
        )
        .orderBy(desc(systemNotice.createdAt), desc(systemNotice.id))
        .limit(limit + 1),
      unreadCount(database, userId, visibility),
    ])
    const cursorState = readCursor(context)
    const rows = [
      ...normalRows.map((row) => ({
        cursor: { createdAt: row.createdAt, id: row.id },
        data: mapNotification(row),
      })),
      ...noticeRows.map((row) => ({
        cursor: { createdAt: row.createdAt, id: row.id },
        data: {
          id: row.id,
          type: "system_notice" as const,
          createdAt: formatTimestamp(row.createdAt),
          readAt: isAfter(row, cursorState)
            ? null
            : formatTimestamp(context.stateUpdatedAt!),
          notice: { id: row.id, title: row.title },
        },
      })),
    ].sort((left, right) =>
      isAfter(left.cursor, right.cursor)
        ? -1
        : isAfter(right.cursor, left.cursor)
          ? 1
          : 0
    )
    const data = rows.slice(0, limit).map(({ data }) => data)
    return c.json(
      {
        data,
        meta: {
          limit,
          nextCursor: rows.length > limit ? data.at(-1)!.id : null,
          unreadCount: unread,
        },
      },
      200
    )
  })

  app.openapi(readNotificationRoute, async (c) => {
    const { notificationId } = c.req.valid("param")
    const userId = c.get("accountUserId")
    const now = new Date()
    const result = await database.transaction(async (tx) => {
      const [visible] = await tx
        .select({ id: notification.id })
        .from(notification)
        .leftJoin(chapter, eq(chapter.id, notification.chapterId))
        .leftJoin(manga, eq(manga.id, notification.mangaId))
        .where(
          and(
            eq(notification.id, notificationId),
            visibleNotification(userId, visibility)
          )
        )
      if (visible) {
        const [updated] = await tx
          .update(notification)
          .set({ readAt: sql`coalesce(${notification.readAt}, ${now})` })
          .where(
            and(
              eq(notification.id, notificationId),
              eq(notification.userId, userId)
            )
          )
          .returning({ id: notification.id, readAt: notification.readAt })
        if (!updated?.readAt)
          throw new Error("Notification read timestamp is unavailable")
        return {
          data: { id: updated.id, readAt: formatTimestamp(updated.readAt) },
          meta: { unreadCount: await unreadCount(tx, userId, visibility) },
        }
      }

      const context = await noticeContext(tx, userId)
      const [notice] = await tx
        .select({ id: systemNotice.id, createdAt: systemNotice.createdAt })
        .from(systemNotice)
        .where(
          and(
            eq(systemNotice.id, notificationId),
            gt(systemNotice.createdAt, context.userCreatedAt)
          )
        )
      if (!notice) return null
      await advanceNoticeCursor(tx, userId, notice, now)
      const [state] = await tx
        .select({ updatedAt: systemNoticeState.updatedAt })
        .from(systemNoticeState)
        .where(eq(systemNoticeState.userId, userId))
      if (!state) throw new Error("System notice read state is unavailable")
      return {
        data: { id: notice.id, readAt: formatTimestamp(state.updatedAt) },
        meta: { unreadCount: await unreadCount(tx, userId, visibility) },
      }
    })
    if (!result)
      return c.json(
        apiError("NOT_FOUND", "Notification not found", c.get("requestId")),
        404
      )
    return c.json(result, 200)
  })

  app.openapi(readAllNotificationsRoute, async (c) => {
    const userId = c.get("accountUserId")
    const result = await database.transaction(async (tx) => {
      const cutoffExpression = sql<Date>`transaction_timestamp()`
      const cutoffResult = await tx.execute<{ cutoff: string }>(
        sql`select transaction_timestamp() as cutoff`
      )
      const cutoffValue = cutoffResult.rows[0]?.cutoff
      if (!cutoffValue) throw new Error("Notification cutoff is unavailable")
      const cutoff = parseISO(cutoffValue)
      const visibleUnreadIds = tx
        .select({ id: notification.id })
        .from(notification)
        .leftJoin(chapter, eq(chapter.id, notification.chapterId))
        .leftJoin(manga, eq(manga.id, notification.mangaId))
        .where(
          and(
            visibleNotification(userId, visibility),
            isNull(notification.readAt),
            lte(notification.createdAt, cutoffExpression)
          )
        )
      const updated = await tx
        .update(notification)
        .set({ readAt: cutoffExpression })
        .where(
          and(
            inArray(notification.id, visibleUnreadIds),
            isNull(notification.readAt),
            lte(notification.createdAt, cutoffExpression)
          )
        )
        .returning({ id: notification.id })

      const context = await noticeContext(tx, userId)
      const unreadSystemCondition = and(
        gt(systemNotice.createdAt, context.userCreatedAt),
        lte(systemNotice.createdAt, cutoffExpression),
        newerThan(readCursor(context))
      )
      const [[newest], [systemUnread]] = await Promise.all([
        tx
          .select({ id: systemNotice.id, createdAt: systemNotice.createdAt })
          .from(systemNotice)
          .where(unreadSystemCondition)
          .orderBy(desc(systemNotice.createdAt), desc(systemNotice.id))
          .limit(1),
        tx
          .select({ value: count() })
          .from(systemNotice)
          .where(unreadSystemCondition),
      ])
      if (newest) await advanceNoticeCursor(tx, userId, newest, cutoff)
      return {
        data: {
          updated: updated.length + (systemUnread?.value ?? 0),
          cutoff: formatTimestamp(cutoff),
        },
        meta: { unreadCount: await unreadCount(tx, userId, visibility) },
      }
    })
    return c.json(result, 200)
  })
}
