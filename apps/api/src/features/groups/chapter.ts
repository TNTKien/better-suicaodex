import { createHash, randomUUID } from "node:crypto"

import type { OpenAPIHono } from "@hono/zod-openapi"
import { addHours, addMinutes, isAfter, subMinutes } from "date-fns"
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "../../db/client.js"
import {
  chapter,
  chapterGroup,
  chapterPage,
  chapterUploadFinalObject,
  chapterUploadPage,
  chapterUploadSession,
  manga,
  mangaGroup,
  mangaLanguage,
  mangaVolume,
  moderationAction,
  organization,
} from "../../db/schema.js"
import type { BusinessCache } from "../../shared/cache.js"
import { apiError, IdSchema } from "../../shared/contract.js"
import { CONTENT_WRITE_LOCK } from "../../shared/content-lock.js"
import { errorFields } from "../../shared/logger.js"
import type { Logger } from "../../shared/logger.js"
import type { ChapterStorage } from "../../shared/storage.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  normalizeDecimal,
  resolveAssetUrl,
  type CatalogVisibility,
} from "../catalog/routes.js"
import {
  fanOutChapterNotification,
  notifyGroupOwnersOfContent,
} from "../notifications/service.js"
import { latestModerationReasons } from "../moderation/service.js"
import * as routes from "./chapter-contract.js"
import {
  chapterPageUploadTrace,
  type ChapterPageUploadTrace,
} from "./chapter-upload-log.js"
import type {
  ChapterCreateInput,
  ChapterFinalizeInput,
  ChapterManagementDetail,
  ChapterUploadSession,
} from "./chapter-contract.js"
import {
  CHAPTER_ACTOR_MAX_ACTIVE_SESSIONS,
  ChapterImageBusyError,
  ChapterImageError,
  CHAPTER_MAX_PAGES,
  CHAPTER_PAGE_MAX_INPUT_BYTES,
  CHAPTER_PAGE_MULTIPART_MAX_BYTES,
  CHAPTER_SESSION_MAX_SOURCE_BYTES,
  transformChapterPage,
} from "./chapter-image.js"
import {
  contributionGroupIds,
  GroupError,
  groupFailure,
  isApplicationAdmin,
  lockGroup,
  membershipFor,
  permissionsFor,
  requireActiveAccount,
  requireApprovedGroup,
  requireOrdinaryGroup,
  type GroupRow,
  type GroupTransaction,
  type MemberRow,
} from "./service.js"

export type Dependencies = CatalogVisibility & {
  assetBaseUrl: string
  cache: BusinessCache
  database: Database
  logger: Logger
  now?: () => Date
  storage?: ChapterStorage
}
type ChapterAction = "add" | "edit" | "delete"
type ChapterRow = typeof chapter.$inferSelect
type PageRow = typeof chapterUploadPage.$inferSelect
type ChapterContext = {
  group: GroupRow
  isAdmin: boolean
  manga: typeof manga.$inferSelect
  member: MemberRow | undefined
  target?: ChapterRow
}

const PRIVATE_PREVIEW_FETCH_SECONDS = 60
const CHAPTER_FINALIZE_CLAIM_MINUTES = 5
const CHAPTER_FINALIZE_COPY_CONCURRENCY = 3
const CHAPTER_PUBLIC_CACHE_CONTROL = "public, max-age=31536000, immutable"

const pageUploadPaths = [
  routes.uploadChapterPageRoute.getRoutingPath(),
  routes.uploadChapterStagingPageRoute.getRoutingPath(),
]

export const isChapterPageUpload = (method: string, path: string) =>
  method === "POST" &&
  /^\/v1\/contribution\/groups\/[^/]+\/manga\/[^/]+\/(?:chapters\/[^/]+\/uploads|chapter-uploads)\/[^/]+\/pages$/.test(
    path
  )

async function lockContent(tx: GroupTransaction) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
  )
}

function requirePermission(context: ChapterContext, action: ChapterAction) {
  if (context.isAdmin) return
  if (action === "delete" && context.target?.ownerGroupId !== context.group.id)
    groupFailure(
      403,
      "CHAPTER_OWNER_REQUIRED",
      "Chapter owner access is required"
    )
  const permissions = permissionsFor(context.group, context.member)
  const allowed =
    action === "add"
      ? permissions.canAddChapter
      : action === "edit"
        ? permissions.canEditChapter
        : permissions.canDeleteChapter
  if (!allowed)
    groupFailure(403, "FORBIDDEN", `Chapter ${action} permission is required`)
}

function requireMangaAvailable(context: ChapterContext) {
  if (context.manga.moderationHiddenAt && !context.isAdmin)
    groupFailure(
      409,
      "CONTENT_MODERATED",
      "Manga is hidden by an administrator"
    )
  if (context.manga.publicationState === "draft")
    groupFailure(
      409,
      "MANGA_NOT_PUBLISHED",
      "Manga must be published before its chapters"
    )
}

function stale(version: number): never {
  groupFailure(409, "STALE_CHAPTER", "Chapter changed since it was loaded", [
    { path: "expectedVersion", message: `Current version is ${version}` },
  ])
}

async function authorizeRead(
  tx: GroupTransaction,
  actor: string,
  groupId: string,
  mangaId: string
) {
  await requireActiveAccount(tx, actor)
  const group = await lockGroup(tx, groupId)
  const isAdmin = await isApplicationAdmin(tx, actor)
  if (!isAdmin) {
    requireOrdinaryGroup(group)
    requireApprovedGroup(group)
  }
  if (!isAdmin && !(await membershipFor(tx, groupId, actor)))
    groupFailure(403, "FORBIDDEN", "Group membership is required")
  const [target] = await tx
    .select({ id: manga.id })
    .from(manga)
    .where(
      and(
        eq(manga.id, mangaId),
        isNull(manga.deletedAt),
        isAdmin
          ? undefined
          : or(
              exists(
                tx
                  .select({ id: mangaGroup.mangaId })
                  .from(mangaGroup)
                  .where(
                    and(
                      eq(mangaGroup.mangaId, manga.id),
                      eq(mangaGroup.groupId, groupId)
                    )
                  )
              ),
              exists(
                tx
                  .select({ id: chapterGroup.chapterId })
                  .from(chapterGroup)
                  .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
                  .where(
                    and(
                      eq(chapter.mangaId, manga.id),
                      eq(chapterGroup.groupId, groupId),
                      isNull(chapter.deletedAt)
                    )
                  )
              )
            )
      )
    )
    .limit(1)
  if (!target) groupFailure(404, "NOT_FOUND", "Manga not found")
  return isAdmin
}

async function lockContext(
  tx: GroupTransaction,
  actor: string,
  groupId: string,
  mangaId: string,
  chapterId?: string
): Promise<ChapterContext> {
  await lockContent(tx)
  await requireActiveAccount(tx, actor)
  const group = await lockGroup(tx, groupId)
  const isAdmin = await isApplicationAdmin(tx, actor)
  if (!isAdmin) {
    requireOrdinaryGroup(group)
    requireApprovedGroup(group)
  }
  if (group.inactive && !isAdmin)
    groupFailure(403, "GROUP_INACTIVE", "Inactive groups cannot modify content")

  const [mangaTarget] = await tx
    .select()
    .from(manga)
    .where(and(eq(manga.id, mangaId), isNull(manga.deletedAt)))
    .for("update")
  if (!mangaTarget) groupFailure(404, "NOT_FOUND", "Manga not found")
  if (!chapterId && !isAdmin) {
    const [mangaMembership] = await tx
      .select({ groupId: mangaGroup.groupId })
      .from(mangaGroup)
      .where(
        and(eq(mangaGroup.mangaId, mangaId), eq(mangaGroup.groupId, groupId))
      )
    if (!mangaMembership) groupFailure(404, "NOT_FOUND", "Manga not found")
  }

  const member = isAdmin ? undefined : await membershipFor(tx, groupId, actor)
  if (!isAdmin && !member)
    groupFailure(403, "FORBIDDEN", "Group membership is required")

  if (!chapterId) return { group, isAdmin, manga: mangaTarget, member }
  const [target] = await tx
    .select()
    .from(chapter)
    .where(
      and(
        eq(chapter.id, chapterId),
        eq(chapter.mangaId, mangaId),
        isNull(chapter.deletedAt),
        ne(chapter.publicationState, "hidden")
      )
    )
    .for("update")
  if (!target) groupFailure(404, "NOT_FOUND", "Chapter not found")
  if (target.moderationHiddenAt && !isAdmin)
    groupFailure(
      409,
      "CONTENT_MODERATED",
      "Chapter is hidden by an administrator"
    )
  const ownership = await tx
    .select({ groupId: chapterGroup.groupId })
    .from(chapterGroup)
    .where(eq(chapterGroup.chapterId, chapterId))
  if (!isAdmin && !ownership.some((owner) => owner.groupId === groupId))
    groupFailure(404, "NOT_FOUND", "Chapter not found")
  return { group, isAdmin, manga: mangaTarget, member, target }
}

async function audit(
  tx: GroupTransaction,
  actor: string,
  action: string,
  targetKind: "chapter" | "manga" | "volume",
  targetId: string,
  reason: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  createdAt?: Date
) {
  await tx.insert(moderationAction).values({
    actorUserId: actor,
    action,
    targetKind,
    targetId,
    reason,
    before,
    after,
    createdAt,
  })
}

async function resolveVolume(
  tx: GroupTransaction,
  mangaId: string,
  groupId: string,
  volumeNumber: string | null,
  actor: string,
  now: Date
) {
  if (volumeNumber === null) return null
  const [existing] = await tx
    .select({ id: mangaVolume.id, number: mangaVolume.number })
    .from(mangaVolume)
    .where(
      and(
        eq(mangaVolume.mangaId, mangaId),
        eq(mangaVolume.number, volumeNumber),
        isNull(mangaVolume.deletedAt)
      )
    )
    .limit(1)
  if (existing) return existing

  const [created] = await tx
    .insert(mangaVolume)
    .values({ mangaId, number: volumeNumber, createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .returning({ id: mangaVolume.id, number: mangaVolume.number })
  const volume =
    created ??
    (
      await tx
        .select({ id: mangaVolume.id, number: mangaVolume.number })
        .from(mangaVolume)
        .where(
          and(
            eq(mangaVolume.mangaId, mangaId),
            eq(mangaVolume.number, volumeNumber),
            isNull(mangaVolume.deletedAt)
          )
        )
        .limit(1)
    )[0]
  if (!volume) throw new Error("Volume was not created")
  if (created) {
    await tx
      .update(manga)
      .set({ updatedAt: now, version: sql`${manga.version} + 1` })
      .where(eq(manga.id, mangaId))
    await audit(
      tx,
      actor,
      "volume.created",
      "volume",
      volume.id,
      "volume created",
      null,
      { groupId, mangaId, number: normalizeDecimal(volume.number) },
      now
    )
  }
  return volume
}

async function defaultPositionAvailable(
  tx: GroupTransaction,
  mangaId: string,
  input: Pick<ChapterCreateInput, "number" | "language">,
  volumeId: string | null,
  mode: "global" | "volume",
  excludeId?: string
) {
  if (input.number === null || (mode === "volume" && volumeId === null))
    return true
  const [existing] = await tx
    .select({ id: chapter.id })
    .from(chapter)
    .where(
      and(
        eq(chapter.mangaId, mangaId),
        eq(chapter.language, input.language),
        eq(chapter.number, input.number),
        isNull(chapter.deletedAt),
        excludeId ? ne(chapter.id, excludeId) : undefined,
        mode === "volume" ? eq(chapter.volumeId, volumeId!) : undefined
      )
    )
    .limit(1)
  return !existing
}

async function insertChapterDraft(
  tx: GroupTransaction,
  actor: string,
  groupId: string,
  mangaId: string,
  input: ChapterCreateInput,
  now: Date,
  mode: "global" | "volume"
) {
  const contentGroupIds = await contributionGroupIds(
    tx,
    groupId,
    input.groupIds
  )
  const volume = await resolveVolume(
    tx,
    mangaId,
    groupId,
    input.volumeNumber,
    actor,
    now
  )
  const [created] = await tx
    .insert(chapter)
    .values({
      mangaId,
      numberingMode: mode,
      isDefault: await defaultPositionAvailable(
        tx,
        mangaId,
        input,
        volume?.id ?? null,
        mode
      ),
      volumeId: volume?.id ?? null,
      number: input.number,
      title: input.title,
      language: input.language,
      pageCount: 0,
      availablePageCount: 0,
      isFull: false,
      publicationState: "draft",
      ownerGroupId: groupId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: chapter.id })
  if (!created) throw new Error("Chapter insert did not return an ID")
  await tx.insert(chapterGroup).values(
    contentGroupIds.map((contentGroupId) => ({
      chapterId: created.id,
      groupId: contentGroupId,
    }))
  )
  const addedMangaGroups = await tx
    .insert(mangaGroup)
    .values(
      contentGroupIds.map((contentGroupId) => ({
        mangaId,
        groupId: contentGroupId,
        isExplicit: contentGroupId !== groupId,
      }))
    )
    .onConflictDoNothing()
    .returning({ groupId: mangaGroup.groupId })
  const collaboratorIds = contentGroupIds.filter((id) => id !== groupId)
  if (collaboratorIds.length)
    await tx
      .update(mangaGroup)
      .set({ isExplicit: true })
      .where(
        and(
          eq(mangaGroup.mangaId, mangaId),
          inArray(mangaGroup.groupId, collaboratorIds)
        )
      )
  await notifyGroupOwnersOfContent(
    tx,
    contentGroupIds.filter((id) => id !== groupId),
    actor
  )
  await audit(
    tx,
    actor,
    "chapter.created",
    "chapter",
    created.id,
    "chapter created",
    null,
    {
      groupId,
      ownerGroupId: groupId,
      groupIds: contentGroupIds,
      addedMangaGroupIds: addedMangaGroups.map(({ groupId }) => groupId),
      mangaId,
      volumeId: volume?.id ?? null,
      number: input.number,
      title: input.title,
      language: input.language,
      version: 1,
    },
    now
  )
  return created.id
}

export const chapterProcessingState = sql<
  "idle" | "queued" | "processing" | "failed"
>`coalesce((
  select case
    when ${chapterUploadSession.finalizeError} is not null then 'failed'
    when ${chapterUploadSession.finalizeClaimToken} is null
      or ${chapterUploadSession.finalizeClaimExpiresAt} <= current_timestamp then 'queued'
    else 'processing'
  end
  from ${chapterUploadSession}
  where ${chapterUploadSession.chapterId} = ${chapter.id}
    and (
      ${chapterUploadSession.state} = 'finalizing'
      or (
        ${chapterUploadSession.state} = 'open'
        and ${chapterUploadSession.finalizeError} is not null
        and ${chapterUploadSession.expiresAt} > current_timestamp
      )
    )
  limit 1
), 'idle')`.as("processing_state")

export const chapterProcessingFailureReason = sql<string | null>`(
  select ${chapterUploadSession.finalizeError}
  from ${chapterUploadSession}
  where ${chapterUploadSession.chapterId} = ${chapter.id}
    and ${chapterUploadSession.finalizeError} is not null
    and ${chapterUploadSession.state} in ('open', 'finalizing')
  limit 1
)`.as("processing_failure_reason")

const summaryColumns = {
  id: chapter.id,
  isDefault: chapter.isDefault,
  mangaId: chapter.mangaId,
  volumeId: mangaVolume.id,
  volumeNumber: mangaVolume.number,
  number: chapter.number,
  title: chapter.title,
  language: chapter.language,
  publicationState: chapter.publicationState,
  moderationHiddenAt: chapter.moderationHiddenAt,
  processingState: chapterProcessingState,
  pageCount: chapter.pageCount,
  stagedPageCount: sql<number>`(
    select count(*)::integer
    from ${chapterUploadPage}
    inner join ${chapterUploadSession}
      on ${chapterUploadSession.id} = ${chapterUploadPage.sessionId}
    where ${chapterUploadSession.chapterId} = ${chapter.id}
      and ${chapterUploadSession.state} in ('open', 'finalizing')
      and ${chapterUploadPage.state} = 'ready'
  )`.as("staged_page_count"),
  availablePageCount: chapter.availablePageCount,
  isFull: chapter.isFull,
  updatedAt: chapter.updatedAt,
  version: chapter.version,
  ownerGroupId: chapter.ownerGroupId,
}

function mapSummary(
  row: {
    id: string
    isDefault: boolean
    mangaId: string
    volumeId: string | null
    volumeNumber: string | null
    number: string | null
    title: string | null
    language: string
    publicationState: "draft" | "published" | "hidden"
    moderationHiddenAt: Date | null
    processingState: "idle" | "queued" | "processing" | "failed"
    pageCount: number
    stagedPageCount: number
    availablePageCount: number
    isFull: boolean
    updatedAt: Date
    version: number
    ownerGroupId: string
  },
  moderationReason: string | null = null,
  groupId?: string
) {
  if (row.publicationState === "hidden")
    groupFailure(404, "NOT_FOUND", "Chapter not found")
  return {
    id: row.id,
    isDefault: row.isDefault,
    mangaId: row.mangaId,
    volume:
      row.volumeId && row.volumeNumber
        ? { id: row.volumeId, number: normalizeDecimal(row.volumeNumber)! }
        : null,
    number: normalizeDecimal(row.number),
    title: row.title,
    language: row.language,
    publicationState: row.publicationState,
    moderationHiddenAt: row.moderationHiddenAt
      ? formatTimestamp(row.moderationHiddenAt)
      : null,
    moderationReason: row.moderationHiddenAt ? moderationReason : null,
    processingState: row.processingState,
    pageCount: row.pageCount,
    stagedPageCount: row.stagedPageCount,
    availablePageCount: row.availablePageCount,
    isFull: row.isFull,
    updatedAt: formatTimestamp(row.updatedAt),
    version: row.version,
    ownerGroupId: row.ownerGroupId,
    isOwner: groupId === row.ownerGroupId,
  }
}

export async function chapterManagementDetail(
  database: Database,
  groupId: string,
  mangaId: string,
  chapterId: string,
  now = new Date()
): Promise<ChapterManagementDetail> {
  const [row] = await database
    .select({
      ...summaryColumns,
      createdAt: chapter.createdAt,
      publishedAt: chapter.publishedAt,
    })
    .from(chapter)
    .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
    .where(
      and(
        eq(chapter.id, chapterId),
        eq(chapter.mangaId, mangaId),
        isNull(chapter.deletedAt),
        ne(chapter.publicationState, "hidden"),

        or(
          eq(chapter.ownerGroupId, groupId),
          exists(
            database
              .select({ id: chapterGroup.chapterId })
              .from(chapterGroup)
              .where(
                and(
                  eq(chapterGroup.chapterId, chapter.id),
                  eq(chapterGroup.groupId, groupId)
                )
              )
          )
        )
      )
    )
    .limit(1)
  if (!row) groupFailure(404, "NOT_FOUND", "Chapter not found")
  const [groups, ownerGroups, active, reasons] = await Promise.all([
    database
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(chapterGroup)
      .innerJoin(organization, eq(organization.id, chapterGroup.groupId))
      .where(eq(chapterGroup.chapterId, chapterId))
      .orderBy(asc(organization.name), asc(organization.id)),
    database
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(organization)
      .where(eq(organization.id, row.ownerGroupId))
      .limit(1),
    database
      .select({
        id: chapterUploadSession.id,
        mode: chapterUploadSession.mode,
        state: chapterUploadSession.state,
        finalizeClaimToken: chapterUploadSession.finalizeClaimToken,
        finalizeClaimExpiresAt: chapterUploadSession.finalizeClaimExpiresAt,
        finalizeError: chapterUploadSession.finalizeError,
        expiresAt: chapterUploadSession.expiresAt,
      })
      .from(chapterUploadSession)
      .where(
        and(
          eq(chapterUploadSession.chapterId, chapterId),
          inArray(chapterUploadSession.state, ["open", "finalizing"]),
          or(
            eq(chapterUploadSession.state, "finalizing"),
            gt(chapterUploadSession.expiresAt, now)
          )
        )
      )
      .limit(1),
    latestModerationReasons(
      database,
      "chapter",
      row.moderationHiddenAt ? [chapterId] : []
    ),
  ])
  const ownerGroup = ownerGroups[0]
  if (!ownerGroup) throw new Error("Chapter owner group not found")
  const session = active[0]
  const [{ readyPageCount }] = session
    ? await database
        .select({ readyPageCount: count() })
        .from(chapterUploadPage)
        .where(
          and(
            eq(chapterUploadPage.sessionId, session.id),
            eq(chapterUploadPage.state, "ready")
          )
        )
    : [{ readyPageCount: 0 }]
  return {
    ...mapSummary(row, reasons.get(chapterId) ?? null, groupId),
    groups,
    ownerGroup,
    activeUploadSession: session
      ? {
          ...session,
          state: session.state as "open" | "finalizing",
          processingState: sessionProcessingState(session, now),
          failureReason: session.finalizeError,
          readyPageCount,
          expiresAt: formatTimestamp(session.expiresAt),
        }
      : null,
    createdAt: formatTimestamp(row.createdAt),
    publishedAt: row.publishedAt ? formatTimestamp(row.publishedAt) : null,
  }
}

function mapPage(row: PageRow) {
  return {
    id: row.id,
    state: row.state,
    width: row.width,
    height: row.height,
    sourceByteSize: row.sourceByteSize,
    storedByteSize: row.storedByteSize,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}

function sessionProcessingState(
  session: Pick<
    typeof chapterUploadSession.$inferSelect,
    "state" | "finalizeClaimToken" | "finalizeClaimExpiresAt" | "finalizeError"
  >,
  now: Date
) {
  if (session.finalizeError) return "failed" as const
  if (session.state !== "finalizing") return "idle" as const
  return session.finalizeClaimToken &&
    session.finalizeClaimExpiresAt &&
    isAfter(session.finalizeClaimExpiresAt, now)
    ? ("processing" as const)
    : ("queued" as const)
}

async function pageDto(
  dependencies: Pick<Dependencies, "assetBaseUrl">,
  row: PageRow,
  requestUrl: string
) {
  return {
    ...mapPage(row),
    previewUrl:
      row.state === "ready"
        ? row.publishedOriginalKey
          ? resolveAssetUrl(
              dependencies.assetBaseUrl,
              row.publishedOptimizedKey ?? row.publishedOriginalKey
            )
          : new URL(
              `/uploads/chapters/tmp/${encodeURIComponent(row.id)}.webp`,
              requestUrl
            ).href
        : null,
  }
}

async function sessionDto(
  dependencies: Dependencies,
  sessionId: string,
  requestUrl: string
): Promise<ChapterUploadSession> {
  const { database, storage } = dependencies
  if (!storage)
    groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
  const now = dependencies.now?.() ?? new Date()
  const [session, pages] = await Promise.all([
    database
      .select()
      .from(chapterUploadSession)
      .where(eq(chapterUploadSession.id, sessionId))
      .then((rows) => rows[0]),
    database
      .select()
      .from(chapterUploadPage)
      .where(eq(chapterUploadPage.sessionId, sessionId))
      .orderBy(asc(chapterUploadPage.createdAt), asc(chapterUploadPage.id)),
  ])
  if (!session) groupFailure(404, "NOT_FOUND", "Upload session not found")
  const pageDtos = await Promise.all(
    pages.map((page) => pageDto(dependencies, page, requestUrl))
  )
  return {
    id: session.id,
    chapterId: session.chapterId,
    mangaId: session.mangaId,
    mode: session.mode,
    state: session.state,
    processingState: sessionProcessingState(session, now),
    failureReason: session.finalizeError,
    expectedChapterVersion: session.expectedChapterVersion,
    orderedPageIds: session.orderedPageIds,
    pages: pageDtos,
    expiresAt: formatTimestamp(session.expiresAt),
    createdAt: formatTimestamp(session.createdAt),
    updatedAt: formatTimestamp(session.updatedAt),
  }
}

function chapterSnapshot(target: ChapterRow) {
  return {
    mangaId: target.mangaId,
    volumeId: target.volumeId,
    number: normalizeDecimal(target.number),
    title: target.title,
    language: target.language,
    isDefault: target.isDefault,
    publicationState: target.publicationState,
    version: target.version,
  }
}

type ReadyPage = PageRow & {
  height: number
  width: number
}

type StagedReadyPage = ReadyPage & {
  publishedOriginalKey: null
  sha256: string
  stagingKey: string
  storedByteSize: number
}

type FinalizeCommit = {
  chapterId: string
  expectedVersion: number
  pageIds: string[]
  chapterVersion: number
}

type FinalizeStart =
  | { kind: "replay"; committed: FinalizeCommit }
  | { kind: "queued" }
  | {
      kind: "claimed"
      mode: "initial" | "replacement"
      pages: ReadyPage[]
      token: string
      takeover: boolean
    }

function sameIds(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function committedFinalize(
  value: Record<string, unknown> | null
): FinalizeCommit | null {
  if (!value || typeof value.chapterId !== "string") return null
  const finalize = value.finalize
  if (!finalize || typeof finalize !== "object") return null
  const row = finalize as Record<string, unknown>
  if (
    typeof row.expectedVersion !== "number" ||
    !Number.isInteger(row.expectedVersion) ||
    !Array.isArray(row.pageIds) ||
    !row.pageIds.every((id) => typeof id === "string") ||
    typeof row.chapterVersion !== "number" ||
    !Number.isInteger(row.chapterVersion)
  )
    return null
  return {
    chapterId: value.chapterId,
    expectedVersion: row.expectedVersion,
    pageIds: row.pageIds,
    chapterVersion: row.chapterVersion,
  }
}

function finalPageKey(chapterId: string, position: number, pageId: string) {
  return `data/${chapterId}/${String(position + 1).padStart(3, "0")}-${pageId}.webp`
}

function validReadyPage(page: PageRow): page is ReadyPage {
  return (
    page.state === "ready" &&
    page.width !== null &&
    page.height !== null &&
    (page.publishedOriginalKey !== null ||
      (page.stagingKey !== null &&
        page.storedByteSize !== null &&
        page.sha256 !== null))
  )
}

function isStagedReadyPage(page: ReadyPage): page is StagedReadyPage {
  return (
    page.publishedOriginalKey === null &&
    page.stagingKey !== null &&
    page.storedByteSize !== null &&
    page.sha256 !== null
  )
}

async function prepareChapterFinalize(
  dependencies: Dependencies,
  actor: string,
  groupId: string,
  mangaId: string,
  chapterId: string,
  sessionId: string,
  input: ChapterFinalizeInput,
  acquireClaim: boolean
): Promise<FinalizeStart> {
  return dependencies.database.transaction(async (tx) => {
    const context = await lockContext(tx, actor, groupId, mangaId, chapterId)
    const [session] = await tx
      .select()
      .from(chapterUploadSession)
      .where(
        and(
          eq(chapterUploadSession.id, sessionId),
          eq(chapterUploadSession.chapterId, chapterId),
          eq(chapterUploadSession.mangaId, mangaId),
          eq(chapterUploadSession.groupId, groupId)
        )
      )
      .for("update")
    if (!session) groupFailure(404, "NOT_FOUND", "Upload session not found")

    requirePermission(context, session.mode === "initial" ? "add" : "edit")
    const committed = committedFinalize(session.committedResult)
    if (committed) {
      if (
        committed.chapterId !== chapterId ||
        committed.expectedVersion !== input.expectedVersion ||
        !sameIds(committed.pageIds, input.pageIds)
      )
        groupFailure(
          409,
          "FINALIZE_INPUT_MISMATCH",
          "Upload session was finalized with different input"
        )
      return { kind: "replay", committed }
    }

    if (!["open", "finalizing"].includes(session.state))
      groupFailure(
        409,
        "UPLOAD_SESSION_STATE",
        "Upload session cannot be finalized"
      )
    const now = dependencies.now?.() ?? new Date()
    if (session.state === "open" && !isAfter(session.expiresAt, now))
      groupFailure(409, "UPLOAD_SESSION_STATE", "Upload session is expired")
    if (
      acquireClaim &&
      session.state === "finalizing" &&
      session.finalizeClaimToken &&
      session.finalizeClaimExpiresAt &&
      isAfter(session.finalizeClaimExpiresAt, now)
    )
      groupFailure(409, "FINALIZE_BUSY", "Upload session is being finalized")
    requireMangaAvailable(context)
    const target = context.target!
    if (target.version !== input.expectedVersion) stale(target.version)
    if (session.expectedChapterVersion !== input.expectedVersion)
      groupFailure(
        409,
        "FINALIZE_INPUT_MISMATCH",
        "Upload session targets a different chapter version"
      )
    if (
      (session.mode === "initial" && target.publicationState !== "draft") ||
      (session.mode === "replacement" &&
        target.publicationState !== "published")
    )
      groupFailure(
        409,
        "UPLOAD_SESSION_STATE",
        "Upload mode no longer matches chapter state"
      )
    if (!sameIds(session.orderedPageIds, input.pageIds))
      groupFailure(
        409,
        "FINALIZE_MANIFEST_INVALID",
        "Finalize order does not match the upload session"
      )

    const rows = await tx
      .select()
      .from(chapterUploadPage)
      .where(eq(chapterUploadPage.sessionId, sessionId))
    const pagesById = new Map(rows.map((page) => [page.id, page]))
    const pages = input.pageIds.map((id) => pagesById.get(id))
    if (
      rows.length !== input.pageIds.length ||
      pages.some((page) => !page || !validReadyPage(page))
    )
      groupFailure(
        409,
        "FINALIZE_MANIFEST_INVALID",
        "Every uploaded page must be ready and ordered"
      )

    if (!acquireClaim) {
      if (session.state === "finalizing" && !session.finalizeError)
        return { kind: "queued" }
      await tx
        .update(chapterUploadSession)
        .set({
          state: "finalizing",
          finalizeClaimToken: null,
          finalizeClaimExpiresAt: null,
          finalizeError: null,
          updatedAt: now,
        })
        .where(eq(chapterUploadSession.id, sessionId))
      return { kind: "queued" }
    }
    if (session.state !== "finalizing" || session.finalizeError)
      groupFailure(
        409,
        "UPLOAD_SESSION_STATE",
        "Upload session is not queued for processing"
      )

    const token = randomUUID()
    const takeover = Boolean(session.finalizeClaimToken)
    await tx
      .update(chapterUploadSession)
      .set({
        state: "finalizing",
        finalizeClaimToken: token,
        finalizeClaimExpiresAt: addMinutes(now, CHAPTER_FINALIZE_CLAIM_MINUTES),
        finalizeError: null,
        updatedAt: now,
      })
      .where(eq(chapterUploadSession.id, sessionId))
    return {
      kind: "claimed",
      mode: session.mode,
      pages: pages as ReadyPage[],
      token,
      takeover,
    }
  })
}

async function renewFinalizeClaim(
  dependencies: Dependencies,
  sessionId: string,
  token: string
) {
  const now = dependencies.now?.() ?? new Date()
  const [renewed] = await dependencies.database
    .update(chapterUploadSession)
    .set({
      finalizeClaimExpiresAt: addMinutes(now, CHAPTER_FINALIZE_CLAIM_MINUTES),
      updatedAt: now,
    })
    .where(
      and(
        eq(chapterUploadSession.id, sessionId),
        eq(chapterUploadSession.state, "finalizing"),
        eq(chapterUploadSession.finalizeClaimToken, token),
        gt(chapterUploadSession.finalizeClaimExpiresAt, now)
      )
    )
    .returning({ id: chapterUploadSession.id })
  if (!renewed)
    groupFailure(409, "FINALIZE_BUSY", "Finalize claim is no longer owned")
}

async function recordFinalObjects(
  dependencies: Dependencies,
  sessionId: string,
  token: string,
  objectKeys: string[]
) {
  const now = dependencies.now?.() ?? new Date()
  await dependencies.database.transaction(async (tx) => {
    const [owned] = await tx
      .update(chapterUploadSession)
      .set({
        finalizeClaimExpiresAt: addMinutes(now, CHAPTER_FINALIZE_CLAIM_MINUTES),
        updatedAt: now,
      })
      .where(
        and(
          eq(chapterUploadSession.id, sessionId),
          eq(chapterUploadSession.state, "finalizing"),
          eq(chapterUploadSession.finalizeClaimToken, token),
          gt(chapterUploadSession.finalizeClaimExpiresAt, now)
        )
      )
      .returning({ id: chapterUploadSession.id })
    if (!owned)
      groupFailure(409, "FINALIZE_BUSY", "Finalize claim is no longer owned")
    await tx
      .insert(chapterUploadFinalObject)
      .values(objectKeys.map((objectKey) => ({ objectKey, sessionId })))
      .onConflictDoNothing()
  })
}

async function releaseFinalizeClaim(
  dependencies: Dependencies,
  chapterId: string,
  sessionId: string,
  token: string
) {
  try {
    await dependencies.database
      .update(chapterUploadSession)
      .set({
        finalizeClaimToken: null,
        finalizeClaimExpiresAt: null,
        updatedAt: dependencies.now?.() ?? new Date(),
      })
      .where(
        and(
          eq(chapterUploadSession.id, sessionId),
          eq(chapterUploadSession.state, "finalizing"),
          eq(chapterUploadSession.finalizeClaimToken, token)
        )
      )
  } catch (error) {
    dependencies.logger("error", "chapter.finalize.release_failed", {
      chapterId,
      sessionId,
      ...errorFields(error, true),
    })
  }
}

async function copyFinalPages(
  dependencies: Dependencies,
  chapterId: string,
  sessionId: string,
  token: string,
  pages: ReadyPage[]
) {
  const storage = dependencies.storage!
  const staged = pages.flatMap((page, position) =>
    isStagedReadyPage(page)
      ? [{ page, targetKey: finalPageKey(chapterId, position, page.id) }]
      : []
  )
  for (
    let offset = 0;
    offset < staged.length;
    offset += CHAPTER_FINALIZE_COPY_CONCURRENCY
  ) {
    const batch = staged.slice(
      offset,
      offset + CHAPTER_FINALIZE_COPY_CONCURRENCY
    )
    await recordFinalObjects(
      dependencies,
      sessionId,
      token,
      batch.map(({ targetKey }) => targetKey)
    )
    const copies = await Promise.allSettled(
      batch.map(async ({ page, targetKey }) => {
        const source = await storage.head(page.stagingKey)
        if (
          source.contentLength !== page.storedByteSize ||
          source.contentType !== "image/webp"
        )
          throw new Error(`Staging page verification failed: ${page.id}`)
        await storage.copyToPublic(
          page.stagingKey,
          targetKey,
          page.sha256,
          source.etag
        )
        const target = await storage.headPublic(targetKey)
        if (
          target.contentLength !== page.storedByteSize ||
          target.contentType !== "image/webp" ||
          target.cacheControl !== CHAPTER_PUBLIC_CACHE_CONTROL ||
          target.metadata?.sha256 !== page.sha256
        )
          throw new Error(`Public page verification failed: ${page.id}`)
      })
    )
    const failed = copies.find(
      (copy): copy is PromiseRejectedResult => copy.status === "rejected"
    )
    if (failed) throw failed.reason
    await renewFinalizeClaim(dependencies, sessionId, token)
  }
}

async function commitChapterFinalize(
  dependencies: Dependencies,
  actor: string,
  groupId: string,
  mangaId: string,
  chapterId: string,
  sessionId: string,
  input: ChapterFinalizeInput,
  claim: Extract<FinalizeStart, { kind: "claimed" }>
) {
  await dependencies.database.transaction(async (tx) => {
    const context = await lockContext(tx, actor, groupId, mangaId, chapterId)
    requirePermission(context, claim.mode === "initial" ? "add" : "edit")
    requireMangaAvailable(context)
    const target = context.target!
    if (target.version !== input.expectedVersion) stale(target.version)
    if (
      (claim.mode === "initial" && target.publicationState !== "draft") ||
      (claim.mode === "replacement" && target.publicationState !== "published")
    )
      groupFailure(
        409,
        "UPLOAD_SESSION_STATE",
        "Upload mode no longer matches chapter state"
      )

    const now = dependencies.now?.() ?? new Date()
    const [session] = await tx
      .select()
      .from(chapterUploadSession)
      .where(
        and(
          eq(chapterUploadSession.id, sessionId),
          eq(chapterUploadSession.chapterId, chapterId),
          eq(chapterUploadSession.mangaId, mangaId),
          eq(chapterUploadSession.groupId, groupId)
        )
      )
      .for("update")
    if (!session) groupFailure(404, "NOT_FOUND", "Upload session not found")
    if (
      session.state !== "finalizing" ||
      session.finalizeClaimToken !== claim.token ||
      !session.finalizeClaimExpiresAt ||
      !isAfter(session.finalizeClaimExpiresAt, now)
    )
      groupFailure(409, "FINALIZE_BUSY", "Finalize claim is no longer owned")
    if (
      session.expectedChapterVersion !== input.expectedVersion ||
      !sameIds(session.orderedPageIds, input.pageIds)
    )
      groupFailure(
        409,
        "FINALIZE_INPUT_MISMATCH",
        "Upload session finalize input changed"
      )

    await tx.delete(chapterPage).where(eq(chapterPage.chapterId, chapterId))
    await tx.insert(chapterPage).values(
      claim.pages.map((page, position) => ({
        chapterId,
        position,
        originalKey:
          page.publishedOriginalKey ??
          finalPageKey(chapterId, position, page.id),
        optimizedKey: page.publishedOptimizedKey,
        width: page.width,
        height: page.height,
        optimizedWidth: page.publishedOptimizedWidth,
        optimizedHeight: page.publishedOptimizedHeight,
      }))
    )
    const chapterVersion = input.expectedVersion + 1
    const pagesVersion = target.pagesVersion + 1
    const publishedAt = target.publishedAt ?? now
    const [updated] = await tx
      .update(chapter)
      .set({
        publicationState: "published",
        ...(claim.mode === "initial" ? { uploaderUserId: actor } : {}),
        pageCount: claim.pages.length,
        availablePageCount: claim.pages.length,
        isFull: true,
        publishedAt,
        updatedAt: now,
        version: chapterVersion,
        pagesVersion,
      })
      .where(
        and(
          eq(chapter.id, chapterId),
          eq(chapter.version, input.expectedVersion)
        )
      )
      .returning({ id: chapter.id })
    if (!updated) stale(target.version)

    if (claim.mode === "initial")
      await fanOutChapterNotification(
        tx,
        { chapterId, mangaId, publishedAt, sessionId },
        dependencies,
        dependencies.logger
      )

    await recomputeMangaProjection(tx, mangaId, now)
    await audit(
      tx,
      actor,
      claim.mode === "initial" ? "chapter.published" : "chapter.pages_replaced",
      "chapter",
      chapterId,
      claim.mode === "initial" ? "chapter published" : "chapter pages replaced",
      {
        ...chapterSnapshot(target),
        pageCount: target.pageCount,
        availablePageCount: target.availablePageCount,
        isFull: target.isFull,
      },
      {
        ...chapterSnapshot({
          ...target,
          publicationState: "published",
          version: chapterVersion,
        }),
        pageCount: claim.pages.length,
        availablePageCount: claim.pages.length,
        isFull: true,
        publishedAt: formatTimestamp(publishedAt),
        sessionId,
      },
      now
    )
    const committedResult = {
      ...(session.committedResult ?? {}),
      chapterId,
      finalize: {
        expectedVersion: input.expectedVersion,
        pageIds: input.pageIds,
        chapterVersion,
        pagesVersion,
      },
    }
    const [completed] = await tx
      .update(chapterUploadSession)
      .set({
        state: "completed",
        finalizeClaimToken: null,
        finalizeClaimExpiresAt: null,
        committedResult,
        finalizedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(chapterUploadSession.id, sessionId),
          eq(chapterUploadSession.state, "finalizing"),
          eq(chapterUploadSession.finalizeClaimToken, claim.token)
        )
      )
      .returning({ id: chapterUploadSession.id })
    if (!completed)
      groupFailure(409, "FINALIZE_BUSY", "Finalize claim is no longer owned")
  })
}

async function finalizeChapterUpload(
  dependencies: Dependencies,
  actor: string,
  groupId: string,
  mangaId: string,
  chapterId: string,
  sessionId: string,
  input: ChapterFinalizeInput
) {
  const claim = await prepareChapterFinalize(
    dependencies,
    actor,
    groupId,
    mangaId,
    chapterId,
    sessionId,
    input,
    true
  )
  if (claim.kind === "queued")
    throw new Error("Queued finalize was not claimed")
  if (claim.kind === "replay") {
    dependencies.logger("info", "chapter.finalize.replayed", {
      chapterId,
      groupId,
      mangaId,
      sessionId,
    })
    return
  }
  if (!dependencies.storage) {
    await releaseFinalizeClaim(dependencies, chapterId, sessionId, claim.token)
    groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
  }
  dependencies.logger(
    "info",
    claim.takeover
      ? "chapter.finalize.claim_taken_over"
      : "chapter.finalize.claimed",
    { chapterId, groupId, mangaId, pageCount: claim.pages.length, sessionId }
  )
  try {
    try {
      await copyFinalPages(
        dependencies,
        chapterId,
        sessionId,
        claim.token,
        claim.pages
      )
    } catch (error) {
      if (error instanceof GroupError) throw error
      dependencies.logger("error", "chapter.finalize.copy_failed", {
        chapterId,
        groupId,
        mangaId,
        sessionId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    }
    await commitChapterFinalize(
      dependencies,
      actor,
      groupId,
      mangaId,
      chapterId,
      sessionId,
      input,
      claim
    )
  } catch (error) {
    await releaseFinalizeClaim(dependencies, chapterId, sessionId, claim.token)
    throw error
  }
  dependencies.logger("info", "chapter.finalize.committed", {
    chapterId,
    groupId,
    mangaId,
    pageCount: claim.pages.length,
    sessionId,
  })
}

async function markChapterFinalizeFailed(
  dependencies: Dependencies,
  sessionId: string,
  error: unknown
) {
  const now = dependencies.now?.() ?? new Date()
  const reason =
    error instanceof GroupError
      ? error.message
      : "Không thể xử lý ảnh chương. Hãy thử lại."
  const [failed] = await dependencies.database
    .update(chapterUploadSession)
    .set({
      state: "open",
      finalizeClaimToken: null,
      finalizeClaimExpiresAt: null,
      finalizeError: reason.slice(0, 500),
      expiresAt: addHours(now, 3),
      updatedAt: now,
    })
    .where(
      and(
        eq(chapterUploadSession.id, sessionId),
        eq(chapterUploadSession.state, "finalizing"),
        or(
          isNull(chapterUploadSession.finalizeClaimToken),
          isNull(chapterUploadSession.finalizeClaimExpiresAt),
          lte(chapterUploadSession.finalizeClaimExpiresAt, now)
        )
      )
    )
    .returning({ id: chapterUploadSession.id })
  return Boolean(failed)
}

export async function processChapterFinalizeJobs(
  dependencies: Dependencies,
  options: { limit?: number } = {}
) {
  const now = dependencies.now?.() ?? new Date()
  const jobs = await dependencies.database
    .select({
      actor: chapterUploadSession.actorUserId,
      chapterId: chapterUploadSession.chapterId,
      expectedVersion: chapterUploadSession.expectedChapterVersion,
      groupId: chapterUploadSession.groupId,
      mangaId: chapterUploadSession.mangaId,
      pageIds: chapterUploadSession.orderedPageIds,
      sessionId: chapterUploadSession.id,
    })
    .from(chapterUploadSession)
    .where(
      and(
        eq(chapterUploadSession.state, "finalizing"),
        isNull(chapterUploadSession.finalizeError),
        or(
          isNull(chapterUploadSession.finalizeClaimToken),
          isNull(chapterUploadSession.finalizeClaimExpiresAt),
          lte(chapterUploadSession.finalizeClaimExpiresAt, now)
        )
      )
    )
    .orderBy(asc(chapterUploadSession.updatedAt), asc(chapterUploadSession.id))
    .limit(options.limit ?? 3)

  let processed = 0
  let failed = 0
  for (const job of jobs) {
    try {
      if (!job.actor || !job.chapterId || !job.expectedVersion)
        throw new Error("Finalize job context is incomplete")
      await finalizeChapterUpload(
        dependencies,
        job.actor,
        job.groupId,
        job.mangaId,
        job.chapterId,
        job.sessionId,
        { expectedVersion: job.expectedVersion, pageIds: job.pageIds }
      )
      processed += 1
      try {
        const invalidated = await dependencies.cache.invalidateCatalog()
        if (!invalidated && dependencies.cache.status !== "disabled")
          dependencies.logger("warn", "chapter.finalize.cache_failed", {
            chapterId: job.chapterId,
            mangaId: job.mangaId,
            sessionId: job.sessionId,
          })
      } catch (error) {
        dependencies.logger("warn", "chapter.finalize.cache_failed", {
          chapterId: job.chapterId,
          mangaId: job.mangaId,
          sessionId: job.sessionId,
          ...errorFields(error, true),
        })
      }
    } catch (error) {
      if (error instanceof GroupError && error.code === "FINALIZE_BUSY")
        continue
      if (await markChapterFinalizeFailed(dependencies, job.sessionId, error)) {
        failed += 1
        dependencies.logger("error", "chapter.finalize.job_failed", {
          chapterId: job.chapterId,
          mangaId: job.mangaId,
          sessionId: job.sessionId,
          ...errorFields(error, true),
        })
      }
    }
  }
  return { selected: jobs.length, processed, failed }
}

export function startChapterFinalizeWorker(
  dependencies: Dependencies,
  intervalMs = 1_000
) {
  let running: Promise<void> | undefined
  const tick = () => {
    if (running) return
    running = processChapterFinalizeJobs(dependencies)
      .then(() => undefined)
      .catch((error) => {
        dependencies.logger("error", "chapter.finalize.worker_failed", {
          ...errorFields(error, true),
        })
      })
      .finally(() => {
        running = undefined
      })
  }
  const timer = setInterval(tick, intervalMs)
  timer.unref()
  tick()
  return async () => {
    clearInterval(timer)
    await running
  }
}

async function lockSession(
  tx: GroupTransaction,
  context: ChapterContext,
  groupId: string,
  chapterId: string,
  sessionId: string,
  now: Date,
  requireOpen = true
) {
  requireMangaAvailable(context)
  const [session] = await tx
    .select()
    .from(chapterUploadSession)
    .where(
      and(
        eq(chapterUploadSession.id, sessionId),
        eq(chapterUploadSession.chapterId, chapterId),
        eq(chapterUploadSession.mangaId, context.manga.id),
        eq(chapterUploadSession.groupId, groupId)
      )
    )
    .for("update")
  if (!session) groupFailure(404, "NOT_FOUND", "Upload session not found")
  requirePermission(context, session.mode === "initial" ? "add" : "edit")
  if (!context.target) throw new Error("Chapter context is missing")
  if (
    context.target.version !== session.expectedChapterVersion &&
    !session.finalizeError
  )
    stale(context.target.version)
  if (
    (session.mode === "initial" &&
      context.target.publicationState !== "draft") ||
    (session.mode === "replacement" &&
      context.target.publicationState !== "published")
  )
    groupFailure(
      409,
      "UPLOAD_SESSION_STATE",
      "Upload mode no longer matches chapter state"
    )
  if (
    requireOpen &&
    (session.state !== "open" || session.expiresAt.getTime() <= now.getTime())
  )
    groupFailure(409, "UPLOAD_SESSION_STATE", "Upload session is not open")
  return session
}

async function lockStagingSession(
  tx: GroupTransaction,
  actor: string,
  groupId: string,
  mangaId: string,
  sessionId: string,
  now: Date,
  requireOpen = true
) {
  const context = await lockContext(tx, actor, groupId, mangaId)
  requirePermission(context, "add")
  requireMangaAvailable(context)
  const [session] = await tx
    .select()
    .from(chapterUploadSession)
    .where(
      and(
        eq(chapterUploadSession.id, sessionId),
        isNull(chapterUploadSession.chapterId),
        eq(chapterUploadSession.mangaId, mangaId),
        eq(chapterUploadSession.groupId, groupId),
        eq(chapterUploadSession.actorUserId, actor),
        eq(chapterUploadSession.mode, "initial")
      )
    )
    .for("update")
  if (!session) groupFailure(404, "NOT_FOUND", "Upload session not found")
  if (
    requireOpen &&
    (session.state !== "open" || session.expiresAt.getTime() <= now.getTime())
  )
    groupFailure(409, "UPLOAD_SESSION_STATE", "Upload session is not open")
  return session
}

type UploadTarget = {
  actor: string
  chapterId: string | null
  groupId: string
  mangaId: string
  sessionId: string
}

async function lockUploadTarget(
  tx: GroupTransaction,
  target: UploadTarget,
  now: Date,
  requireOpen = true
) {
  if (!target.chapterId)
    return lockStagingSession(
      tx,
      target.actor,
      target.groupId,
      target.mangaId,
      target.sessionId,
      now,
      requireOpen
    )
  const context = await lockContext(
    tx,
    target.actor,
    target.groupId,
    target.mangaId,
    target.chapterId
  )
  return lockSession(
    tx,
    context,
    target.groupId,
    target.chapterId,
    target.sessionId,
    now,
    requireOpen
  )
}

async function assertPageQuota(
  tx: GroupTransaction,
  sessionId: string,
  sourceBytes: number
) {
  const [{ pages, bytes }] = await tx
    .select({
      pages: count(),
      bytes: sql<number>`coalesce(sum(${chapterUploadPage.sourceByteSize}), 0)::int`,
    })
    .from(chapterUploadPage)
    .where(
      and(
        eq(chapterUploadPage.sessionId, sessionId),
        ne(chapterUploadPage.state, "deleting")
      )
    )
  if (pages >= CHAPTER_MAX_PAGES)
    groupFailure(413, "PAGE_TOO_LARGE", "Chapter page limit exceeded")
  if (bytes + sourceBytes > CHAPTER_SESSION_MAX_SOURCE_BYTES)
    groupFailure(413, "PAGE_TOO_LARGE", "Chapter upload size limit exceeded")
}

async function uploadSessionPage(
  dependencies: Dependencies,
  target: UploadTarget,
  file: File,
  pageId: string,
  requestUrl: string,
  trace: ChapterPageUploadTrace
) {
  trace.annotate({ pageId, sourceBytes: file.size })
  trace.stage("authorize")
  const storage = dependencies.storage
  if (!storage)
    groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
  if (file.size > CHAPTER_PAGE_MAX_INPUT_BYTES)
    groupFailure(413, "PAGE_TOO_LARGE", "Page must not exceed 12 MiB")

  const requestedAt = dependencies.now?.() ?? new Date()
  await dependencies.database.transaction(async (tx) => {
    await lockUploadTarget(tx, target, requestedAt)
    const [existing] = await tx
      .select({ id: chapterUploadPage.id })
      .from(chapterUploadPage)
      .where(eq(chapterUploadPage.id, pageId))
    if (!existing) await assertPageQuota(tx, target.sessionId, file.size)
  })

  let image: Awaited<ReturnType<typeof transformChapterPage>>
  trace.stage("transform")
  try {
    image = await transformChapterPage(new Uint8Array(await file.arrayBuffer()))
  } catch (error) {
    if (error instanceof ChapterImageBusyError)
      groupFailure(429, "UPLOAD_BUSY", error.message)
    if (error instanceof ChapterImageError)
      groupFailure(400, "INVALID_PAGE", error.message)
    throw error
  }
  const sha256 = createHash("sha256").update(image.data).digest("hex")
  trace.annotate({
    storedBytes: image.data.byteLength,
    width: image.width,
    height: image.height,
  })
  const stagingKey = `chapters/staging/${target.sessionId}/${pageId}.webp`
  trace.stage("ledger")
  const ledger = await dependencies.database.transaction(async (tx) => {
    const now = dependencies.now?.() ?? new Date()
    const session = await lockUploadTarget(tx, target, now)
    const [existing] = await tx
      .select()
      .from(chapterUploadPage)
      .where(eq(chapterUploadPage.id, pageId))
      .for("update")
    if (existing) {
      if (existing.sessionId !== target.sessionId || existing.sha256 !== sha256)
        groupFailure(
          409,
          "PAGE_ID_CONFLICT",
          "Page ID is already used for different bytes"
        )
      if (existing.state === "deleting")
        groupFailure(409, "UPLOAD_SESSION_STATE", "Page is being deleted")
      return {
        expiresAt: session.expiresAt,
        row: existing,
        ready: existing.state === "ready",
      }
    }
    await assertPageQuota(tx, target.sessionId, file.size)
    const [created] = await tx
      .insert(chapterUploadPage)
      .values({
        id: pageId,
        sessionId: target.sessionId,
        stagingKey,
        width: image.width,
        height: image.height,
        sourceByteSize: file.size,
        storedByteSize: image.data.byteLength,
        sha256,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!created) throw new Error("Upload page was not created")
    return { expiresAt: session.expiresAt, row: created, ready: false }
  })
  trace.annotate({ replayed: ledger.ready })
  if (ledger.ready) {
    trace.stage("preview")
    return pageDto(dependencies, ledger.row, requestUrl)
  }

  try {
    trace.stage("storage_put")
    await storage.put(stagingKey, image.data)
    trace.stage("storage_head")
    const stored = await storage.head(stagingKey)
    if (
      stored.contentLength !== image.data.byteLength ||
      stored.contentType !== "image/webp"
    )
      throw new Error("Stored page verification failed")
  } catch (error) {
    dependencies.logger("error", "chapter.storage_failed", {
      chapterId: target.chapterId,
      mangaId: target.mangaId,
      sessionId: target.sessionId,
      pageId,
      ...errorFields(error, true),
    })
    groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
  }

  trace.stage("ready")
  const ready = await dependencies.database.transaction(async (tx) => {
    const now = dependencies.now?.() ?? new Date()
    const session = await lockUploadTarget(tx, target, now)
    const [updated] = await tx
      .update(chapterUploadPage)
      .set({ state: "ready", updatedAt: now })
      .where(
        and(
          eq(chapterUploadPage.id, pageId),
          eq(chapterUploadPage.sessionId, target.sessionId),
          eq(chapterUploadPage.state, "uploading"),
          eq(chapterUploadPage.sha256, sha256)
        )
      )
      .returning()
    if (!updated)
      groupFailure(409, "UPLOAD_SESSION_STATE", "Upload page changed")
    return { expiresAt: session.expiresAt, row: updated }
  })
  trace.stage("preview")
  return pageDto(dependencies, ready.row, requestUrl)
}

async function deleteSessionPage(
  dependencies: Dependencies,
  target: UploadTarget,
  pageId: string
) {
  const storage = dependencies.storage
  if (!storage)
    groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
  const object = await dependencies.database.transaction(async (tx) => {
    const now = dependencies.now?.() ?? new Date()
    const session = await lockUploadTarget(tx, target, now)
    const [page] = await tx
      .select()
      .from(chapterUploadPage)
      .where(
        and(
          eq(chapterUploadPage.id, pageId),
          eq(chapterUploadPage.sessionId, target.sessionId)
        )
      )
      .for("update")
    if (!page) groupFailure(404, "NOT_FOUND", "Upload page not found")
    await tx
      .update(chapterUploadPage)
      .set({ state: "deleting", updatedAt: now })
      .where(eq(chapterUploadPage.id, pageId))
    await tx
      .update(chapterUploadSession)
      .set({
        orderedPageIds: session.orderedPageIds.filter((id) => id !== pageId),
        updatedAt: now,
      })
      .where(eq(chapterUploadSession.id, target.sessionId))
    return page.stagingKey
  })
  if (object) {
    try {
      await storage.delete(object)
    } catch (error) {
      dependencies.logger("error", "chapter.storage_delete_failed", {
        chapterId: target.chapterId,
        mangaId: target.mangaId,
        sessionId: target.sessionId,
        pageId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    }
  }
  await dependencies.database
    .delete(chapterUploadPage)
    .where(
      and(
        eq(chapterUploadPage.id, pageId),
        eq(chapterUploadPage.sessionId, target.sessionId),
        eq(chapterUploadPage.state, "deleting")
      )
    )
}

async function orderSessionPages(
  dependencies: Dependencies,
  target: UploadTarget,
  pageIds: string[]
) {
  await dependencies.database.transaction(async (tx) => {
    const now = dependencies.now?.() ?? new Date()
    await lockUploadTarget(tx, target, now)
    const ready = pageIds.length
      ? await tx
          .select({ id: chapterUploadPage.id })
          .from(chapterUploadPage)
          .where(
            and(
              eq(chapterUploadPage.sessionId, target.sessionId),
              eq(chapterUploadPage.state, "ready"),
              inArray(chapterUploadPage.id, pageIds)
            )
          )
      : []
    if (ready.length !== pageIds.length)
      groupFailure(
        409,
        "UPLOAD_SESSION_STATE",
        "Order contains a page that is not ready"
      )
    await tx
      .update(chapterUploadSession)
      .set({ orderedPageIds: pageIds, updatedAt: now })
      .where(eq(chapterUploadSession.id, target.sessionId))
  })
}

async function cancelUploadSession(
  dependencies: Dependencies,
  target: UploadTarget
) {
  await dependencies.database.transaction(async (tx) => {
    const now = dependencies.now?.() ?? new Date()
    const session = await lockUploadTarget(tx, target, now, false)
    if (["cancelled", "cleaning", "cleaned"].includes(session.state)) return
    if (session.state !== "open")
      groupFailure(
        409,
        "UPLOAD_SESSION_STATE",
        "Upload session cannot be cancelled"
      )
    await tx
      .update(chapterUploadSession)
      .set({ state: "cancelled", updatedAt: now })
      .where(eq(chapterUploadSession.id, target.sessionId))
    await audit(
      tx,
      target.actor,
      target.chapterId
        ? "chapter.upload_cancelled"
        : "chapter.upload_draft_cancelled",
      target.chapterId ? "chapter" : "manga",
      target.chapterId ?? target.mangaId,
      "chapter upload cancelled",
      { sessionId: target.sessionId, state: session.state },
      { sessionId: target.sessionId, state: "cancelled" },
      now
    )
  })
}

export async function recomputeMangaProjection(
  tx: GroupTransaction,
  mangaId: string,
  now: Date
) {
  const conditions = and(
    eq(chapter.mangaId, mangaId),
    eq(chapter.publicationState, "published"),
    isNull(chapter.moderationHiddenAt),
    isNull(chapter.deletedAt),
    isNotNull(chapter.publishedAt),
    eq(chapter.isFull, true),
    gt(chapter.availablePageCount, 0)
  )
  const [[projection], languages] = await Promise.all([
    tx
      .select({
        count: count(),
        latest: max(chapter.publishedAt),
      })
      .from(chapter)
      .where(conditions),
    tx
      .selectDistinct({ language: chapter.language })
      .from(chapter)
      .where(conditions),
  ])
  await tx.delete(mangaLanguage).where(eq(mangaLanguage.mangaId, mangaId))
  if (languages.length)
    await tx
      .insert(mangaLanguage)
      .values(languages.map(({ language }) => ({ mangaId, language })))
  await tx
    .update(manga)
    .set({
      hasUsableChapters: (projection?.count ?? 0) > 0,
      latestChapterPublishedAt: projection?.latest ?? null,
      updatedAt: now,
      version: sql`${manga.version} + 1`,
    })
    .where(eq(manga.id, mangaId))
}

function isUniqueViolation(error: unknown, constraint: string) {
  const cause =
    typeof error === "object" && error && "cause" in error ? error.cause : error
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  )
}

export function registerChapterRoutes(
  app: OpenAPIHono,
  dependencies: Dependencies
) {
  const { database, cache } = dependencies
  for (const path of pageUploadPaths) {
    app.use(path, async (c, next) => {
      if (c.req.method !== "POST") return next()
      const id = (name: string) => {
        const result = IdSchema.safeParse(c.req.param(name))
        return result.success ? result.data : null
      }
      const trace = chapterPageUploadTrace(dependencies.logger, {
        requestId: c.get("requestId"),
        actorUserId: c.get("accountUserId"),
        groupId: id("groupId"),
        mangaId: id("mangaId"),
        chapterId: id("chapterId"),
        sessionId: id("sessionId"),
      })
      c.set("chapterPageUploadTrace", trace)
      await next()
      trace.finish(c.res.status, c.error)
    })
    app.use(path, async (c, next) => {
      if (!dependencies.storage)
        return c.json(
          apiError(
            "STORAGE_UNAVAILABLE",
            "Chapter storage is unavailable",
            c.get("requestId")
          ),
          503
        )
      await next()
    })
    app.use(
      path,
      bodyLimit({
        maxSize: CHAPTER_PAGE_MULTIPART_MAX_BYTES,
        onError: (c) =>
          c.json(
            apiError(
              "PAGE_TOO_LARGE",
              "Page requests must not exceed 12 MiB",
              c.get("requestId")
            ),
            413
          ),
      })
    )
  }

  app.openapi(routes.previewChapterUploadPageRoute, async (c) => {
    const storage = dependencies.storage
    if (!storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    const { file } = c.req.valid("param")
    const pageId = file.slice(0, -".webp".length)
    const now = dependencies.now?.() ?? new Date()
    const [page] = await database
      .select({
        expiresAt: chapterUploadSession.expiresAt,
        key: chapterUploadPage.stagingKey,
        state: chapterUploadPage.state,
      })
      .from(chapterUploadPage)
      .innerJoin(
        chapterUploadSession,
        eq(chapterUploadSession.id, chapterUploadPage.sessionId)
      )
      .where(eq(chapterUploadPage.id, pageId))
      .limit(1)
    if (!page || page.state !== "ready" || !page.key || page.expiresAt <= now)
      groupFailure(404, "NOT_FOUND", "Chapter page preview not found")

    try {
      const source = await fetch(
        await storage.previewUrl(page.key, PRIVATE_PREVIEW_FETCH_SECONDS),
        { signal: AbortSignal.timeout(30_000) }
      )
      if (!source.ok || !source.body)
        throw new Error(`Chapter page preview returned ${source.status}`)
      return new Response(source.body, {
        headers: {
          "Cache-Control": "public, max-age=300",
          "Content-Type": "image/webp",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch (error) {
      dependencies.logger("error", "chapter.staging_preview_failed", {
        pageId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    }
  })

  app.openapi(routes.listChaptersRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const { direction, page, limit, publicationState, sort } =
      c.req.valid("query")
    await database.transaction((tx) =>
      authorizeRead(tx, actor, groupId, mangaId)
    )
    const where = and(
      eq(chapterGroup.groupId, groupId),
      eq(chapter.mangaId, mangaId),
      isNull(chapter.deletedAt),

      publicationState
        ? eq(chapter.publicationState, publicationState)
        : inArray(chapter.publicationState, ["draft", "published"])
    )
    const orderBy =
      sort === "volume"
        ? [
            direction === "asc"
              ? sql`${mangaVolume.number} asc nulls last`
              : sql`${mangaVolume.number} desc nulls last`,
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
    const [rows, [{ total }]] = await Promise.all([
      database
        .select(summaryColumns)
        .from(chapterGroup)
        .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
        .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      database
        .select({ total: count() })
        .from(chapterGroup)
        .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
        .where(where),
    ])
    const reasons = await latestModerationReasons(
      database,
      "chapter",
      rows.filter((row) => row.moderationHiddenAt).map((row) => row.id)
    )
    return c.json(
      {
        data: rows.map((row) =>
          mapSummary(row, reasons.get(row.id) ?? null, groupId)
        ),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      200
    )
  })

  app.openapi(routes.createChapterRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const input = c.req.valid("json")
    let chapterId: string
    try {
      chapterId = await database.transaction(async (tx) => {
        const context = await lockContext(tx, actor, groupId, mangaId)
        requirePermission(context, "add")
        requireMangaAvailable(context)
        const now = dependencies.now?.() ?? new Date()
        return insertChapterDraft(
          tx,
          actor,
          groupId,
          mangaId,
          input,
          now,
          context.manga.numberingMode
        )
      })
    } catch (error) {
      if (isUniqueViolation(error, "chapter_default_slot_uidx"))
        groupFailure(
          409,
          "DEFAULT_CHAPTER_CONFLICT",
          "A default release already exists at this position"
        )
      throw error
    }
    await cache.invalidateCatalog()
    return c.json(
      {
        data: await chapterManagementDetail(
          database,
          groupId,
          mangaId,
          chapterId,
          dependencies.now?.()
        ),
      },
      201
    )
  })

  app.openapi(routes.getChapterRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId } = c.req.valid("param")
    await database.transaction((tx) =>
      authorizeRead(tx, actor, groupId, mangaId)
    )
    return c.json(
      {
        data: await chapterManagementDetail(
          database,
          groupId,
          mangaId,
          chapterId,
          dependencies.now?.()
        ),
      },
      200
    )
  })

  app.openapi(routes.updateChapterRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId } = c.req.valid("param")
    const { expectedVersion, uploadSessionId, ...input } = c.req.valid("json")
    try {
      await database.transaction(async (tx) => {
        const context = await lockContext(
          tx,
          actor,
          groupId,
          mangaId,
          chapterId
        )
        requirePermission(context, "edit")
        const target = context.target!
        if (target.version !== expectedVersion) stale(target.version)
        const now = dependencies.now?.() ?? new Date()
        if (uploadSessionId)
          await lockSession(
            tx,
            context,
            groupId,
            chapterId,
            uploadSessionId,
            now
          )
        const volume = await resolveVolume(
          tx,
          mangaId,
          groupId,
          input.volumeNumber,
          actor,
          now
        )
        const samePosition =
          normalizeDecimal(target.number) === input.number &&
          target.language === input.language &&
          (context.manga.numberingMode === "global" ||
            target.volumeId === (volume?.id ?? null))
        const isDefault =
          target.isDefault &&
          (samePosition ||
            (await defaultPositionAvailable(
              tx,
              mangaId,
              input,
              volume?.id ?? null,
              context.manga.numberingMode,
              chapterId
            )))
        await tx
          .update(chapter)
          .set({
            volumeId: volume?.id ?? null,
            isDefault,
            number: input.number,
            title: input.title,
            language: input.language,
            updatedAt: now,
            version: sql`${chapter.version} + 1`,
          })
          .where(
            and(eq(chapter.id, chapterId), eq(chapter.version, expectedVersion))
          )
        if (uploadSessionId)
          await tx
            .update(chapterUploadSession)
            .set({
              expectedChapterVersion: expectedVersion + 1,
              updatedAt: now,
            })
            .where(eq(chapterUploadSession.id, uploadSessionId))
        if (target.publicationState === "published")
          await recomputeMangaProjection(tx, mangaId, now)
        await audit(
          tx,
          actor,
          "chapter.updated",
          "chapter",
          chapterId,
          "chapter updated",
          chapterSnapshot(target),
          {
            mangaId,
            volumeId: volume?.id ?? null,
            number: input.number,
            title: input.title,
            language: input.language,
            publicationState: target.publicationState,
            isDefault,
            version: expectedVersion + 1,
          },
          now
        )
      })
    } catch (error) {
      if (isUniqueViolation(error, "chapter_default_slot_uidx"))
        groupFailure(
          409,
          "DEFAULT_CHAPTER_CONFLICT",
          "A default release already exists at this position"
        )
      throw error
    }
    await cache.invalidateCatalog()
    return c.json(
      {
        data: await chapterManagementDetail(
          database,
          groupId,
          mangaId,
          chapterId,
          dependencies.now?.()
        ),
      },
      200
    )
  })

  app.openapi(routes.deleteChapterRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    await database.transaction(async (tx) => {
      const context = await lockContext(tx, actor, groupId, mangaId, chapterId)
      requirePermission(context, "delete")
      const target = context.target!
      if (target.version !== expectedVersion) stale(target.version)
      const now = dependencies.now?.() ?? new Date()
      await tx
        .update(chapter)
        .set({
          deletedAt: now,
          deletedByUserId: actor,
          deleteReason: null,
          updatedAt: now,
          version: sql`${chapter.version} + 1`,
        })
        .where(
          and(eq(chapter.id, chapterId), eq(chapter.version, expectedVersion))
        )
      await tx
        .update(chapterUploadSession)
        .set({ state: "cancelled", updatedAt: now })
        .where(
          and(
            eq(chapterUploadSession.chapterId, chapterId),
            inArray(chapterUploadSession.state, ["open", "finalizing"])
          )
        )
      if (target.publicationState === "published")
        await recomputeMangaProjection(tx, mangaId, now)
      await audit(
        tx,
        actor,
        "chapter.deleted",
        "chapter",
        chapterId,
        "Chapter deleted",
        chapterSnapshot(target),
        { deletedAt: formatTimestamp(now), version: expectedVersion + 1 },
        now
      )
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })

  app.openapi(routes.createChapterUploadRoute, async (c) => {
    if (!dependencies.storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId } = c.req.valid("param")
    const { mode, expectedVersion } = c.req.valid("json")
    const sessionId = await database.transaction(async (tx) => {
      const context = await lockContext(tx, actor, groupId, mangaId, chapterId)
      requirePermission(context, mode === "initial" ? "add" : "edit")
      requireMangaAvailable(context)
      const target = context.target!
      if (target.version !== expectedVersion) stale(target.version)
      if (
        (mode === "initial" && target.publicationState !== "draft") ||
        (mode === "replacement" && target.publicationState !== "published")
      )
        groupFailure(
          409,
          "UPLOAD_SESSION_STATE",
          "Upload mode does not match chapter state"
        )
      const now = dependencies.now?.() ?? new Date()
      const [active] = await tx
        .select()
        .from(chapterUploadSession)
        .where(
          and(
            eq(chapterUploadSession.chapterId, chapterId),
            inArray(chapterUploadSession.state, ["open", "finalizing"])
          )
        )
        .for("update")
      if (active) {
        const liveFinalize =
          active.state === "finalizing" &&
          active.finalizeClaimExpiresAt &&
          isAfter(active.finalizeClaimExpiresAt, now)
        if (
          !liveFinalize &&
          (!isAfter(active.expiresAt, now) ||
            active.expectedChapterVersion !== target.version)
        )
          await tx
            .update(chapterUploadSession)
            .set({ state: "cancelled", updatedAt: now })
            .where(eq(chapterUploadSession.id, active.id))
        else if (active.mode === mode) return active.id
        else
          groupFailure(
            409,
            "UPLOAD_SESSION_STATE",
            "Another upload session is already active"
          )
      }
      const [{ total }] = await tx
        .select({ total: count() })
        .from(chapterUploadSession)
        .where(
          and(
            eq(chapterUploadSession.actorUserId, actor),
            inArray(chapterUploadSession.state, ["open", "finalizing"]),
            gt(chapterUploadSession.expiresAt, now)
          )
        )
      if (total >= CHAPTER_ACTOR_MAX_ACTIVE_SESSIONS)
        groupFailure(429, "UPLOAD_BUSY", "Too many active upload sessions")
      const [created] = await tx
        .insert(chapterUploadSession)
        .values({
          chapterId,
          mangaId,
          actorUserId: actor,
          groupId,
          mode,
          expectedChapterVersion: expectedVersion,
          expiresAt: addHours(now, 3),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: chapterUploadSession.id })
      if (!created) throw new Error("Upload session was not created")
      if (mode === "replacement") {
        const currentPages = await tx
          .select()
          .from(chapterPage)
          .where(eq(chapterPage.chapterId, chapterId))
          .orderBy(asc(chapterPage.position))
        const seededPages = currentPages.map((page) => ({
          id: randomUUID(),
          sessionId: created.id,
          state: "ready" as const,
          stagingKey: null,
          publishedOriginalKey: page.originalKey,
          publishedOptimizedKey: page.optimizedKey,
          width: page.width,
          height: page.height,
          sourceByteSize: null,
          storedByteSize: null,
          sha256: null,
          publishedOptimizedWidth: page.optimizedWidth,
          publishedOptimizedHeight: page.optimizedHeight,
          createdAt: now,
          updatedAt: now,
        }))
        if (seededPages.length) {
          await tx.insert(chapterUploadPage).values(seededPages)
          await tx
            .update(chapterUploadSession)
            .set({
              orderedPageIds: seededPages.map(({ id }) => id),
              updatedAt: now,
            })
            .where(eq(chapterUploadSession.id, created.id))
        }
      }
      await audit(
        tx,
        actor,
        "chapter.upload_started",
        "chapter",
        chapterId,
        "chapter upload started",
        null,
        { groupId, sessionId: created.id, mode, expectedVersion },
        now
      )
      return created.id
    })
    return c.json(
      { data: await sessionDto(dependencies, sessionId, c.req.url) },
      200
    )
  })

  app.openapi(routes.getChapterUploadRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId, sessionId } = c.req.valid("param")
    await database.transaction(async (tx) => {
      const isAdmin = await authorizeRead(tx, actor, groupId, mangaId)
      const [owned] = await tx
        .select({ id: chapterGroup.chapterId })
        .from(chapterGroup)
        .where(
          and(
            eq(chapterGroup.chapterId, chapterId),
            eq(chapterGroup.groupId, groupId)
          )
        )
      const [session] = await tx
        .select({ id: chapterUploadSession.id })
        .from(chapterUploadSession)
        .innerJoin(chapter, eq(chapter.id, chapterUploadSession.chapterId))
        .where(
          and(
            eq(chapterUploadSession.id, sessionId),
            eq(chapterUploadSession.chapterId, chapterId),
            eq(chapterUploadSession.groupId, groupId),
            eq(chapter.mangaId, mangaId),
            isNull(chapter.deletedAt),
            ne(chapter.publicationState, "hidden")
          )
        )
      if ((!isAdmin && !owned) || !session)
        groupFailure(404, "NOT_FOUND", "Upload session not found")
    })
    return c.json(
      { data: await sessionDto(dependencies, sessionId, c.req.url) },
      200
    )
  })

  app.openapi(routes.createChapterStagingRoute, async (c) => {
    if (!dependencies.storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const sessionId = await database.transaction(async (tx) => {
      const context = await lockContext(tx, actor, groupId, mangaId)
      requirePermission(context, "add")
      requireMangaAvailable(context)
      const now = dependencies.now?.() ?? new Date()
      const [active] = await tx
        .select()
        .from(chapterUploadSession)
        .where(
          and(
            isNull(chapterUploadSession.chapterId),
            eq(chapterUploadSession.mangaId, mangaId),
            eq(chapterUploadSession.groupId, groupId),
            eq(chapterUploadSession.actorUserId, actor),
            inArray(chapterUploadSession.state, ["open", "finalizing"])
          )
        )
        .for("update")
      if (active) {
        if (active.expiresAt.getTime() > now.getTime()) return active.id
        await tx
          .update(chapterUploadSession)
          .set({ state: "cancelled", updatedAt: now })
          .where(eq(chapterUploadSession.id, active.id))
      }
      const [{ total }] = await tx
        .select({ total: count() })
        .from(chapterUploadSession)
        .where(
          and(
            eq(chapterUploadSession.actorUserId, actor),
            inArray(chapterUploadSession.state, ["open", "finalizing"]),
            gt(chapterUploadSession.expiresAt, now)
          )
        )
      if (total >= CHAPTER_ACTOR_MAX_ACTIVE_SESSIONS)
        groupFailure(429, "UPLOAD_BUSY", "Too many active upload sessions")
      const [created] = await tx
        .insert(chapterUploadSession)
        .values({
          chapterId: null,
          mangaId,
          actorUserId: actor,
          groupId,
          mode: "initial",
          expectedChapterVersion: null,
          expiresAt: addHours(now, 3),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: chapterUploadSession.id })
      if (!created) throw new Error("Upload session was not created")
      await audit(
        tx,
        actor,
        "chapter.upload_draft_started",
        "manga",
        mangaId,
        "chapter upload draft started",
        null,
        { groupId, sessionId: created.id },
        now
      )
      return created.id
    })
    return c.json(
      { data: await sessionDto(dependencies, sessionId, c.req.url) },
      200
    )
  })

  app.openapi(routes.getChapterStagingRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId } = c.req.valid("param")
    await database.transaction(async (tx) => {
      await lockStagingSession(
        tx,
        actor,
        groupId,
        mangaId,
        sessionId,
        dependencies.now?.() ?? new Date()
      )
    })
    return c.json(
      { data: await sessionDto(dependencies, sessionId, c.req.url) },
      200
    )
  })

  app.openapi(routes.uploadChapterPageRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId, sessionId } = c.req.valid("param")
    const { page, pageId } = c.req.valid("form")
    const data = await uploadSessionPage(
      dependencies,
      { actor, chapterId, groupId, mangaId, sessionId },
      page,
      pageId,
      c.req.url,
      c.get("chapterPageUploadTrace")
    )
    return c.json({ data }, 200)
  })

  app.openapi(routes.uploadChapterStagingPageRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId } = c.req.valid("param")
    const { page, pageId } = c.req.valid("form")
    const data = await uploadSessionPage(
      dependencies,
      { actor, chapterId: null, groupId, mangaId, sessionId },
      page,
      pageId,
      c.req.url,
      c.get("chapterPageUploadTrace")
    )
    return c.json({ data }, 200)
  })

  for (const route of [
    routes.reportChapterUploadDiagnosticRoute,
    routes.reportChapterStagingDiagnosticRoute,
  ]) {
    app.openapi(route, async (c) => {
      const params = c.req.valid("param")
      const target = {
        actor: c.get("accountUserId"),
        chapterId: "chapterId" in params ? params.chapterId : null,
        groupId: params.groupId,
        mangaId: params.mangaId,
        sessionId: params.sessionId,
      }
      const diagnostic = c.req.valid("json")
      await database.transaction((tx) =>
        lockUploadTarget(tx, target, dependencies.now?.() ?? new Date(), false)
      )
      dependencies.logger("warn", "chapter.upload_client_failed", {
        ...diagnostic,
        actorUserId: target.actor,
        chapterId: target.chapterId,
        groupId: target.groupId,
        mangaId: target.mangaId,
        sessionId: target.sessionId,
        reportRequestId: c.get("requestId"),
        source: "browser_report",
      })
      return c.body(null, 204)
    })
  }

  app.openapi(routes.deleteChapterPageRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId, sessionId, pageId } =
      c.req.valid("param")
    await deleteSessionPage(
      dependencies,
      { actor, chapterId, groupId, mangaId, sessionId },
      pageId
    )
    return c.body(null, 204)
  })

  app.openapi(routes.deleteChapterStagingPageRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId, pageId } = c.req.valid("param")
    await deleteSessionPage(
      dependencies,
      { actor, chapterId: null, groupId, mangaId, sessionId },
      pageId
    )
    return c.body(null, 204)
  })

  app.openapi(routes.orderChapterPagesRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId, sessionId } = c.req.valid("param")
    await orderSessionPages(
      dependencies,
      { actor, chapterId, groupId, mangaId, sessionId },
      c.req.valid("json").pageIds
    )
    return c.json(
      { data: await sessionDto(dependencies, sessionId, c.req.url) },
      200
    )
  })

  app.openapi(routes.orderChapterStagingPagesRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId } = c.req.valid("param")
    await orderSessionPages(
      dependencies,
      { actor, chapterId: null, groupId, mangaId, sessionId },
      c.req.valid("json").pageIds
    )
    return c.json(
      { data: await sessionDto(dependencies, sessionId, c.req.url) },
      200
    )
  })

  app.openapi(routes.finalizeChapterUploadRoute, async (c) => {
    if (!dependencies.storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Chapter storage is unavailable")
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId, sessionId } = c.req.valid("param")
    const queued = await prepareChapterFinalize(
      dependencies,
      actor,
      groupId,
      mangaId,
      chapterId,
      sessionId,
      c.req.valid("json"),
      false
    )
    dependencies.logger("info", "chapter.finalize.queued", {
      chapterId,
      groupId,
      mangaId,
      replay: queued.kind === "replay",
      sessionId,
    })
    return c.json(
      {
        data: await chapterManagementDetail(
          database,
          groupId,
          mangaId,
          chapterId,
          dependencies.now?.()
        ),
      },
      202
    )
  })

  app.openapi(routes.cancelChapterUploadRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, chapterId, sessionId } = c.req.valid("param")
    await cancelUploadSession(dependencies, {
      actor,
      chapterId,
      groupId,
      mangaId,
      sessionId,
    })
    return c.body(null, 204)
  })

  app.openapi(routes.cancelChapterStagingRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId } = c.req.valid("param")
    await cancelUploadSession(dependencies, {
      actor,
      chapterId: null,
      groupId,
      mangaId,
      sessionId,
    })
    return c.body(null, 204)
  })

  app.openapi(routes.commitChapterStagingRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId } = c.req.valid("param")
    const input = c.req.valid("json")
    let chapterId: string
    try {
      chapterId = await database.transaction(async (tx) => {
        const context = await lockContext(tx, actor, groupId, mangaId)
        requirePermission(context, "add")
        requireMangaAvailable(context)
        const now = dependencies.now?.() ?? new Date()
        const [session] = await tx
          .select()
          .from(chapterUploadSession)
          .where(
            and(
              eq(chapterUploadSession.id, sessionId),
              eq(chapterUploadSession.mangaId, mangaId),
              eq(chapterUploadSession.groupId, groupId),
              eq(chapterUploadSession.actorUserId, actor),
              eq(chapterUploadSession.mode, "initial")
            )
          )
          .for("update")
        if (!session) groupFailure(404, "NOT_FOUND", "Upload session not found")
        if (session.chapterId) {
          const committedChapterId = session.committedResult?.chapterId
          if (
            typeof committedChapterId === "string" &&
            committedChapterId === session.chapterId
          )
            return committedChapterId
          groupFailure(
            409,
            "UPLOAD_SESSION_STATE",
            "Upload session is already attached"
          )
        }
        if (
          session.state !== "open" ||
          session.expiresAt.getTime() <= now.getTime()
        )
          groupFailure(
            409,
            "UPLOAD_SESSION_STATE",
            "Upload session is not open"
          )
        if (!session.orderedPageIds.length)
          groupFailure(
            409,
            "UPLOAD_SESSION_STATE",
            "At least one uploaded page is required"
          )
        const pages = await tx
          .select({ id: chapterUploadPage.id, state: chapterUploadPage.state })
          .from(chapterUploadPage)
          .where(eq(chapterUploadPage.sessionId, sessionId))
        const orderedIds = new Set(session.orderedPageIds)
        if (
          pages.length !== session.orderedPageIds.length ||
          pages.some(
            (page) => page.state !== "ready" || !orderedIds.has(page.id)
          )
        )
          groupFailure(
            409,
            "UPLOAD_SESSION_STATE",
            "Every uploaded page must be ready and ordered"
          )
        const createdId = await insertChapterDraft(
          tx,
          actor,
          groupId,
          mangaId,
          input,
          now,
          context.manga.numberingMode
        )
        await tx
          .update(chapterUploadSession)
          .set({
            chapterId: createdId,
            expectedChapterVersion: 1,
            committedResult: { chapterId: createdId },
            updatedAt: now,
          })
          .where(
            and(
              eq(chapterUploadSession.id, sessionId),
              isNull(chapterUploadSession.chapterId)
            )
          )
        return createdId
      })
    } catch (error) {
      if (isUniqueViolation(error, "chapter_default_slot_uidx"))
        groupFailure(
          409,
          "DEFAULT_CHAPTER_CONFLICT",
          "A default release already exists at this position"
        )
      throw error
    }
    await cache.invalidateCatalog()
    return c.json(
      {
        data: await chapterManagementDetail(
          database,
          groupId,
          mangaId,
          chapterId,
          dependencies.now?.()
        ),
      },
      201
    )
  })
}

export async function cleanupChapterUploads(
  database: Database,
  storage: ChapterStorage,
  options: { apply: boolean; limit?: number; now?: Date }
) {
  const now = options.now ?? new Date()
  const staleClaim = subMinutes(now, 2)
  const abandonedFinalize = and(
    eq(chapterUploadSession.state, "finalizing"),
    lte(chapterUploadSession.expiresAt, now),
    or(
      isNull(chapterUploadSession.finalizeClaimExpiresAt),
      lte(chapterUploadSession.finalizeClaimExpiresAt, staleClaim)
    )
  )
  const candidates = await database
    .select({ id: chapterUploadSession.id, state: chapterUploadSession.state })
    .from(chapterUploadSession)
    .where(
      or(
        and(
          eq(chapterUploadSession.state, "open"),
          lte(chapterUploadSession.expiresAt, now)
        ),
        eq(chapterUploadSession.state, "cancelled"),
        abandonedFinalize,
        and(
          eq(chapterUploadSession.state, "completed"),
          isNotNull(chapterUploadSession.finalizedAt),
          lte(chapterUploadSession.finalizedAt, staleClaim)
        ),
        and(
          eq(chapterUploadSession.state, "cleaning"),
          lte(chapterUploadSession.updatedAt, staleClaim)
        )
      )
    )
    .orderBy(asc(chapterUploadSession.expiresAt), asc(chapterUploadSession.id))
    .limit(options.limit ?? 100)
  if (!options.apply) return candidates

  const cleaned: Array<{ id: string; state: "cleaned" | "cleaning" }> = []
  for (const candidate of candidates) {
    const claim = await database.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(chapterUploadSession)
        .where(eq(chapterUploadSession.id, candidate.id))
        .for("update")
      if (!session) return null
      const eligible =
        (session.state === "open" && !isAfter(session.expiresAt, now)) ||
        session.state === "cancelled" ||
        (session.state === "finalizing" &&
          !isAfter(session.expiresAt, now) &&
          (!session.finalizeClaimExpiresAt ||
            !isAfter(session.finalizeClaimExpiresAt, staleClaim))) ||
        (session.state === "completed" &&
          !!session.finalizedAt &&
          !isAfter(session.finalizedAt, staleClaim)) ||
        (session.state === "cleaning" &&
          !isAfter(session.updatedAt, staleClaim))
      if (!eligible) return null
      const [recentUpload] = await tx
        .select({ id: chapterUploadPage.id })
        .from(chapterUploadPage)
        .where(
          and(
            eq(chapterUploadPage.sessionId, session.id),
            eq(chapterUploadPage.state, "uploading"),
            gt(chapterUploadPage.updatedAt, staleClaim)
          )
        )
        .limit(1)
      if (recentUpload) return null
      await tx
        .update(chapterUploadSession)
        .set({
          state: "cleaning",
          finalizeClaimToken: null,
          finalizeClaimExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(chapterUploadSession.id, session.id))
      const pages = await tx
        .select({
          id: chapterUploadPage.id,
          stagingKey: chapterUploadPage.stagingKey,
        })
        .from(chapterUploadPage)
        .where(eq(chapterUploadPage.sessionId, session.id))
      const finalObjects = await tx
        .select({ key: chapterUploadFinalObject.objectKey })
        .from(chapterUploadFinalObject)
        .leftJoin(
          chapterPage,
          eq(chapterPage.originalKey, chapterUploadFinalObject.objectKey)
        )
        .where(
          and(
            eq(chapterUploadFinalObject.sessionId, session.id),
            isNull(chapterPage.originalKey)
          )
        )
      return {
        id: session.id,
        finalKeys: finalObjects.map(({ key }) => key),
        stagingKeys: pages.flatMap(({ stagingKey }) =>
          stagingKey ? [stagingKey] : []
        ),
      }
    })
    if (!claim) continue
    const deletions = await Promise.allSettled([
      ...claim.stagingKeys.map((key) => storage.delete(key)),
      ...claim.finalKeys.map((key) => storage.deletePublic(key)),
    ])
    if (deletions.some(({ status }) => status === "rejected")) {
      cleaned.push({ id: claim.id, state: "cleaning" })
      continue
    }
    await database.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: chapterUploadSession.id })
        .from(chapterUploadSession)
        .where(
          and(
            eq(chapterUploadSession.id, claim.id),
            eq(chapterUploadSession.state, "cleaning"),
            eq(chapterUploadSession.updatedAt, now)
          )
        )
        .for("update")
      if (!owned) return
      await tx
        .delete(chapterUploadPage)
        .where(eq(chapterUploadPage.sessionId, claim.id))
      await tx
        .delete(chapterUploadFinalObject)
        .where(eq(chapterUploadFinalObject.sessionId, claim.id))
      await tx
        .update(chapterUploadSession)
        .set({ state: "cleaned", orderedPageIds: [], updatedAt: now })
        .where(eq(chapterUploadSession.id, claim.id))
    })
    cleaned.push({ id: claim.id, state: "cleaned" })
  }
  return cleaned
}
