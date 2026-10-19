import type { OpenAPIHono } from "@hono/zod-openapi"
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"
import slugify from "slugify"

import type { Database } from "../../db/client.js"
import {
  chapter,
  chapterGroup,
  chapterUploadPage,
  chapterUploadSession,
  manga,
  mangaGroup,
  mangaTag,
  mangaVolume,
  moderationAction,
  organization,
  tag,
} from "../../db/schema.js"
import type { BusinessCache } from "../../shared/cache.js"
import { CONTENT_WRITE_LOCK } from "../../shared/content-lock.js"
import { apiError } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import type { Auth } from "../account/auth.js"
import { freshSessionUser } from "../account/guard.js"
import { normalizeDecimal } from "../catalog/routes.js"
import {
  addForbiddenWords,
  deleteForbiddenWord,
  listForbiddenWords,
} from "../comments/forbidden-words.js"
import {
  chapterManagementDetail,
  chapterProcessingFailureReason,
  chapterProcessingState,
  recomputeMangaProjection,
} from "../groups/chapter.js"
import { mangaManagementDetail, updateMangaMetadata } from "../groups/manga.js"
import {
  groupFailure,
  lockGroup,
  requireApprovedGroup,
  requireGroupAdmin,
} from "../groups/service.js"
import { notifyGroupOwnersOfContent } from "../notifications/service.js"
import {
  listModerationUserSessions,
  listModerationUsers,
  moderationUserDetail,
  setModerationUserStatus,
} from "./accounts.js"
import { listModerationAudit } from "./audit.js"
import {
  listModerationComments,
  setCommentModerationVisibility,
  setCommentsModerationVisibility,
} from "./comments.js"
import {
  createForbiddenWordsRoute,
  createModerationTagRoute,
  deleteForbiddenWordRoute,
  deleteModerationChapterRoute,
  deleteModerationMangaRoute,
  getModerationChapterRoute,
  getModerationMangaRoute,
  getModerationUserRoute,
  listForbiddenWordsRoute,
  listModerationAuditRoute,
  listModerationChaptersRoute,
  listModerationCommentsRoute,
  listModerationMangaRoute,
  listModerationTagsRoute,
  listModerationUserSessionsRoute,
  listModerationUsersRoute,
  removeModerationChapterGroupRoute,
  removeModerationMangaGroupRoute,
  setChapterModerationVisibilityRoute,
  setCommentModerationVisibilityRoute,
  setCommentsModerationVisibilityRoute,
  setMangaModerationVisibilityRoute,
  setModerationMangaOwnerRoute,
  setModerationUserStatusRoute,
  setTagModerationVisibilityRoute,
  updateModerationMangaRoute,
  updateModerationTagRoute,
} from "./contract.js"
import { latestModerationReasons } from "./service.js"

type Dependencies = {
  assetBaseUrl: string
  avatarFramesEnabled?: boolean
  auth?: Auth
  cache: BusinessCache
  database: Database
  webOrigin: WebOrigins
}

type Target = typeof manga | typeof chapter
type TagGroup = "content" | "format" | "genre" | "theme"

const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
})

const timestamp = (value: Date | null) =>
  value ? formatTimestamp(value) : null

const tagColumns = {
  id: tag.id,
  slug: tag.slug,
  name: tag.name,
  group: tag.group,
  version: tag.version,
  moderationHiddenAt: tag.moderationHiddenAt,
  mangaCount: sql<number>`(
    select count(*)::integer from ${mangaTag}
    where ${mangaTag.tagId} = ${tag.id}
  )`,
}

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ")
}

function mapAdminTag(value: {
  id: string
  slug: string
  name: string
  group: string
  version: number
  moderationHiddenAt: Date | null
  mangaCount: number
}) {
  return {
    ...value,
    group: value.group as TagGroup,
    moderationHiddenAt: timestamp(value.moderationHiddenAt),
    mangaCount: Number(value.mangaCount),
  }
}

async function requireUniqueTag(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  input: { id?: string; name: string; slug: string; group: TagGroup }
) {
  const excludingCurrent = input.id ? ne(tag.id, input.id) : undefined
  const [sameSlug] = await tx
    .select({ id: tag.id })
    .from(tag)
    .where(and(eq(tag.slug, input.slug), excludingCurrent))
    .limit(1)
  if (sameSlug)
    groupFailure(409, "TAG_SLUG_CONFLICT", "Tag slug already exists", [
      { path: "slug", message: "Slug is already in use" },
    ])
  const [sameName] = await tx
    .select({ id: tag.id })
    .from(tag)
    .where(
      and(
        eq(tag.group, input.group),
        sql`lower(btrim(${tag.name})) = lower(${input.name})`,
        excludingCurrent
      )
    )
    .limit(1)
  if (sameName)
    groupFailure(
      409,
      "TAG_NAME_CONFLICT",
      "Tag name already exists in this group",
      [{ path: "name", message: "Name is already in use in this group" }]
    )
}

async function generatedTagSlug(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  name: string,
  id: string
) {
  const base =
    slugify(name, { lower: true, strict: true, locale: "vi", trim: true })
      .slice(0, 160)
      .replace(/-+$/g, "") || `tag-${id.slice(0, 8)}`
  for (let number = 1; ; number += 1) {
    const suffix = number === 1 ? "" : `-${number}`
    const candidate = `${base.slice(0, 160 - suffix.length).replace(/-+$/g, "")}${suffix}`
    const [existing] = await tx
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.slug, candidate))
      .limit(1)
    if (!existing) return candidate
  }
}

async function tagById(database: Database, id: string) {
  const [value] = await database
    .select(tagColumns)
    .from(tag)
    .where(eq(tag.id, id))
    .limit(1)
  if (!value) groupFailure(404, "NOT_FOUND", "Tag not found")
  return mapAdminTag(value)
}

async function setVisibility(
  dependencies: Dependencies,
  actor: string,
  target: Target,
  targetKind: "manga" | "chapter",
  id: string,
  input:
    | { hidden: true; expectedVersion: number; reason: string }
    | { hidden: false; expectedVersion: number }
) {
  const result = await dependencies.database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
    )
    await requireGroupAdmin(tx, actor)
    const [current] = await tx
      .select({
        id: target.id,
        publicationState: target.publicationState,
        moderationHiddenAt: target.moderationHiddenAt,
        version: target.version,
      })
      .from(target)
      .where(and(eq(target.id, id), isNull(target.deletedAt)))
      .for("update")
    if (!current) groupFailure(404, "NOT_FOUND", "Content not found")
    if (current.version !== input.expectedVersion)
      groupFailure(
        409,
        "VERSION_CONFLICT",
        "Content changed since it was loaded",
        [
          {
            path: "expectedVersion",
            message: `Current version is ${current.version}`,
          },
        ]
      )
    if (Boolean(current.moderationHiddenAt) === input.hidden)
      groupFailure(
        409,
        "STATE_UNCHANGED",
        input.hidden
          ? "Content is already hidden"
          : "Content is already visible"
      )

    const publicationState = current.publicationState
    const now = new Date()
    const moderationHiddenAt = input.hidden ? now : null
    const [updated] = await tx
      .update(target)
      .set({
        publicationState,
        moderationHiddenAt,
        updatedAt: now,
        version: sql`${target.version} + 1`,
      })
      .where(and(eq(target.id, id), eq(target.version, input.expectedVersion)))
      .returning({
        id: target.id,
        publicationState: target.publicationState,
        moderationHiddenAt: target.moderationHiddenAt,
        version: target.version,
      })
    if (!updated)
      groupFailure(
        409,
        "VERSION_CONFLICT",
        "Content changed since it was loaded"
      )

    if (targetKind === "chapter") {
      const [parent] = await tx
        .select({ mangaId: chapter.mangaId })
        .from(chapter)
        .where(eq(chapter.id, id))
      if (!parent) groupFailure(404, "NOT_FOUND", "Content not found")
      await recomputeMangaProjection(tx, parent.mangaId, now)
    }

    await tx.insert(moderationAction).values({
      actorUserId: actor,
      action: `moderation.${targetKind}.${input.hidden ? "hidden" : "unhidden"}`,
      targetKind,
      targetId: id,
      reason: input.hidden ? input.reason : "Content unhidden",
      before: {
        moderationHiddenAt: current.moderationHiddenAt
          ? formatTimestamp(current.moderationHiddenAt)
          : null,
        publicationState: current.publicationState,
        version: current.version,
      },
      after: {
        moderationHiddenAt: updated.moderationHiddenAt
          ? formatTimestamp(updated.moderationHiddenAt)
          : null,
        publicationState: updated.publicationState,
        version: updated.version,
      },
      createdAt: now,
    })
    return {
      ...updated,
      moderationHiddenAt: updated.moderationHiddenAt
        ? formatTimestamp(updated.moderationHiddenAt)
        : null,
    }
  })
  await dependencies.cache.invalidateCatalog()
  return result
}

export function registerModerationRoutes(
  app: OpenAPIHono,
  dependencies: Dependencies
) {
  for (const base of [
    "/v1/admin/manga/*",
    "/v1/admin/chapters/*",
    "/v1/admin/comments/*",
    "/v1/admin/tags/*",
    "/v1/admin/users/*",
    "/v1/admin/audit/*",
  ]) {
    app.use(base, async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      const currentUser = await freshSessionUser(
        dependencies.auth,
        c.req.raw.headers
      )
      if (!currentUser)
        groupFailure(401, "UNAUTHORIZED", "Authentication is required")
      c.set("accountUserId", currentUser.id)
      await requireGroupAdmin(dependencies.database, currentUser.id)
      if (
        !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
        !isTrustedWebOrigin(c.req.header("Origin"), dependencies.webOrigin)
      )
        groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
      await next()
    })
    app.use(
      base,
      bodyLimit({
        maxSize: 16_384,
        onError: (c) =>
          c.json(
            apiError(
              "PAYLOAD_TOO_LARGE",
              "Request must not exceed 16 KiB",
              c.get("requestId")
            ),
            413
          ),
      })
    )
  }

  app.openapi(listModerationAuditRoute, async (c) => {
    const result = await listModerationAudit(
      dependencies.database,
      c.req.valid("query"),
      dependencies
    )
    if (!result)
      return c.json(
        apiError(
          "INVALID_CURSOR",
          "Audit cursor is invalid",
          c.get("requestId")
        ),
        400
      )
    return c.json(result, 200)
  })

  app.openapi(listModerationUsersRoute, async (c) =>
    c.json(
      await listModerationUsers(
        dependencies.database,
        c.req.valid("query"),
        dependencies
      ),
      200
    )
  )

  app.openapi(getModerationUserRoute, async (c) =>
    c.json(
      {
        data: await moderationUserDetail(
          dependencies.database,
          c.req.valid("param").id,
          dependencies
        ),
      },
      200
    )
  )

  app.openapi(listModerationUserSessionsRoute, async (c) =>
    c.json(
      await listModerationUserSessions(
        dependencies.database,
        c.req.valid("param").id
      ),
      200
    )
  )

  app.openapi(setModerationUserStatusRoute, async (c) =>
    c.json(
      {
        data: await setModerationUserStatus(
          dependencies.database,
          c.get("accountUserId"),
          c.req.valid("param").id,
          c.req.valid("json"),
          dependencies
        ),
      },
      200
    )
  )

  app.openapi(listModerationMangaRoute, async (c) => {
    const { page, limit, q, groupId, publicationState, moderation } =
      c.req.valid("query")
    const where = and(
      isNull(manga.deletedAt),
      q
        ? or(ilike(manga.title, `%${q}%`), sql`${manga.id}::text = ${q}`)
        : undefined,
      publicationState
        ? eq(manga.publicationState, publicationState)
        : undefined,
      moderation === "hidden"
        ? isNotNull(manga.moderationHiddenAt)
        : moderation === "visible"
          ? isNull(manga.moderationHiddenAt)
          : undefined,
      groupId
        ? exists(
            dependencies.database
              .select({ mangaId: mangaGroup.mangaId })
              .from(mangaGroup)
              .where(
                and(
                  eq(mangaGroup.mangaId, manga.id),
                  eq(mangaGroup.groupId, groupId)
                )
              )
          )
        : undefined
    )
    const [[totalRow], rows] = await Promise.all([
      dependencies.database.select({ total: count() }).from(manga).where(where),
      dependencies.database
        .select({
          id: manga.id,
          slug: manga.slug,
          title: manga.title,
          publicationState: manga.publicationState,
          moderationHiddenAt: manga.moderationHiddenAt,
          version: manga.version,
          updatedAt: manga.updatedAt,
        })
        .from(manga)
        .where(where)
        .orderBy(desc(manga.updatedAt), asc(manga.id))
        .limit(limit)
        .offset((page - 1) * limit),
    ])
    const reasons = await latestModerationReasons(
      dependencies.database,
      "manga",
      rows.filter((row) => row.moderationHiddenAt).map((row) => row.id)
    )
    const total = Number(totalRow?.total ?? 0)
    return c.json(
      {
        data: rows.map((row) => ({
          ...row,
          moderationHiddenAt: timestamp(row.moderationHiddenAt),
          moderationReason: row.moderationHiddenAt
            ? (reasons.get(row.id) ?? null)
            : null,
          updatedAt: formatTimestamp(row.updatedAt),
        })),
        meta: pageMeta(page, limit, total),
      },
      200
    )
  })

  app.openapi(listModerationCommentsRoute, async (c) =>
    c.json(
      await listModerationComments(
        dependencies.database,
        c.req.valid("query"),
        dependencies
      ),
      200
    )
  )

  app.openapi(listForbiddenWordsRoute, async (c) =>
    c.json(
      {
        data: (await listForbiddenWords(dependencies.database)).map((item) => ({
          ...item,
          createdAt: formatTimestamp(item.createdAt),
        })),
      },
      200
    )
  )

  app.openapi(createForbiddenWordsRoute, async (c) => {
    const created = await addForbiddenWords(
      dependencies.database,
      c.req.valid("json").words
    )
    if (created.length === 0)
      groupFailure(
        409,
        "FORBIDDEN_WORD_EXISTS",
        "Forbidden words already exist"
      )
    return c.json(
      {
        data: created.map((item) => ({
          ...item,
          createdAt: formatTimestamp(item.createdAt),
        })),
      },
      201
    )
  })

  app.openapi(deleteForbiddenWordRoute, async (c) => {
    const deleted = await deleteForbiddenWord(
      dependencies.database,
      c.req.valid("param").id
    )
    if (!deleted) groupFailure(404, "NOT_FOUND", "Forbidden word was not found")
    return c.json(
      {
        data: {
          ...deleted,
          createdAt: formatTimestamp(deleted.createdAt),
        },
      },
      200
    )
  })

  app.openapi(listModerationTagsRoute, async (c) => {
    const { q, group } = c.req.valid("query")
    const pattern = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : undefined
    const rows = await dependencies.database
      .select(tagColumns)
      .from(tag)
      .where(
        and(
          group ? eq(tag.group, group) : undefined,
          pattern
            ? or(
                sql`${tag.name} ilike ${pattern} escape '\\'`,
                sql`${tag.slug} ilike ${pattern} escape '\\'`
              )
            : undefined
        )
      )
      .orderBy(asc(tag.group), asc(tag.name), asc(tag.id))
    return c.json({ data: rows.map(mapAdminTag) }, 200)
  })

  app.openapi(createModerationTagRoute, async (c) => {
    const actor = c.get("accountUserId")
    const input = c.req.valid("json")
    const tagId = await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const idResult = await tx.execute<{ id: string }>(
        sql`select public.uuid_generate_v7()::text as id`
      )
      const id = idResult.rows[0]?.id
      if (!id) throw new Error("Tag ID was not generated")
      const name = normalizeTagName(input.name)
      const slug = input.slug ?? (await generatedTagSlug(tx, name, id))
      await requireUniqueTag(tx, { name, slug, group: input.group })
      await tx.insert(tag).values({ id, name, slug, group: input.group })
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "taxonomy.tag.created",
        targetKind: "tag",
        targetId: id,
        reason: "Tag created",
        before: null,
        after: {
          name,
          slug,
          group: input.group,
          version: 1,
          moderationHiddenAt: null,
        },
      })
      return id
    })
    await dependencies.cache.invalidateCatalog()
    return c.json({ data: await tagById(dependencies.database, tagId) }, 201)
  })

  app.openapi(updateModerationTagRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { id } = c.req.valid("param")
    const input = c.req.valid("json")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select()
        .from(tag)
        .where(eq(tag.id, id))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Tag not found")
      if (current.version !== input.expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Tag changed since it was loaded",
          [
            {
              path: "expectedVersion",
              message: `Current version is ${current.version}`,
            },
          ]
        )
      const name = normalizeTagName(input.name)
      await requireUniqueTag(tx, {
        id,
        name,
        slug: input.slug,
        group: input.group,
      })
      const [updated] = await tx
        .update(tag)
        .set({
          name,
          slug: input.slug,
          group: input.group,
          version: sql`${tag.version} + 1`,
        })
        .where(and(eq(tag.id, id), eq(tag.version, input.expectedVersion)))
        .returning({ version: tag.version })
      if (!updated)
        groupFailure(409, "VERSION_CONFLICT", "Tag changed since it was loaded")
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "taxonomy.tag.updated",
        targetKind: "tag",
        targetId: id,
        reason: "Tag updated",
        before: {
          name: current.name,
          slug: current.slug,
          group: current.group,
          version: current.version,
          moderationHiddenAt: timestamp(current.moderationHiddenAt),
        },
        after: {
          name,
          slug: input.slug,
          group: input.group,
          version: updated.version,
          moderationHiddenAt: timestamp(current.moderationHiddenAt),
        },
      })
    })
    await dependencies.cache.invalidateCatalog()
    return c.json({ data: await tagById(dependencies.database, id) }, 200)
  })

  app.openapi(setTagModerationVisibilityRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { id } = c.req.valid("param")
    const input = c.req.valid("json")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select()
        .from(tag)
        .where(eq(tag.id, id))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Tag not found")
      if (current.version !== input.expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Tag changed since it was loaded",
          [
            {
              path: "expectedVersion",
              message: `Current version is ${current.version}`,
            },
          ]
        )
      if (Boolean(current.moderationHiddenAt) === input.hidden)
        groupFailure(
          409,
          "STATE_UNCHANGED",
          input.hidden ? "Tag is already hidden" : "Tag is already visible"
        )
      const now = new Date()
      const moderationHiddenAt = input.hidden ? now : null
      const [updated] = await tx
        .update(tag)
        .set({
          moderationHiddenAt,
          version: sql`${tag.version} + 1`,
        })
        .where(and(eq(tag.id, id), eq(tag.version, input.expectedVersion)))
        .returning({ version: tag.version })
      if (!updated)
        groupFailure(409, "VERSION_CONFLICT", "Tag changed since it was loaded")
      const [usage] = await tx
        .select({ value: count() })
        .from(mangaTag)
        .where(eq(mangaTag.tagId, id))
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: `taxonomy.tag.${input.hidden ? "hidden" : "restored"}`,
        targetKind: "tag",
        targetId: id,
        reason: input.hidden ? "Tag hidden" : "Tag restored",
        before: {
          name: current.name,
          slug: current.slug,
          group: current.group,
          version: current.version,
          moderationHiddenAt: timestamp(current.moderationHiddenAt),
          mangaCount: Number(usage?.value ?? 0),
        },
        after: {
          name: current.name,
          slug: current.slug,
          group: current.group,
          version: updated.version,
          moderationHiddenAt: timestamp(moderationHiddenAt),
          mangaCount: Number(usage?.value ?? 0),
        },
        createdAt: now,
      })
    })
    await dependencies.cache.invalidateCatalog()
    return c.json({ data: await tagById(dependencies.database, id) }, 200)
  })

  app.openapi(setCommentModerationVisibilityRoute, async (c) =>
    c.json(
      {
        data: await setCommentModerationVisibility(
          dependencies,
          c.get("accountUserId"),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
      },
      200
    )
  )

  app.openapi(setCommentsModerationVisibilityRoute, async (c) =>
    c.json(
      {
        data: await setCommentsModerationVisibility(
          dependencies,
          c.get("accountUserId"),
          c.req.valid("json")
        ),
      },
      200
    )
  )

  app.openapi(getModerationMangaRoute, async (c) => {
    const { id } = c.req.valid("param")
    return c.json(
      {
        data: await mangaManagementDetail(
          dependencies.database,
          undefined,
          id,
          dependencies.assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(updateModerationMangaRoute, async (c) => {
    const { id } = c.req.valid("param")
    const actor = c.get("accountUserId")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select()
        .from(manga)
        .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Manga not found")
      await updateMangaMetadata(tx, actor, current, c.req.valid("json"))
    })
    await dependencies.cache.invalidateCatalog()
    return c.json(
      {
        data: await mangaManagementDetail(
          dependencies.database,
          undefined,
          id,
          dependencies.assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(setModerationMangaOwnerRoute, async (c) => {
    const { id } = c.req.valid("param")
    const {
      ownerGroupId,
      expectedVersion,
      addTargetGroupToChapters,
      transferSystemChapterOwnership,
    } = c.req.valid("json")
    const actor = c.get("accountUserId")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select({ ownerGroupId: manga.ownerGroupId, version: manga.version })
        .from(manga)
        .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Manga not found")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      if (current.ownerGroupId === ownerGroupId)
        groupFailure(
          409,
          "OWNER_UNCHANGED",
          "Manga already belongs to this group"
        )

      const targetGroup = await lockGroup(tx, ownerGroupId)
      requireApprovedGroup(targetGroup)
      if (targetGroup.slug !== "system" && targetGroup.inactive)
        groupFailure(409, "GROUP_INACTIVE", "Inactive groups cannot own manga")
      if (transferSystemChapterOwnership && targetGroup.slug === "system")
        groupFailure(
          400,
          "INVALID_OWNER_TRANSFER",
          "System-held chapters require an ordinary destination group"
        )
      const [systemGroup] = transferSystemChapterOwnership
        ? await tx
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.slug, "system"))
            .for("update")
        : []
      if (transferSystemChapterOwnership && !systemGroup)
        throw new Error("System group not found")
      if (systemGroup) {
        const [activeUpload] = await tx
          .select({ id: chapterUploadSession.id })
          .from(chapterUploadSession)
          .innerJoin(chapter, eq(chapter.id, chapterUploadSession.chapterId))
          .where(
            and(
              eq(chapter.mangaId, id),
              eq(chapter.ownerGroupId, systemGroup.id),
              inArray(chapterUploadSession.state, ["open", "finalizing"])
            )
          )
          .limit(1)
        if (activeUpload)
          groupFailure(
            409,
            "CHAPTER_UPLOAD_ACTIVE",
            "Finish or cancel active chapter uploads before transferring ownership"
          )
      }
      const addedGroups = await tx
        .insert(mangaGroup)
        .values({
          mangaId: id,
          groupId: ownerGroupId,
          isExplicit: false,
        })
        .onConflictDoNothing()
        .returning({ groupId: mangaGroup.groupId })
      if (addedGroups.length && targetGroup.slug !== "system")
        await notifyGroupOwnersOfContent(tx, [ownerGroupId], actor)

      const addedChapterGroups = addTargetGroupToChapters
        ? await tx
            .insert(chapterGroup)
            .select(
              tx
                .select({
                  chapterId: chapter.id,
                  groupId: sql<string>`${ownerGroupId}`.as("group_id"),
                })
                .from(chapter)
                .where(and(eq(chapter.mangaId, id), isNull(chapter.deletedAt)))
            )
            .onConflictDoNothing()
            .returning({ chapterId: chapterGroup.chapterId })
        : []
      const now = new Date()
      const transferredSystemChapters = systemGroup
        ? await tx
            .update(chapter)
            .set({
              ownerGroupId,
              updatedAt: now,
              version: sql`${chapter.version} + 1`,
            })
            .where(
              and(
                eq(chapter.mangaId, id),
                eq(chapter.ownerGroupId, systemGroup.id)
              )
            )
            .returning({ id: chapter.id, version: chapter.version })
        : []
      const addedTransferredChapterGroups = transferredSystemChapters.length
        ? await tx
            .insert(chapterGroup)
            .values(
              transferredSystemChapters.map((item) => ({
                chapterId: item.id,
                groupId: ownerGroupId,
              }))
            )
            .onConflictDoNothing()
            .returning({ chapterId: chapterGroup.chapterId })
        : []
      if (addTargetGroupToChapters || transferredSystemChapters.length) {
        await tx
          .update(mangaGroup)
          .set({ isExplicit: true })
          .where(
            and(
              eq(mangaGroup.mangaId, id),
              eq(mangaGroup.groupId, ownerGroupId)
            )
          )
        if (
          (addedChapterGroups.length || addedTransferredChapterGroups.length) &&
          !addedGroups.length &&
          targetGroup.slug !== "system"
        )
          await notifyGroupOwnersOfContent(tx, [ownerGroupId], actor)
      }
      if (systemGroup && transferredSystemChapters.length) {
        const transferredIds = transferredSystemChapters.map((item) => item.id)
        await tx
          .delete(chapterGroup)
          .where(
            and(
              inArray(chapterGroup.chapterId, transferredIds),
              eq(chapterGroup.groupId, systemGroup.id)
            )
          )
        const [remainingSystemChapter] = await tx
          .select({ id: chapterGroup.chapterId })
          .from(chapterGroup)
          .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
          .where(
            and(
              eq(chapter.mangaId, id),
              eq(chapterGroup.groupId, systemGroup.id)
            )
          )
          .limit(1)
        if (!remainingSystemChapter)
          await tx
            .delete(mangaGroup)
            .where(
              and(
                eq(mangaGroup.mangaId, id),
                eq(mangaGroup.groupId, systemGroup.id)
              )
            )
      }

      const [updated] = await tx
        .update(manga)
        .set({
          ownerGroupId,
          updatedAt: now,
          version: sql`${manga.version} + 1`,
        })
        .where(and(eq(manga.id, id), eq(manga.version, expectedVersion)))
        .returning({ version: manga.version })
      if (!updated)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      await tx
        .delete(mangaGroup)
        .where(
          and(
            eq(mangaGroup.mangaId, id),
            eq(mangaGroup.groupId, current.ownerGroupId),
            eq(mangaGroup.isExplicit, false)
          )
        )
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "moderation.manga.owner_transferred",
        targetKind: "manga",
        targetId: id,
        reason: "Manga ownership transferred",
        before: {
          ownerGroupId: current.ownerGroupId,
          version: current.version,
        },
        after: {
          ownerGroupId,
          version: updated.version,
          addedToExistingChapters: addedChapterGroups.length,
          transferredSystemChapterOwners: transferredSystemChapters.length,
        },
        createdAt: now,
      })
      if (transferredSystemChapters.length)
        await tx.insert(moderationAction).values(
          transferredSystemChapters.map((item) => ({
            actorUserId: actor,
            action: "moderation.chapter.owner_transferred",
            targetKind: "chapter" as const,
            targetId: item.id,
            reason: "System-held chapter ownership transferred with manga",
            before: {
              ownerGroupId: systemGroup!.id,
              version: item.version - 1,
            },
            after: { ownerGroupId, version: item.version },
            createdAt: now,
          }))
        )
    })
    await dependencies.cache.invalidateCatalog()
    return c.json(
      {
        data: await mangaManagementDetail(
          dependencies.database,
          undefined,
          id,
          dependencies.assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(removeModerationMangaGroupRoute, async (c) => {
    const { id, groupId } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    const actor = c.get("accountUserId")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select({ ownerGroupId: manga.ownerGroupId, version: manga.version })
        .from(manga)
        .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Manga not found")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      if (current.ownerGroupId === groupId)
        groupFailure(
          409,
          "MANGA_OWNER_REQUIRED",
          "The manga owner group cannot be removed"
        )
      const [chapterCredit] = await tx
        .select({ id: chapterGroup.chapterId })
        .from(chapterGroup)
        .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
        .where(
          and(
            eq(chapter.mangaId, id),
            eq(chapterGroup.groupId, groupId),
            isNull(chapter.deletedAt)
          )
        )
        .limit(1)
      if (chapterCredit)
        groupFailure(
          409,
          "GROUP_HAS_CHAPTERS",
          "Remove this group from the manga chapters first"
        )
      const removed = await tx
        .delete(mangaGroup)
        .where(and(eq(mangaGroup.mangaId, id), eq(mangaGroup.groupId, groupId)))
        .returning({ groupId: mangaGroup.groupId })
      if (!removed.length)
        groupFailure(404, "NOT_FOUND", "Manga group was not found")
      const now = new Date()
      const [updated] = await tx
        .update(manga)
        .set({ updatedAt: now, version: sql`${manga.version} + 1` })
        .where(and(eq(manga.id, id), eq(manga.version, expectedVersion)))
        .returning({ version: manga.version })
      if (!updated)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "moderation.manga.group_removed",
        targetKind: "manga",
        targetId: id,
        reason: "Group removed from manga",
        before: { groupId, version: current.version },
        after: { groupId: null, version: updated.version },
        createdAt: now,
      })
    })
    await dependencies.cache.invalidateCatalog()
    return c.json(
      {
        data: await mangaManagementDetail(
          dependencies.database,
          undefined,
          id,
          dependencies.assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(getModerationChapterRoute, async (c) => {
    const { id } = c.req.valid("param")
    const [owner] = await dependencies.database
      .select({ groupId: chapter.ownerGroupId, mangaId: chapter.mangaId })
      .from(chapter)
      .innerJoin(manga, eq(manga.id, chapter.mangaId))
      .where(
        and(
          eq(chapter.id, id),
          isNull(chapter.deletedAt),

          isNull(manga.deletedAt)
        )
      )
      .limit(1)
    if (!owner) groupFailure(404, "NOT_FOUND", "Chapter not found")
    return c.json(
      {
        data: await chapterManagementDetail(
          dependencies.database,
          owner.groupId,
          owner.mangaId,
          id
        ),
        groupId: owner.groupId,
      },
      200
    )
  })

  app.openapi(removeModerationChapterGroupRoute, async (c) => {
    const { id, groupId } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    const actor = c.get("accountUserId")
    let mangaId = ""
    let ownerGroupId = ""
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select({
          mangaId: chapter.mangaId,
          ownerGroupId: chapter.ownerGroupId,
          version: chapter.version,
        })
        .from(chapter)
        .where(and(eq(chapter.id, id), isNull(chapter.deletedAt)))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Chapter not found")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      if (current.ownerGroupId === groupId)
        groupFailure(
          409,
          "CHAPTER_OWNER_REQUIRED",
          "The chapter owner group cannot be removed"
        )
      const removed = await tx
        .delete(chapterGroup)
        .where(
          and(eq(chapterGroup.chapterId, id), eq(chapterGroup.groupId, groupId))
        )
        .returning({ groupId: chapterGroup.groupId })
      if (!removed.length)
        groupFailure(404, "NOT_FOUND", "Chapter group was not found")
      const now = new Date()
      const [updated] = await tx
        .update(chapter)
        .set({ updatedAt: now, version: sql`${chapter.version} + 1` })
        .where(and(eq(chapter.id, id), eq(chapter.version, expectedVersion)))
        .returning({ version: chapter.version })
      if (!updated)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      mangaId = current.mangaId
      ownerGroupId = current.ownerGroupId
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "moderation.chapter.group_removed",
        targetKind: "chapter",
        targetId: id,
        reason: "Group removed from chapter",
        before: { groupId, version: current.version },
        after: { groupId: null, version: updated.version },
        createdAt: now,
      })
    })
    await dependencies.cache.invalidateCatalog()
    return c.json(
      {
        data: await chapterManagementDetail(
          dependencies.database,
          ownerGroupId,
          mangaId,
          id
        ),
      },
      200
    )
  })

  app.openapi(listModerationChaptersRoute, async (c) => {
    const { mangaId } = c.req.valid("param")
    const { page, limit, publicationState, moderation, sort, direction } =
      c.req.valid("query")
    const [parent] = await dependencies.database
      .select({ id: manga.id })
      .from(manga)
      .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
    if (!parent) groupFailure(404, "NOT_FOUND", "Manga not found")
    const where = and(
      eq(chapter.mangaId, mangaId),
      isNull(chapter.deletedAt),

      publicationState
        ? eq(chapter.publicationState, publicationState)
        : undefined,
      moderation === "hidden"
        ? isNotNull(chapter.moderationHiddenAt)
        : moderation === "visible"
          ? isNull(chapter.moderationHiddenAt)
          : undefined
    )
    const orderBy =
      sort === "volume"
        ? [
            direction === "asc"
              ? sql`${mangaVolume.number} asc nulls last`
              : sql`${mangaVolume.number} desc nulls first`,
            direction === "asc"
              ? sql`${chapter.number} asc nulls last`
              : sql`${chapter.number} desc nulls last`,
            desc(chapter.updatedAt),
            desc(chapter.id),
          ]
        : sort === "chapter"
          ? [
              direction === "asc"
                ? sql`${chapter.number} asc nulls last`
                : sql`${chapter.number} desc nulls last`,
              direction === "asc"
                ? sql`${mangaVolume.number} asc nulls last`
                : sql`${mangaVolume.number} desc nulls last`,
              desc(chapter.updatedAt),
              desc(chapter.id),
            ]
          : [
              direction === "asc"
                ? asc(chapter.updatedAt)
                : desc(chapter.updatedAt),
              direction === "asc" ? asc(chapter.id) : desc(chapter.id),
            ]
    const [[totalRow], rows] = await Promise.all([
      dependencies.database
        .select({ total: count() })
        .from(chapter)
        .where(where),
      dependencies.database
        .select({
          id: chapter.id,
          mangaId: chapter.mangaId,
          volume: mangaVolume.number,
          number: chapter.number,
          title: chapter.title,
          pageCount: chapter.pageCount,
          stagedPageCount: sql<number>`(
            select count(*)::integer
            from ${chapterUploadPage}
            inner join ${chapterUploadSession}
              on ${chapterUploadSession.id} = ${chapterUploadPage.sessionId}
            where ${chapterUploadSession.chapterId} = ${chapter.id}
              and ${chapterUploadSession.state} in ('open', 'finalizing')
              and ${chapterUploadPage.state} = 'ready'
          )`,
          availablePageCount: chapter.availablePageCount,
          isFull: chapter.isFull,
          pagesVersion: chapter.pagesVersion,
          processingState: chapterProcessingState,
          failureReason: chapterProcessingFailureReason,
          publicationState: chapter.publicationState,
          moderationHiddenAt: chapter.moderationHiddenAt,
          version: chapter.version,
          updatedAt: chapter.updatedAt,
        })
        .from(chapter)
        .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
    ])
    const reasons = await latestModerationReasons(
      dependencies.database,
      "chapter",
      rows.filter((row) => row.moderationHiddenAt).map((row) => row.id)
    )
    const total = Number(totalRow?.total ?? 0)
    return c.json(
      {
        data: rows.map((row) => ({
          ...row,
          volume: normalizeDecimal(row.volume),
          number: normalizeDecimal(row.number),
          moderationHiddenAt: timestamp(row.moderationHiddenAt),
          moderationReason: row.moderationHiddenAt
            ? (reasons.get(row.id) ?? null)
            : null,
          updatedAt: formatTimestamp(row.updatedAt),
        })),
        meta: pageMeta(page, limit, total),
      },
      200
    )
  })

  app.openapi(setMangaModerationVisibilityRoute, async (c) =>
    c.json(
      {
        data: await setVisibility(
          dependencies,
          c.get("accountUserId"),
          manga,
          "manga",
          c.req.valid("param").id,
          c.req.valid("json")
        ),
      },
      200
    )
  )
  app.openapi(deleteModerationMangaRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    const actor = c.get("accountUserId")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select({ title: manga.title, version: manga.version })
        .from(manga)
        .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Manga not found")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      const now = new Date()
      const [updated] = await tx
        .update(manga)
        .set({
          deletedAt: now,
          deletedByUserId: actor,
          deleteReason: null,
          updatedAt: now,
          version: sql`${manga.version} + 1`,
        })
        .where(and(eq(manga.id, id), eq(manga.version, expectedVersion)))
        .returning({ version: manga.version })
      if (!updated)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "moderation.manga.deleted",
        targetKind: "manga",
        targetId: id,
        reason: "Manga deleted by administrator",
        before: { title: current.title, version: current.version },
        after: { deletedAt: formatTimestamp(now), version: updated.version },
        createdAt: now,
      })
    })
    await dependencies.cache.invalidateCatalog()
    return c.body(null, 204)
  })
  app.openapi(setChapterModerationVisibilityRoute, async (c) =>
    c.json(
      {
        data: await setVisibility(
          dependencies,
          c.get("accountUserId"),
          chapter,
          "chapter",
          c.req.valid("param").id,
          c.req.valid("json")
        ),
      },
      200
    )
  )
  app.openapi(deleteModerationChapterRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    const actor = c.get("accountUserId")
    await dependencies.database.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const [current] = await tx
        .select()
        .from(chapter)
        .where(and(eq(chapter.id, id), isNull(chapter.deletedAt)))
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Chapter not found")
      if (current.version !== expectedVersion)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      const now = new Date()
      const [updated] = await tx
        .update(chapter)
        .set({
          deletedAt: now,
          deletedByUserId: actor,
          deleteReason: null,
          updatedAt: now,
          version: sql`${chapter.version} + 1`,
        })
        .where(and(eq(chapter.id, id), eq(chapter.version, expectedVersion)))
        .returning({ version: chapter.version })
      if (!updated)
        groupFailure(
          409,
          "VERSION_CONFLICT",
          "Content changed since it was loaded"
        )
      await tx
        .update(chapterUploadSession)
        .set({ state: "cancelled", updatedAt: now })
        .where(
          and(
            eq(chapterUploadSession.chapterId, id),
            inArray(chapterUploadSession.state, ["open", "finalizing"])
          )
        )
      if (current.publicationState === "published")
        await recomputeMangaProjection(tx, current.mangaId, now)
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "moderation.chapter.deleted",
        targetKind: "chapter",
        targetId: id,
        reason: "Chapter deleted by administrator",
        before: {
          mangaId: current.mangaId,
          title: current.title,
          publicationState: current.publicationState,
          version: current.version,
        },
        after: { deletedAt: formatTimestamp(now), version: updated.version },
        createdAt: now,
      })
    })
    await dependencies.cache.invalidateCatalog()
    return c.body(null, 204)
  })
}
