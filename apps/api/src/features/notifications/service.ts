import { and, eq, inArray, ne, sql } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  chapter,
  libraryItem,
  manga,
  member,
  notification,
} from "../../db/schema.js"
import { errorFields } from "../../shared/logger.js"
import type { Logger } from "../../shared/logger.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  readableChapter,
  visibleManga,
  type CatalogVisibility,
} from "../catalog/routes.js"

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
type GroupNotificationType = Exclude<
  typeof notification.$inferInsert.type,
  "manga_new_chapter"
>

export async function createGroupNotification(
  tx: Transaction,
  input: {
    userId: string
    type: GroupNotificationType
    groupId: string
    actorUserId?: string
  }
) {
  await tx.insert(notification).values(input)
}

export async function notifyGroupOwnersOfContent(
  tx: Transaction,
  groupIds: string[],
  actorUserId: string
) {
  if (groupIds.length === 0) return
  const recipients = await tx
    .select({ groupId: member.organizationId, userId: member.userId })
    .from(member)
    .where(
      and(
        inArray(member.organizationId, groupIds),
        eq(member.role, "owner"),
        ne(member.userId, actorUserId)
      )
    )
  if (recipients.length === 0) return
  await tx.insert(notification).values(
    recipients.map(({ groupId, userId }) => ({
      actorUserId,
      groupId,
      type: "content_group_added" as const,
      userId,
    }))
  )
}

export async function resolveGroupJoinRequestNotification(
  tx: Transaction,
  groupId: string,
  actorUserId: string,
  readAt = new Date()
) {
  await tx
    .update(notification)
    .set({ readAt: sql`coalesce(${notification.readAt}, ${readAt})` })
    .where(
      and(
        eq(notification.type, "group_join_requested"),
        eq(notification.groupId, groupId),
        eq(notification.actorUserId, actorUserId)
      )
    )
}

export async function fanOutChapterNotification(
  tx: Transaction,
  input: {
    chapterId: string
    mangaId: string
    publishedAt: Date
    sessionId: string
  },
  visibility: CatalogVisibility,
  logger: Logger
) {
  const startedAt = performance.now()
  try {
    const result = await tx.execute(sql`
      insert into notification (
        user_id, type, manga_id, chapter_id, created_at
      )
      select
        ${libraryItem.userId},
        'manga_new_chapter'::notification_type,
        ${input.mangaId}::uuid,
        ${input.chapterId}::uuid,
        ${input.publishedAt}
      from ${libraryItem}
      inner join ${manga} on ${manga.id} = ${libraryItem.mangaId}
      inner join ${chapter}
        on ${chapter.id} = ${input.chapterId}::uuid
        and ${chapter.mangaId} = ${manga.id}
      where ${libraryItem.mangaId} = ${input.mangaId}::uuid
        and ${libraryItem.category} = 'following'
        and ${visibleManga(visibility)}
        and ${readableChapter(visibility)}
      on conflict (user_id, type, manga_id) do update
      set
        chapter_id = excluded.chapter_id,
        created_at = excluded.created_at,
        read_at = null
      where (excluded.created_at, excluded.chapter_id) >
        (notification.created_at, notification.chapter_id)
    `)
    const durationMs = performance.now() - startedAt
    if (durationMs >= 500)
      logger("warn", "notification.chapter.fanout_slow", {
        chapterId: input.chapterId,
        durationMs: Math.round(durationMs * 100) / 100,
        mangaId: input.mangaId,
        publishedAt: formatTimestamp(input.publishedAt),
        recipients: result.rowCount ?? 0,
        sessionId: input.sessionId,
      })
  } catch (error) {
    logger("error", "notification.chapter.fanout_failed", {
      chapterId: input.chapterId,
      mangaId: input.mangaId,
      publishedAt: formatTimestamp(input.publishedAt),
      sessionId: input.sessionId,
      ...errorFields(error, true),
    })
    throw error
  }
}

export async function markChapterNotificationsRead(
  tx: Transaction,
  userId: string,
  chapterIds: string[],
  readAt: Date
) {
  if (chapterIds.length === 0) return
  await tx
    .update(notification)
    .set({ readAt: sql`coalesce(${notification.readAt}, ${readAt})` })
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.type, "manga_new_chapter"),
        inArray(notification.chapterId, chapterIds)
      )
    )
}
