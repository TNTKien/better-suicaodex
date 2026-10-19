import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  effectiveAvatarFrames,
  type FrameProjection,
} from "../avatar-frames/projection.js"
import type { AvatarFrameSummary } from "../../shared/contract.js"
import {
  chapter,
  comment,
  manga,
  mangaVolume,
  moderationAction,
  user,
} from "../../db/schema.js"
import type { BusinessCache } from "../../shared/cache.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { normalizeDecimal } from "../catalog/routes.js"
import { groupFailure, requireGroupAdmin } from "../groups/service.js"
import {
  addCommentEngagement,
  removeCommentEngagement,
} from "../ranking/engagement.js"

type Dependencies = {
  cache: BusinessCache
  database: Database
} & Omit<FrameProjection, "database">

type ListInput = {
  page: number
  limit: number
  q?: string
  status?: "visible" | "hidden"
  mangaId?: string
  chapterId?: string
  userId?: string
}

type VisibilityInput = {
  hidden: boolean
  items: Array<{ id: string; expectedVersion: number }>
}

const selection = {
  id: comment.id,
  parentId: comment.parentId,
  body: comment.body,
  status: comment.status,
  version: comment.version,
  authorId: user.id,
  authorName: user.name,
  authorImage: user.image,
  mangaId: manga.id,
  mangaSlug: manga.slug,
  mangaTitle: manga.title,
  chapterId: chapter.id,
  chapterVolume: mangaVolume.number,
  chapterNumber: chapter.number,
  chapterTitle: chapter.title,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  editedAt: comment.editedAt,
}

type CommentRow = Awaited<ReturnType<typeof query>>[number]

function mapComment(
  row: CommentRow,
  avatarFrame: AvatarFrameSummary | null = null
) {
  return {
    id: row.id,
    parentId: row.parentId,
    body: row.body,
    status: row.status,
    version: row.version,
    author: {
      id: row.authorId,
      name: row.authorName,
      image: row.authorImage,
      avatarFrame,
    },
    manga: {
      id: row.mangaId,
      slug: row.mangaSlug,
      title: row.mangaTitle,
    },
    chapter: row.chapterId
      ? {
          id: row.chapterId,
          volume: normalizeDecimal(row.chapterVolume),
          number: normalizeDecimal(row.chapterNumber),
          title: row.chapterTitle,
        }
      : null,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
    editedAt: row.editedAt ? formatTimestamp(row.editedAt) : null,
  }
}

function query(database: Database) {
  return database
    .select(selection)
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .innerJoin(manga, eq(manga.id, comment.mangaId))
    .leftJoin(chapter, eq(chapter.id, comment.chapterId))
    .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
}

async function loadComments(
  database: Database,
  ids: string[],
  frames: Omit<FrameProjection, "database"> = {}
) {
  const rows = await query(database).where(
    and(inArray(comment.id, ids), isNull(comment.deletedAt))
  )
  const byId = new Map(rows.map((row) => [row.id, row]))
  const projections = await effectiveAvatarFrames(
    { database, ...frames },
    rows.map((row) => row.authorId)
  )
  return ids.map((id) => {
    const row = byId.get(id)
    if (!row) groupFailure(404, "NOT_FOUND", "Comment not found")
    return mapComment(row, projections.get(row.authorId) ?? null)
  })
}

export async function listModerationComments(
  database: Database,
  input: ListInput,
  frames: Omit<FrameProjection, "database"> = {}
) {
  const pattern = input.q ? `%${input.q}%` : undefined
  const where = and(
    isNull(comment.deletedAt),
    pattern
      ? or(
          ilike(comment.body, pattern),
          ilike(user.name, pattern),
          sql`${comment.id}::text = ${input.q!}`
        )
      : undefined,
    input.status ? eq(comment.status, input.status) : undefined,
    input.mangaId ? eq(comment.mangaId, input.mangaId) : undefined,
    input.chapterId ? eq(comment.chapterId, input.chapterId) : undefined,
    input.userId ? eq(comment.userId, input.userId) : undefined
  )
  const [[totalRow], rows] = await Promise.all([
    database
      .select({ total: count() })
      .from(comment)
      .innerJoin(user, eq(user.id, comment.userId))
      .where(where),
    query(database)
      .where(where)
      .orderBy(desc(comment.createdAt), desc(comment.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ])
  const total = Number(totalRow?.total ?? 0)
  const projections = await effectiveAvatarFrames(
    { database, ...frames },
    rows.map((row) => row.authorId)
  )
  return {
    data: rows.map((row) =>
      mapComment(row, projections.get(row.authorId) ?? null)
    ),
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
    },
  }
}

export async function setCommentModerationVisibility(
  dependencies: Dependencies,
  actorUserId: string,
  id: string,
  input: { hidden: boolean; expectedVersion: number }
) {
  const [updated] = await setCommentsModerationVisibility(
    dependencies,
    actorUserId,
    {
      hidden: input.hidden,
      items: [{ id, expectedVersion: input.expectedVersion }],
    }
  )
  return updated!
}

export async function setCommentsModerationVisibility(
  dependencies: Dependencies,
  actorUserId: string,
  input: VisibilityInput
) {
  await dependencies.database.transaction(async (tx) => {
    await requireGroupAdmin(tx, actorUserId)
    const ids = [...input.items.map(({ id }) => id)].sort()
    const rows = await tx
      .select({
        id: comment.id,
        mangaId: comment.mangaId,
        chapterId: comment.chapterId,
        parentId: comment.parentId,
        status: comment.status,
        version: comment.version,
        createdAt: comment.createdAt,
        deletedAt: comment.deletedAt,
      })
      .from(comment)
      .where(inArray(comment.id, ids))
      .orderBy(comment.id)
      .for("update")
    const currentById = new Map(rows.map((row) => [row.id, row]))
    const nextStatus = input.hidden ? "hidden" : "visible"
    for (const [index, item] of input.items.entries()) {
      const current = currentById.get(item.id)
      if (!current) groupFailure(404, "NOT_FOUND", "Comment not found")
      if (current.version !== item.expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Comment changed since it was loaded",
          [
            {
              path: `items.${index}.expectedVersion`,
              message: `Current version is ${current.version}`,
            },
          ]
        )
      if (current.deletedAt)
        groupFailure(
          409,
          "COMMENT_DELETED",
          "Deleted comments cannot be moderated"
        )
      if (current.status === nextStatus)
        groupFailure(
          409,
          "STATE_UNCHANGED",
          input.hidden
            ? "Comment is already hidden"
            : "Comment is already visible"
        )
    }

    const now = new Date()
    const updatedRows = await tx
      .update(comment)
      .set({
        status: nextStatus,
        updatedAt: now,
        version: sql`${comment.version} + 1`,
      })
      .where(inArray(comment.id, ids))
      .returning({ id: comment.id, version: comment.version })
    const updatedVersions = new Map(
      updatedRows.map((row) => [row.id, row.version])
    )

    for (const current of rows) {
      if (input.hidden)
        await removeCommentEngagement(tx, current.mangaId, current.createdAt)
      else await addCommentEngagement(tx, current.mangaId, current.createdAt)
    }

    await tx.insert(moderationAction).values(
      rows.map((current) => ({
        actorUserId,
        action: `moderation.comment.${input.hidden ? "hidden" : "unhidden"}`,
        targetKind: "comment" as const,
        targetId: current.id,
        reason: input.hidden
          ? "Comment hidden by administrator"
          : "Comment unhidden by administrator",
        before: {
          mangaId: current.mangaId,
          chapterId: current.chapterId,
          parentId: current.parentId,
          status: current.status,
          version: current.version,
        },
        after: {
          mangaId: current.mangaId,
          chapterId: current.chapterId,
          parentId: current.parentId,
          status: nextStatus,
          version: updatedVersions.get(current.id)!,
        },
        createdAt: now,
      }))
    )
  })
  await dependencies.cache.invalidateCatalog()
  return loadComments(
    dependencies.database,
    input.items.map(({ id }) => id),
    dependencies
  )
}
