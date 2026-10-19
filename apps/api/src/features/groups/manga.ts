import type { OpenAPIHono } from "@hono/zod-openapi"
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm"
import { getYear } from "date-fns"
import { tz } from "@date-fns/tz"

import type { Database } from "../../db/client.js"
import {
  chapter,
  cover,
  coverUploadSession,
  manga,
  mangaGroup,
  mangaPerson,
  mangaTag,
  mangaVolume,
  moderationAction,
  organization,
  person,
  tag,
} from "../../db/schema.js"
import type { BusinessCache } from "../../shared/cache.js"
import { CONTENT_WRITE_LOCK } from "../../shared/content-lock.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  normalizeDecimal,
  resolveCoverUrl,
  resolveMangaLinks,
} from "../catalog/routes.js"
import { latestModerationReasons } from "../moderation/service.js"
import { notifyGroupOwnersOfContent } from "../notifications/service.js"
import * as routes from "./manga-contract.js"
import type {
  MangaCreateInput,
  MangaManagementDetail,
  MangaUpdateInput,
} from "./manga-contract.js"
import {
  contributionGroupIds,
  groupFailure,
  groupSlug,
  isApplicationAdmin,
  lockGroup,
  membershipFor,
  permissionsFor,
  requireActiveAccount,
  requireApprovedGroup,
  requireOrdinaryGroup,
  type GroupTransaction,
} from "./service.js"

type Dependencies = {
  assetBaseUrl: string
  cache: BusinessCache
  database: Database
}
type MangaInput =
  | Omit<MangaCreateInput, "coverUploadId" | "groupIds">
  | Omit<MangaUpdateInput, "expectedVersion">
type MangaRow = typeof manga.$inferSelect
type SummaryRow = Pick<
  MangaRow,
  | "id"
  | "numberingMode"
  | "slug"
  | "title"
  | "alternativeTitles"
  | "originalLanguage"
  | "status"
  | "contentRating"
  | "moderationHiddenAt"
  | "updatedAt"
  | "version"
  | "ownerGroupId"
> & {
  publicationState: MangaRow["publicationState"]
  coverStorageKey: string | null
  coverWidth: number | null
  coverHeight: number | null
}

const summaryColumns = {
  id: manga.id,
  numberingMode: manga.numberingMode,
  slug: manga.slug,
  title: manga.title,
  alternativeTitles: manga.alternativeTitles,
  publicationState: manga.publicationState,
  originalLanguage: manga.originalLanguage,
  status: manga.status,
  contentRating: manga.contentRating,
  moderationHiddenAt: manga.moderationHiddenAt,
  updatedAt: manga.updatedAt,
  version: manga.version,
  ownerGroupId: manga.ownerGroupId,
  coverStorageKey: cover.storageKey,
  coverWidth: cover.width,
  coverHeight: cover.height,
}

async function lockContent(tx: GroupTransaction) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
  )
}

async function authorizeGroupRead(
  tx: GroupTransaction,
  actor: string,
  groupId: string
) {
  await requireActiveAccount(tx, actor)
  const group = await lockGroup(tx, groupId)
  requireOrdinaryGroup(group)
  requireApprovedGroup(group)
  if (
    !(await isApplicationAdmin(tx, actor)) &&
    !(await membershipFor(tx, groupId, actor))
  )
    groupFailure(403, "FORBIDDEN", "Group membership is required")
}

export async function authorizeMangaCreate(
  tx: GroupTransaction,
  actor: string,
  groupId: string
) {
  await lockContent(tx)
  await requireActiveAccount(tx, actor)
  const group = await lockGroup(tx, groupId)
  if (await isApplicationAdmin(tx, actor)) return
  requireOrdinaryGroup(group)
  requireApprovedGroup(group)
  if (group.inactive)
    groupFailure(403, "GROUP_INACTIVE", "Inactive groups cannot modify content")
  const member = await membershipFor(tx, groupId, actor)
  if (!permissionsFor(group, member).canAddManga)
    groupFailure(403, "FORBIDDEN", "Manga create permission is required")
}

export async function requireMangaPermission(
  tx: GroupTransaction,
  actor: string,
  groupId: string,
  mangaId: string,
  options: {
    expectedVersion?: number
    delete?: boolean
    createFlow?: boolean
    ownerOnly?: boolean
  } = {}
) {
  await lockContent(tx)
  await requireActiveAccount(tx, actor)
  const group = await lockGroup(tx, groupId)

  const [target] = await tx
    .select()
    .from(manga)
    .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
    .for("update")
  if (!target) groupFailure(404, "NOT_FOUND", "Manga not found")
  const ownership = await tx
    .select({ groupId: mangaGroup.groupId })
    .from(mangaGroup)
    .where(eq(mangaGroup.mangaId, mangaId))
  const isAdmin = await isApplicationAdmin(tx, actor)
  if (!isAdmin && !ownership.some((row) => row.groupId === groupId))
    groupFailure(404, "NOT_FOUND", "Manga not found")
  if (!isAdmin) {
    requireOrdinaryGroup(group)
    requireApprovedGroup(group)
    if (group.inactive)
      groupFailure(
        403,
        "GROUP_INACTIVE",
        "Inactive groups cannot modify content"
      )
    if (target.moderationHiddenAt)
      groupFailure(
        409,
        "CONTENT_MODERATED",
        "Manga is hidden by an administrator"
      )
    if (
      (options.delete || options.ownerOnly) &&
      target.ownerGroupId !== groupId
    )
      groupFailure(
        403,
        "MANGA_OWNER_REQUIRED",
        "Manga owner access is required"
      )
    const permissions = permissionsFor(
      group,
      await membershipFor(tx, groupId, actor)
    )
    const allowed = options.delete
      ? permissions.canDeleteManga
      : options.createFlow
        ? permissions.canAddManga
        : permissions.canEditManga
    if (!allowed) groupFailure(403, "FORBIDDEN", "Manga permission is required")
  }
  if (
    options.expectedVersion !== undefined &&
    target.version !== options.expectedVersion
  )
    stale(target.version)
  return { target, isAdmin }
}

function stale(version: number): never {
  groupFailure(409, "STALE_MANGA", "Manga changed since it was loaded", [
    { path: "expectedVersion", message: `Current version is ${version}` },
  ])
}

export function validateMangaYear(year: number | null, now = new Date()) {
  if (year !== null && year > getYear(now, { in: tz("UTC") }) + 1)
    groupFailure(400, "INVALID_YEAR", "Year cannot be later than next year")
}

function searchTitle(input: MangaInput) {
  return [input.title, ...Object.values(input.alternativeTitles).flat()]
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .trim()
}

async function validateReferences(tx: GroupTransaction, input: MangaInput) {
  const people = [...new Set([...input.authorIds, ...input.artistIds])]
  const [tagRows, personRows] = await Promise.all([
    input.tagIds.length
      ? tx
          .select({ id: tag.id })
          .from(tag)
          .where(
            and(inArray(tag.id, input.tagIds), isNull(tag.moderationHiddenAt))
          )
      : [],
    people.length
      ? tx
          .select({ id: person.id })
          .from(person)
          .where(inArray(person.id, people))
      : [],
  ])
  if (tagRows.length !== input.tagIds.length)
    groupFailure(400, "INVALID_REFERENCE", "One or more tags do not exist", [
      { path: "tagIds", message: "All tags must exist" },
    ])
  if (personRows.length !== people.length)
    groupFailure(400, "INVALID_REFERENCE", "One or more people do not exist", [
      { path: "authorIds", message: "All authors and artists must exist" },
    ])
}

async function replaceRelations(
  tx: GroupTransaction,
  mangaId: string,
  input: MangaInput
) {
  await tx.delete(mangaTag).where(
    and(
      eq(mangaTag.mangaId, mangaId),
      exists(
        tx
          .select({ id: tag.id })
          .from(tag)
          .where(
            and(eq(tag.id, mangaTag.tagId), isNull(tag.moderationHiddenAt))
          )
      )
    )
  )
  await tx.delete(mangaPerson).where(eq(mangaPerson.mangaId, mangaId))
  if (input.tagIds.length)
    await tx
      .insert(mangaTag)
      .values(input.tagIds.map((tagId) => ({ mangaId, tagId })))
  const people = [
    ...input.authorIds.map((personId) => ({
      mangaId,
      personId,
      role: "author" as const,
    })),
    ...input.artistIds.map((personId) => ({
      mangaId,
      personId,
      role: "artist" as const,
    })),
  ]
  if (people.length) await tx.insert(mangaPerson).values(people)
}

async function audit(
  tx: GroupTransaction,
  actor: string,
  action: string,
  targetKind: "manga" | "person" | "volume",
  targetId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) {
  await tx.insert(moderationAction).values({
    actorUserId: actor,
    action,
    targetKind,
    targetId,
    reason: action.replaceAll(".", " "),
    before,
    after,
  })
}

function scalarValues(input: MangaInput & { slug: string }) {
  return {
    slug: input.slug,
    title: input.title,
    alternativeTitles: input.alternativeTitles,
    description: input.description,
    searchTitle: searchTitle(input),
    originalLanguage: input.originalLanguage,
    publicationDemographic: input.publicationDemographic,
    status: input.status,
    contentRating: input.contentRating,
    year: input.year,
    lastVolume: input.lastVolume,
    lastChapter: input.lastChapter,
    links: input.links,
  }
}

function mapSummary(
  row: SummaryRow,
  assetBaseUrl: string,
  moderationReason: string | null = null,
  groupId?: string
) {
  const value = row
  if (value.publicationState === "draft")
    groupFailure(
      409,
      "MANGA_STATE_UNSUPPORTED",
      "Manga draft migration is required"
    )
  return {
    id: value.id,
    numberingMode: value.numberingMode,
    slug: value.slug,
    title: value.title,
    alternativeTitles: value.alternativeTitles,
    publicationState: value.publicationState,
    moderationHiddenAt: value.moderationHiddenAt
      ? formatTimestamp(value.moderationHiddenAt)
      : null,
    moderationReason: value.moderationHiddenAt ? moderationReason : null,
    originalLanguage: value.originalLanguage,
    status: value.status,
    contentRating: value.contentRating,
    cover: value.coverStorageKey
      ? {
          url: resolveCoverUrl(assetBaseUrl, value.coverStorageKey),
          width: value.coverWidth,
          height: value.coverHeight,
        }
      : null,
    updatedAt: formatTimestamp(value.updatedAt),
    version: value.version,
    ownerGroupId: value.ownerGroupId,
    isOwner: groupId === value.ownerGroupId,
  }
}

export async function mangaManagementDetail(
  database: Database,
  groupId: string | undefined,
  mangaId: string,
  assetBaseUrl: string
): Promise<MangaManagementDetail> {
  const [row] = await database
    .select({ ...summaryColumns, manga })
    .from(manga)
    .leftJoin(
      cover,
      and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
    )
    .where(
      and(
        eq(manga.id, mangaId),
        isNull(manga.deletedAt),
        groupId
          ? or(
              eq(manga.ownerGroupId, groupId),
              exists(
                database
                  .select({ id: mangaGroup.mangaId })
                  .from(mangaGroup)
                  .where(
                    and(
                      eq(mangaGroup.mangaId, manga.id),
                      eq(mangaGroup.groupId, groupId)
                    )
                  )
              )
            )
          : undefined
      )
    )
    .limit(1)
  if (!row) groupFailure(404, "NOT_FOUND", "Manga not found")
  const [tags, people, volumes, groups, ownerGroups, reasons] =
    await Promise.all([
      database
        .select({ id: mangaTag.tagId })
        .from(mangaTag)
        .innerJoin(tag, eq(tag.id, mangaTag.tagId))
        .where(
          and(eq(mangaTag.mangaId, mangaId), isNull(tag.moderationHiddenAt))
        )
        .orderBy(asc(mangaTag.tagId)),
      database
        .select({ id: mangaPerson.personId, role: mangaPerson.role })
        .from(mangaPerson)
        .where(eq(mangaPerson.mangaId, mangaId))
        .orderBy(asc(mangaPerson.role), asc(mangaPerson.personId)),
      database
        .select({ id: mangaVolume.id, number: mangaVolume.number })
        .from(mangaVolume)
        .where(
          and(eq(mangaVolume.mangaId, mangaId), isNull(mangaVolume.deletedAt))
        )
        .orderBy(asc(mangaVolume.number), asc(mangaVolume.id)),
      database
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        })
        .from(mangaGroup)
        .innerJoin(organization, eq(organization.id, mangaGroup.groupId))
        .where(eq(mangaGroup.mangaId, mangaId))
        .orderBy(asc(organization.name), asc(organization.id)),
      database
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        })
        .from(organization)
        .where(eq(organization.id, row.manga.ownerGroupId))
        .limit(1),
      latestModerationReasons(
        database,
        "manga",
        row.moderationHiddenAt ? [mangaId] : []
      ),
    ])
  const ownerGroup = ownerGroups[0]
  if (!ownerGroup) throw new Error("Manga owner group not found")
  const summary = mapSummary(
    row,
    assetBaseUrl,
    reasons.get(mangaId) ?? null,
    groupId
  )
  return {
    ...summary,
    alternativeTitles: row.manga.alternativeTitles,
    description: row.manga.description,
    publicationDemographic: row.manga.publicationDemographic as
      "shounen" | "shoujo" | "josei" | "seinen" | null,
    year: row.manga.year,
    lastVolume: row.manga.lastVolume,
    lastChapter: row.manga.lastChapter,
    links: Object.fromEntries(
      resolveMangaLinks(row.manga.links).map(({ key, url }) => [key, url])
    ),
    tagIds: tags.map(({ id }) => id),
    authorIds: people
      .filter(({ role }) => role === "author")
      .map(({ id }) => id),
    artistIds: people
      .filter(({ role }) => role === "artist")
      .map(({ id }) => id),
    volumes: volumes.map(({ id, number }) => ({
      id,
      number: normalizeDecimal(number)!,
    })),
    owners: groups,
    groups,
    ownerGroup,
    createdAt: formatTimestamp(row.manga.createdAt),
    publishedAt: row.manga.publishedAt
      ? formatTimestamp(row.manga.publishedAt)
      : null,
  }
}

export async function updateMangaMetadata(
  tx: GroupTransaction,
  actor: string,
  target: MangaRow,
  input: MangaUpdateInput
) {
  const { expectedVersion, ...values } = input
  validateMangaYear(values.year)
  if (target.version !== expectedVersion) stale(target.version)
  await validateReferences(tx, values)
  const [updated] = await tx
    .update(manga)
    .set({
      ...scalarValues(values),
      updatedAt: new Date(),
      version: sql`${manga.version} + 1`,
    })
    .where(and(eq(manga.id, target.id), eq(manga.version, expectedVersion)))
    .returning({ version: manga.version })
  if (!updated) stale(target.version)
  await replaceRelations(tx, target.id, values)
  await audit(
    tx,
    actor,
    "manga.updated",
    "manga",
    target.id,
    { title: target.title, version: target.version },
    { title: values.title, version: updated.version }
  )
}

export function registerMangaRoutes(
  app: OpenAPIHono,
  dependencies: Dependencies
) {
  const { database, cache, assetBaseUrl } = dependencies

  app.openapi(routes.createPersonRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const input = c.req.valid("json")
    const created = await database.transaction(async (tx) => {
      await authorizeMangaCreate(tx, actor, groupId)
      const slug = groupSlug(input.name)
      const [created] = await tx
        .insert(person)
        .values({
          name: input.name,
          slug: slug === "group" ? "person" : slug,
        })
        .returning({ id: person.id, name: person.name, slug: person.slug })
      if (!created) throw new Error("Person was not created")
      await audit(tx, actor, "person.created", "person", created.id, null, {
        groupId,
        name: created.name,
        slug: created.slug,
      })
      return created
    })
    await cache.invalidateCatalog()
    return c.json({ data: created }, 201)
  })

  app.openapi(routes.listGroupMangaRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { page, limit, q, publicationState } = c.req.valid("query")
    await database.transaction((tx) => authorizeGroupRead(tx, actor, groupId))
    const pattern = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : undefined
    const where = and(
      eq(mangaGroup.groupId, groupId),
      isNull(manga.deletedAt),
      publicationState
        ? eq(manga.publicationState, publicationState)
        : inArray(manga.publicationState, ["published", "hidden"]),
      pattern
        ? sql`${manga.searchTitle} ilike ${pattern} escape '\\'`
        : undefined
    )
    const [rows, [{ total }]] = await Promise.all([
      database
        .select(summaryColumns)
        .from(mangaGroup)
        .innerJoin(manga, eq(manga.id, mangaGroup.mangaId))
        .leftJoin(
          cover,
          and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
        )
        .where(where)
        .orderBy(desc(manga.updatedAt), desc(manga.id))
        .limit(limit)
        .offset((page - 1) * limit),
      database
        .select({ total: count() })
        .from(mangaGroup)
        .innerJoin(manga, eq(manga.id, mangaGroup.mangaId))
        .where(where),
    ])
    const reasons = await latestModerationReasons(
      database,
      "manga",
      rows.filter((row) => row.moderationHiddenAt).map((row) => row.id)
    )
    return c.json(
      {
        data: rows.map((row) =>
          mapSummary(row, assetBaseUrl, reasons.get(row.id) ?? null, groupId)
        ),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      200
    )
  })

  app.openapi(routes.getGroupMangaRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    await database.transaction((tx) => authorizeGroupRead(tx, actor, groupId))
    return c.json(
      {
        data: await mangaManagementDetail(
          database,
          groupId,
          mangaId,
          assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(routes.createMangaRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { coverUploadId, groupIds, ...input } = c.req.valid("json")
    validateMangaYear(input.year)
    const mangaId = await database.transaction(async (tx) => {
      await authorizeMangaCreate(tx, actor, groupId)
      const contentGroupIds = await contributionGroupIds(tx, groupId, groupIds)
      await validateReferences(tx, input)
      const publishedAt = new Date()
      const [created] = await tx
        .insert(manga)
        .values({
          ...scalarValues({
            ...input,
            slug: input.slug ?? groupSlug(input.title),
          }),
          publicationState: "published",
          publishedAt,
          ownerGroupId: groupId,
        })
        .returning({ id: manga.id })
      if (!created) throw new Error("Manga was not created")
      await tx.insert(mangaGroup).values(
        contentGroupIds.map((contentGroupId) => ({
          mangaId: created.id,
          groupId: contentGroupId,
          isExplicit: contentGroupId !== groupId,
        }))
      )
      if (coverUploadId) {
        const [bound] = await tx
          .update(coverUploadSession)
          .set({ mangaId: created.id, updatedAt: publishedAt })
          .where(
            and(
              eq(coverUploadSession.id, coverUploadId),
              eq(coverUploadSession.groupId, groupId),
              eq(coverUploadSession.actorUserId, actor),
              eq(coverUploadSession.createFlow, true),
              eq(coverUploadSession.state, "pending"),
              gt(coverUploadSession.expiresAt, publishedAt),
              isNull(coverUploadSession.mangaId)
            )
          )
          .returning({ id: coverUploadSession.id })
        if (!bound)
          groupFailure(
            409,
            "COVER_SESSION_CHANGED",
            "Cover session is no longer available"
          )
      }
      await replaceRelations(tx, created.id, input)
      await notifyGroupOwnersOfContent(
        tx,
        contentGroupIds.filter((id) => id !== groupId),
        actor
      )
      await audit(tx, actor, "manga.created", "manga", created.id, null, {
        title: input.title,
        groupId,
        ownerGroupId: groupId,
        groupIds: contentGroupIds,
        version: 1,
      })
      return created.id
    })
    await cache.invalidateCatalog()
    return c.json(
      {
        data: await mangaManagementDetail(
          database,
          groupId,
          mangaId,
          assetBaseUrl
        ),
      },
      201
    )
  })

  app.openapi(routes.updateMangaRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const { expectedVersion, ...input } = c.req.valid("json")
    await database.transaction(async (tx) => {
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        { expectedVersion }
      )
      await updateMangaMetadata(tx, actor, target, {
        ...input,
        expectedVersion,
      })
    })
    await cache.invalidateCatalog()
    return c.json(
      {
        data: await mangaManagementDetail(
          database,
          groupId,
          mangaId,
          assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(routes.setMangaVisibilityRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const { expectedVersion, hidden } = c.req.valid("json")
    await database.transaction(async (tx) => {
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        {
          expectedVersion,
          ownerOnly: true,
        }
      )
      const publicationState = hidden ? "hidden" : "published"
      if (target.publicationState === publicationState)
        groupFailure(
          409,
          "MANGA_VISIBILITY_UNCHANGED",
          hidden ? "Manga is already hidden" : "Manga is already visible"
        )
      const updatedAt = new Date()
      const [updated] = await tx
        .update(manga)
        .set({
          publicationState,
          publishedAt: target.publishedAt ?? updatedAt,
          updatedAt,
          version: sql`${manga.version} + 1`,
        })
        .where(and(eq(manga.id, mangaId), eq(manga.version, expectedVersion)))
        .returning({ version: manga.version })
      if (!updated) stale(target.version)
      await audit(
        tx,
        actor,
        hidden ? "manga.hidden" : "manga.shown",
        "manga",
        mangaId,
        {
          publicationState: target.publicationState,
          version: target.version,
        },
        {
          publicationState,
          version: updated.version,
        }
      )
    })
    await cache.invalidateCatalog()
    return c.json(
      {
        data: await mangaManagementDetail(
          database,
          groupId,
          mangaId,
          assetBaseUrl
        ),
      },
      200
    )
  })

  app.openapi(routes.deleteMangaRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    await database.transaction(async (tx) => {
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        { expectedVersion, delete: true }
      )
      const deletedAt = new Date()
      const [updated] = await tx
        .update(manga)
        .set({
          deletedAt,
          deletedByUserId: actor,
          deleteReason: null,
          updatedAt: deletedAt,
          version: sql`${manga.version} + 1`,
        })
        .where(and(eq(manga.id, mangaId), eq(manga.version, expectedVersion)))
        .returning({ version: manga.version })
      if (!updated) stale(target.version)
      await audit(
        tx,
        actor,
        "manga.deleted",
        "manga",
        mangaId,
        {
          title: target.title,
          version: target.version,
        },
        { version: updated.version }
      )
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })

  app.openapi(routes.createVolumeRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const input = c.req.valid("json")
    const result = await database.transaction(async (tx) => {
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        {
          expectedVersion: input.expectedVersion,
        }
      )
      const [duplicate] = await tx
        .select({ id: mangaVolume.id })
        .from(mangaVolume)
        .where(
          and(
            eq(mangaVolume.mangaId, mangaId),
            eq(mangaVolume.number, input.number),
            isNull(mangaVolume.deletedAt)
          )
        )
        .limit(1)
      if (duplicate)
        groupFailure(409, "VOLUME_EXISTS", "This volume number already exists")
      const [created] = await tx
        .insert(mangaVolume)
        .values({ mangaId, number: input.number })
        .returning({ id: mangaVolume.id, number: mangaVolume.number })
      if (!created) throw new Error("Volume was not created")
      const mangaVersion = target.version + 1
      await tx
        .update(manga)
        .set({ version: mangaVersion, updatedAt: new Date() })
        .where(and(eq(manga.id, mangaId), eq(manga.version, target.version)))
      await audit(tx, actor, "volume.created", "volume", created.id, null, {
        mangaId,
        number: input.number,
        mangaVersion,
      })
      return {
        data: { ...created, number: normalizeDecimal(created.number)! },
        mangaVersion,
      }
    })
    await cache.invalidateCatalog()
    return c.json(result, 201)
  })

  app.openapi(routes.updateVolumeRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, volumeId } = c.req.valid("param")
    const input = c.req.valid("json")
    const result = await database.transaction(async (tx) => {
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        {
          expectedVersion: input.expectedVersion,
        }
      )
      const [volume] = await tx
        .select()
        .from(mangaVolume)
        .where(
          and(
            eq(mangaVolume.id, volumeId),
            eq(mangaVolume.mangaId, mangaId),
            isNull(mangaVolume.deletedAt)
          )
        )
        .for("update")
      if (!volume) groupFailure(404, "NOT_FOUND", "Volume not found")
      const [duplicate] = await tx
        .select({ id: mangaVolume.id })
        .from(mangaVolume)
        .where(
          and(
            eq(mangaVolume.mangaId, mangaId),
            eq(mangaVolume.number, input.number),
            ne(mangaVolume.id, volumeId),
            isNull(mangaVolume.deletedAt)
          )
        )
        .limit(1)
      if (duplicate)
        groupFailure(409, "VOLUME_EXISTS", "This volume number already exists")
      await tx
        .update(mangaVolume)
        .set({ number: input.number, updatedAt: new Date() })
        .where(eq(mangaVolume.id, volumeId))
      const mangaVersion = target.version + 1
      await tx
        .update(manga)
        .set({ version: mangaVersion, updatedAt: new Date() })
        .where(and(eq(manga.id, mangaId), eq(manga.version, target.version)))
      await audit(
        tx,
        actor,
        "volume.updated",
        "volume",
        volumeId,
        {
          number: volume.number,
        },
        { number: input.number, mangaVersion }
      )
      return {
        data: { id: volumeId, number: normalizeDecimal(input.number)! },
        mangaVersion,
      }
    })
    await cache.invalidateCatalog()
    return c.json(result, 200)
  })

  app.openapi(routes.deleteVolumeRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, volumeId } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    await database.transaction(async (tx) => {
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        {
          expectedVersion,
        }
      )
      const [volume] = await tx
        .select()
        .from(mangaVolume)
        .where(
          and(
            eq(mangaVolume.id, volumeId),
            eq(mangaVolume.mangaId, mangaId),
            isNull(mangaVolume.deletedAt)
          )
        )
        .for("update")
      if (!volume) groupFailure(404, "NOT_FOUND", "Volume not found")
      const [inUse] = await tx
        .select({ id: chapter.id })
        .from(chapter)
        .where(and(eq(chapter.volumeId, volumeId), isNull(chapter.deletedAt)))
        .limit(1)
      if (inUse)
        groupFailure(409, "VOLUME_IN_USE", "Volume is used by a chapter")
      const deletedAt = new Date()
      await tx
        .update(mangaVolume)
        .set({
          deletedAt,
          deletedByUserId: actor,
          deleteReason: null,
          updatedAt: deletedAt,
        })
        .where(eq(mangaVolume.id, volumeId))
      await tx
        .update(manga)
        .set({ version: target.version + 1, updatedAt: deletedAt })
        .where(and(eq(manga.id, mangaId), eq(manga.version, target.version)))
      await audit(
        tx,
        actor,
        "volume.deleted",
        "volume",
        volumeId,
        {
          number: volume.number,
        },
        { mangaVersion: target.version + 1 }
      )
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })
}
