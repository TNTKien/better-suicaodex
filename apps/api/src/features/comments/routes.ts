import type { OpenAPIHono } from "@hono/zod-openapi"
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm"

import type { Auth } from "../account/auth.js"
import { accountCanMutate, freshSessionUser } from "../account/guard.js"
import {
  normalizeDecimal,
  readableChapter,
  visibleManga,
  type CatalogDependencies,
  type CatalogVisibility,
} from "../catalog/routes.js"
import {
  addCommentEngagement,
  removeCommentEngagement,
} from "../ranking/engagement.js"
import {
  createChapterCommentRoute,
  createMangaCommentRoute,
  deleteCommentRoute,
  listChapterCommentsRoute,
  listMangaCommentsRoute,
  listRecentCommentsRoute,
  updateCommentRoute,
  type ChapterComment,
} from "./contract.js"
import { chapter, comment, manga, user } from "../../db/schema.js"
import { apiError } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { groupFailure, requireActiveAccount } from "../groups/service.js"
import { effectiveAvatarFrames } from "../avatar-frames/projection.js"
import type { AvatarFrameSummary } from "../../shared/contract.js"
import { censorCommentBody } from "./forbidden-words.js"
import {
  commentCreationFingerprint,
  guardCommentSpam,
  lockCommentAuthor,
  penalizeCommentDelete,
  syncCommentCoin,
} from "../coin/comments.js"
import type { CoinService } from "../coin/service.js"
import { lockActiveCoinUser } from "../coin/access.js"

type CommentDependencies = Pick<
  CatalogDependencies,
  | "cache"
  | "database"
  | "hiddenChapterIds"
  | "hiddenMangaIds"
  | "hideR18"
  | "assetBaseUrl"
  | "avatarFramesEnabled"
> & { auth?: Auth; coin?: CoinService; now?: () => Date }

type CommentRow = {
  id: string
  mangaId: string
  parentId: string | null
  body: string
  status: "visible" | "hidden"
  version: number
  userId: string
  authorName: string
  authorImage: string | null
  authorAvatarFrame?: AvatarFrameSummary | null
  chapterId: string | null
  chapterNumber: string | null
  chapterTitle: string | null
  createdAt: Date
  updatedAt: Date
  editedAt: Date | null
  deletedAt: Date | null
}

type CommentScope = { mangaId: string; chapterId: string | null }
type CommentFeedScope = { mangaId: string; chapterId?: string | null }

const rowSelection = {
  id: comment.id,
  mangaId: comment.mangaId,
  parentId: comment.parentId,
  body: comment.body,
  status: comment.status,
  version: comment.version,
  userId: comment.userId,
  authorName: user.name,
  authorImage: user.image,
  chapterId: comment.chapterId,
  chapterNumber: chapter.number,
  chapterTitle: chapter.title,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  editedAt: comment.editedAt,
  deletedAt: comment.deletedAt,
}

function mapCommentBase(row: CommentRow) {
  return {
    id: row.id,
    parentId: row.parentId,
    body: row.deletedAt || row.status === "hidden" ? null : row.body,
    deleted: Boolean(row.deletedAt),
    hidden: row.status === "hidden",
    version: row.version,
    author: {
      id: row.userId,
      name: row.authorName,
      image: row.authorImage,
      avatarFrame: row.authorAvatarFrame ?? null,
    },
    chapter: row.chapterId
      ? {
          id: row.chapterId,
          number: normalizeDecimal(row.chapterNumber),
          title: row.chapterTitle,
        }
      : null,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
    editedAt: row.editedAt ? formatTimestamp(row.editedAt) : null,
  }
}

function mapComment(
  row: CommentRow,
  replies: CommentRow[] = []
): ChapterComment {
  return {
    ...mapCommentBase(row),
    replies: replies.map((reply) => ({
      ...mapCommentBase(reply),
      parentId: reply.parentId!,
    })),
  }
}

function commentScopeCondition(scope: CommentFeedScope) {
  return and(
    eq(comment.mangaId, scope.mangaId),
    scope.chapterId === undefined
      ? undefined
      : scope.chapterId
        ? eq(comment.chapterId, scope.chapterId)
        : isNull(comment.chapterId)
  )
}

async function readableChapterIdentity(
  dependencies: CommentDependencies,
  visibility: CatalogVisibility,
  id: string
) {
  const [row] = await dependencies.database
    .select({ id: chapter.id, mangaId: chapter.mangaId })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
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

async function visibleMangaIdentity(
  dependencies: CommentDependencies,
  visibility: CatalogVisibility,
  id: string
) {
  const [row] = await dependencies.database
    .select({ id: manga.id })
    .from(manga)
    .where(and(eq(manga.id, id), visibleManga(visibility)))
    .limit(1)
  return row ?? null
}

async function loadComments(
  dependencies: CommentDependencies,
  visibility: CatalogVisibility,
  scope: CommentFeedScope,
  cursor: string | undefined,
  limit: number
) {
  const base = and(
    commentScopeCondition(scope),
    scope.chapterId === undefined
      ? or(isNull(comment.chapterId), readableChapter(visibility))
      : undefined
  )
  const roots = and(base, isNull(comment.parentId))
  let cursorCondition

  if (cursor) {
    const [anchor] = await dependencies.database
      .select({ createdAt: comment.createdAt })
      .from(comment)
      .leftJoin(chapter, eq(chapter.id, comment.chapterId))
      .where(and(roots, eq(comment.id, cursor)))
      .limit(1)
    if (!anchor) return null
    cursorCondition = or(
      lt(comment.createdAt, anchor.createdAt),
      and(eq(comment.createdAt, anchor.createdAt), lt(comment.id, cursor))
    )
  }

  const [rows, [totalRow]] = await Promise.all([
    dependencies.database
      .select(rowSelection)
      .from(comment)
      .innerJoin(user, eq(user.id, comment.userId))
      .leftJoin(chapter, eq(chapter.id, comment.chapterId))
      .where(and(roots, cursorCondition))
      .orderBy(desc(comment.createdAt), desc(comment.id))
      .limit(limit + 1),
    dependencies.database
      .select({ value: count() })
      .from(comment)
      .leftJoin(chapter, eq(chapter.id, comment.chapterId))
      .where(
        and(base, eq(comment.status, "visible"), isNull(comment.deletedAt))
      ),
  ])
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  const rootIds = page.map(({ id }) => id)
  const replyRows = rootIds.length
    ? await dependencies.database
        .select(rowSelection)
        .from(comment)
        .innerJoin(user, eq(user.id, comment.userId))
        .leftJoin(chapter, eq(chapter.id, comment.chapterId))
        .where(and(base, inArray(comment.parentId, rootIds)))
        .orderBy(asc(comment.createdAt), asc(comment.id))
    : []
  const repliesByParent = Map.groupBy(replyRows, ({ parentId }) => parentId!)
  const projectedRows: CommentRow[] = [...page, ...replyRows]
  const frames = await effectiveAvatarFrames(
    dependencies,
    projectedRows.map((row) => row.userId)
  )
  for (const row of projectedRows)
    row.authorAvatarFrame = frames.get(row.userId) ?? null

  return {
    data: page.map((row) => mapComment(row, repliesByParent.get(row.id))),
    meta: {
      limit,
      total: totalRow?.value ?? 0,
      nextCursor: hasMore ? page.at(-1)!.id : null,
    },
  }
}

async function loadRecentComments(
  dependencies: CommentDependencies,
  visibility: CatalogVisibility,
  limit: number
) {
  const rows = await dependencies.database
    .select({
      id: comment.id,
      body: comment.body,
      userId: comment.userId,
      authorName: user.name,
      authorImage: user.image,
      mangaId: manga.id,
      mangaSlug: manga.slug,
      mangaTitle: manga.title,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      createdAt: comment.createdAt,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .innerJoin(manga, eq(manga.id, comment.mangaId))
    .leftJoin(chapter, eq(chapter.id, comment.chapterId))
    .where(
      and(
        eq(comment.status, "visible"),
        isNull(comment.deletedAt),
        visibleManga(visibility),
        or(isNull(comment.chapterId), readableChapter(visibility))
      )
    )
    .orderBy(desc(comment.createdAt), desc(comment.id))
    .limit(limit)

  const frames = await effectiveAvatarFrames(
    dependencies,
    rows.map((row) => row.userId)
  )
  return {
    data: rows.map((row) => ({
      id: row.id,
      body: row.body,
      author: {
        id: row.userId,
        name: row.authorName,
        image: row.authorImage,
        avatarFrame: frames.get(row.userId) ?? null,
      },
      manga: {
        id: row.mangaId,
        slug: row.mangaSlug,
        title: row.mangaTitle,
      },
      chapter: row.chapterId
        ? {
            id: row.chapterId,
            number: normalizeDecimal(row.chapterNumber),
            title: row.chapterTitle,
          }
        : null,
      createdAt: formatTimestamp(row.createdAt),
    })),
  }
}

async function createComment(
  dependencies: CommentDependencies,
  scope: CommentScope,
  userId: string,
  input: { body: string; parentId?: string; operationId?: string }
) {
  const createdId = await dependencies.database.transaction(async (tx) => {
    await requireActiveAccount(tx, userId)
    const coin = dependencies.coin
    if (coin?.enabled) await lockActiveCoinUser(tx, userId)
    if (coin?.enabled || input.operationId) await lockCommentAuthor(tx, userId)
    const now = dependencies.now?.() ?? new Date()
    const fingerprint = commentCreationFingerprint({ ...scope, ...input })
    if (input.operationId) {
      const [previous] = await tx
        .select({ id: comment.id, fingerprint: comment.creationFingerprint })
        .from(comment)
        .where(
          and(
            eq(comment.userId, userId),
            eq(comment.creationKey, input.operationId)
          )
        )
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          groupFailure(
            409,
            "COMMENT_IDEMPOTENCY_CONFLICT",
            "Operation ID was already used for another comment"
          )
        return previous.id
      }
    }
    if (input.parentId) {
      const [parent] = await tx
        .select({ id: comment.id })
        .from(comment)
        .where(
          and(
            commentScopeCondition(scope),
            eq(comment.id, input.parentId),
            eq(comment.status, "visible"),
            isNull(comment.parentId),
            isNull(comment.deletedAt)
          )
        )
        .for("share")
      if (!parent)
        groupFailure(400, "INVALID_PARENT", "Parent comment is invalid")
    }
    const body = await censorCommentBody(tx, input.body)
    if (coin?.enabled) await guardCommentSpam(tx, userId, body, now)
    const [created] = await tx
      .insert(comment)
      .values({
        userId,
        mangaId: scope.mangaId,
        chapterId: scope.chapterId,
        parentId: input.parentId,
        body,
        creationKey: input.operationId,
        creationFingerprint: input.operationId ? fingerprint : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await addCommentEngagement(tx, scope.mangaId, now)
    if (coin) await syncCommentCoin(tx, coin, created!, true)
    return created!.id
  })
  await dependencies.cache.invalidateCatalog()
  return mapComment((await loadComment(dependencies, createdId))!)
}

async function loadComment(dependencies: CommentDependencies, id: string) {
  const [row] = await dependencies.database
    .select(rowSelection)
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .leftJoin(chapter, eq(chapter.id, comment.chapterId))
    .where(eq(comment.id, id))
    .limit(1)
  if (!row) return null
  const frames = await effectiveAvatarFrames(dependencies, [row.userId])
  return { ...row, authorAvatarFrame: frames.get(row.userId) ?? null }
}

export function registerCommentRoutes(
  app: OpenAPIHono,
  dependencies: CommentDependencies
) {
  const { database } = dependencies
  const visibility: CatalogVisibility = {
    hideR18: dependencies.hideR18 ?? true,
    hiddenMangaIds: dependencies.hiddenMangaIds ?? [],
    hiddenChapterIds: dependencies.hiddenChapterIds ?? [],
  }

  app.openapi(listRecentCommentsRoute, async (c) => {
    const { limit } = c.req.valid("query")
    return c.json(
      await loadRecentComments(dependencies, visibility, limit),
      200
    )
  })

  app.openapi(listChapterCommentsRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { cursor, limit } = c.req.valid("query")
    const identity = await readableChapterIdentity(dependencies, visibility, id)
    if (!identity) {
      return c.json(
        apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
        404
      )
    }
    const result = await loadComments(
      dependencies,
      visibility,
      { mangaId: identity.mangaId, chapterId: identity.id },
      cursor,
      limit
    )
    if (!result)
      return c.json(
        apiError(
          "INVALID_CURSOR",
          "Comment cursor is invalid",
          c.get("requestId")
        ),
        400
      )
    return c.json(result, 200)
  })

  app.openapi(createChapterCommentRoute, async (c) => {
    const currentUser = await freshSessionUser(
      dependencies.auth,
      c.req.raw.headers
    )
    if (!currentUser) {
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    }
    if (!(await accountCanMutate(database, currentUser.id))) {
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot comment",
          c.get("requestId")
        ),
        403
      )
    }

    const { id } = c.req.valid("param")
    const input = c.req.valid("json")
    const identity = await readableChapterIdentity(dependencies, visibility, id)
    if (!identity) {
      return c.json(
        apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
        404
      )
    }
    const scope = { mangaId: identity.mangaId, chapterId: identity.id }
    return c.json(
      await createComment(dependencies, scope, currentUser.id, input),
      201
    )
  })

  app.openapi(listMangaCommentsRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { cursor, limit } = c.req.valid("query")
    const identity = await visibleMangaIdentity(dependencies, visibility, id)
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
        404
      )
    const result = await loadComments(
      dependencies,
      visibility,
      { mangaId: identity.id },
      cursor,
      limit
    )
    if (!result)
      return c.json(
        apiError(
          "INVALID_CURSOR",
          "Comment cursor is invalid",
          c.get("requestId")
        ),
        400
      )
    return c.json(result, 200)
  })

  app.openapi(createMangaCommentRoute, async (c) => {
    const currentUser = await freshSessionUser(
      dependencies.auth,
      c.req.raw.headers
    )
    if (!currentUser)
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    if (!(await accountCanMutate(database, currentUser.id)))
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot comment",
          c.get("requestId")
        ),
        403
      )

    const { id } = c.req.valid("param")
    const input = c.req.valid("json")
    const identity = await visibleMangaIdentity(dependencies, visibility, id)
    if (!identity)
      return c.json(
        apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
        404
      )
    const scope = { mangaId: identity.id, chapterId: null }
    return c.json(
      await createComment(dependencies, scope, currentUser.id, input),
      201
    )
  })

  app.openapi(updateCommentRoute, async (c) => {
    const currentUser = await freshSessionUser(
      dependencies.auth,
      c.req.raw.headers
    )
    if (!currentUser) {
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    }
    if (!(await accountCanMutate(database, currentUser.id))) {
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot comment",
          c.get("requestId")
        ),
        403
      )
    }
    const { id } = c.req.valid("param")
    const { body: inputBody, expectedVersion } = c.req.valid("json")
    const now = new Date()
    await database.transaction(async (tx) => {
      await requireActiveAccount(tx, currentUser.id)
      if (dependencies.coin?.enabled)
        await lockActiveCoinUser(tx, currentUser.id)
      const [current] = await tx
        .select({
          id: comment.id,
          mangaId: comment.mangaId,
          chapterId: comment.chapterId,
          parentId: comment.parentId,
          userId: comment.userId,
          status: comment.status,
          version: comment.version,
          deletedAt: comment.deletedAt,
        })
        .from(comment)
        .where(eq(comment.id, id))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Comment not found")
      if (current.userId !== currentUser.id)
        groupFailure(403, "FORBIDDEN", "You cannot edit this comment")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Comment changed since it was loaded",
          [
            {
              path: "expectedVersion",
              message: `Current version is ${current.version}`,
            },
          ]
        )
      if (current.deletedAt)
        groupFailure(
          409,
          "COMMENT_DELETED",
          "Deleted comments cannot be edited"
        )
      if (current.status === "hidden")
        groupFailure(409, "COMMENT_HIDDEN", "Hidden comments cannot be edited")

      const [parent] = current.chapterId
        ? await tx
            .select({ id: chapter.id })
            .from(chapter)
            .innerJoin(manga, eq(manga.id, chapter.mangaId))
            .where(
              and(
                eq(chapter.id, current.chapterId),
                readableChapter(visibility),
                visibleManga(visibility)
              )
            )
            .limit(1)
        : await tx
            .select({ id: manga.id })
            .from(manga)
            .where(and(eq(manga.id, current.mangaId), visibleManga(visibility)))
            .limit(1)
      if (!parent) groupFailure(404, "NOT_FOUND", "Comment not found")

      const body = await censorCommentBody(tx, inputBody)

      const [updated] = await tx
        .update(comment)
        .set({
          body,
          updatedAt: now,
          editedAt: now,
          version: sql`${comment.version} + 1`,
        })
        .where(and(eq(comment.id, id), eq(comment.version, expectedVersion)))
        .returning({ id: comment.id })
      if (!updated)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Comment changed since it was loaded"
        )
      if (dependencies.coin)
        await syncCommentCoin(tx, dependencies.coin, {
          ...current,
          body,
          version: current.version + 1,
        })
    })
    return c.json(mapComment((await loadComment(dependencies, id))!), 200)
  })

  app.openapi(deleteCommentRoute, async (c) => {
    const currentUser = await freshSessionUser(
      dependencies.auth,
      c.req.raw.headers
    )
    if (!currentUser) {
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    }
    const { id } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    const now = new Date()
    await database.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: comment.id,
          mangaId: comment.mangaId,
          userId: comment.userId,
          status: comment.status,
          version: comment.version,
          createdAt: comment.createdAt,
          deletedAt: comment.deletedAt,
        })
        .from(comment)
        .where(eq(comment.id, id))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Comment not found")
      if (current.userId !== currentUser.id)
        groupFailure(403, "FORBIDDEN", "You cannot delete this comment")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Comment changed since it was loaded",
          [
            {
              path: "expectedVersion",
              message: `Current version is ${current.version}`,
            },
          ]
        )
      if (current.deletedAt)
        groupFailure(409, "COMMENT_DELETED", "Comment is already deleted")

      const [deleted] = await tx
        .update(comment)
        .set({
          deletedAt: now,
          deletedByUserId: currentUser.id,
          deleteReason: "self_deleted",
          updatedAt: now,
          version: sql`${comment.version} + 1`,
        })
        .where(and(eq(comment.id, id), eq(comment.version, expectedVersion)))
        .returning({ id: comment.id })
      if (!deleted)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Comment changed since it was loaded"
        )
      if (current.status === "visible")
        await removeCommentEngagement(tx, current.mangaId, current.createdAt)
      if (dependencies.coin)
        await penalizeCommentDelete(
          tx,
          dependencies.coin,
          current,
          currentUser.id
        )
    })
    await dependencies.cache.invalidateCatalog()
    return c.json(mapComment((await loadComment(dependencies, id))!), 200)
  })
}
