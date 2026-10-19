import { randomUUID } from "node:crypto"
import { addSeconds, isAfter } from "date-fns"
import { and, asc, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import {
  chapter,
  chapterPage,
  chapterTikTokReplica as replica,
  imageServer2Control,
  manga,
  moderationAction,
  type TikTokReplicaPage,
} from "../../db/schema.js"
import {
  readableChapter,
  visibleManga,
  type CatalogVisibility,
} from "../catalog/routes.js"
import {
  requireActiveAccount,
  requireGroupAdmin,
  type GroupTransaction,
} from "../groups/service.js"
import {
  isTikTokMediaUrl,
  ReplicaError,
  retryDelay,
  uploadReplicaPage,
} from "./tiktok.js"
import type { Logger } from "../../shared/logger.js"

type Job = typeof replica.$inferSelect
type ManifestPage = Pick<
  typeof chapterPage.$inferSelect,
  "position" | "originalKey" | "width" | "height"
>
export type ReplicaDependencies = {
  database: Database
  visibility: CatalogVisibility
  logger?: Logger
}

export function validReplicaManifest(pages: ManifestPage[]) {
  // WD preserves source positions (often 1-based, sometimes sparse). Never renumber S1.
  return (
    pages.length > 0 &&
    pages.length <= 220 &&
    pages.every(
      (page, index) =>
        Number.isInteger(page.position) &&
        page.position >= 0 &&
        (index === 0 || page.position > pages[index - 1]!.position)
    )
  )
}

export function verifiedPage(page: TikTokReplicaPage | undefined) {
  return (
    !!page &&
    isTikTokMediaUrl(page.url) &&
    !!page.uri &&
    !!page.verifiedAt &&
    ["png", "jpeg", "webp"].includes(page.format ?? "") &&
    (page.byteSize ?? 0) > 0
  )
}

export function replicaMatches(
  pages: ManifestPage[],
  version: number,
  job: Job | null | undefined
) {
  return (
    !!job &&
    job.sourceVersion === version &&
    pages.length === job.totalPages &&
    Object.keys(job.pages).length === pages.length &&
    validReplicaManifest(pages) &&
    pages.every((page) => {
      const copy = job.pages[String(page.position)]
      return (
        copy?.originalKey === page.originalKey &&
        copy.width === page.width &&
        copy.height === page.height
      )
    })
  )
}

export function readyReplicaUrls(
  pages: ManifestPage[],
  version: number,
  job: Job | null | undefined
) {
  if (
    job?.state !== "ready" ||
    !replicaMatches(pages, version, job) ||
    !pages.every((page) => verifiedPage(job.pages[String(page.position)]))
  )
    return null
  return pages.map((page) => job.pages[String(page.position)]!.url!)
}

async function lockReadable(
  tx: GroupTransaction,
  id: string,
  visibility: CatalogVisibility
) {
  const [identity] = await tx
    .select({ mangaId: chapter.mangaId })
    .from(chapter)
    .where(eq(chapter.id, id))
  if (!identity) return null
  // Same manga -> chapter -> replica lock order as publication/moderation.
  const [parent] = await tx
    .select({ id: manga.id })
    .from(manga)
    .where(and(eq(manga.id, identity.mangaId), visibleManga(visibility)))
    .for("share")
  if (!parent) return null
  const [target] = await tx
    .select()
    .from(chapter)
    .where(and(eq(chapter.id, id), readableChapter(visibility)))
    .for("update")
  return target ?? null
}

async function manifest(tx: GroupTransaction, id: string) {
  return tx
    .select()
    .from(chapterPage)
    .where(eq(chapterPage.chapterId, id))
    .orderBy(asc(chapterPage.position))
}

function pendingJob(
  id: string,
  version: number,
  pages: ManifestPage[],
  now: Date
) {
  if (!validReplicaManifest(pages)) {
    throw new ReplicaError("INVALID_MANIFEST")
  }
  return {
    chapterId: id,
    sourceVersion: version,
    totalPages: pages.length,
    pages: Object.fromEntries(
      pages.map((page) => [
        String(page.position),
        {
          originalKey: page.originalKey,
          width: page.width,
          height: page.height,
          uri: null,
          url: null,
          format: null,
          byteSize: null,
          verifiedAt: null,
        },
      ])
    ) as Record<string, TikTokReplicaPage>,
    state: "pending" as const,
    attempts: 0,
    nextRetryAt: null,
    readyAt: null,
    claimToken: null,
    claimExpiresAt: null,
    lastError: null,
    lastErrorCode: null,
    updatedAt: now,
  }
}

export async function discoverReplicas({
  database,
  visibility,
}: ReplicaDependencies) {
  const candidates = await database
    .select({ id: chapter.id })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .leftJoin(replica, eq(replica.chapterId, chapter.id))
    .where(
      and(
        gt(chapter.pagesVersion, 0),
        readableChapter(visibility),
        visibleManga(visibility),
        or(
          isNull(replica.chapterId),
          ne(replica.sourceVersion, chapter.pagesVersion)
        )
      )
    )
    .orderBy(asc(chapter.id))
    .limit(100)
  let enqueued = 0
  for (const { id } of candidates) {
    enqueued += await database.transaction(async (tx) => {
      const target = await lockReadable(tx, id, visibility)
      if (!target || target.pagesVersion === 0) return 0
      const [previous] = await tx
        .select()
        .from(replica)
        .where(eq(replica.chapterId, id))
        .for("update")
      if (previous?.sourceVersion === target.pagesVersion) return 0
      const pages = await manifest(tx, id)
      // Imported malformed manifests remain S1-only; do not poison other jobs.
      if (!validReplicaManifest(pages)) return 0
      const values = pendingJob(id, target.pagesVersion, pages, new Date())
      await tx
        .insert(replica)
        .values(values)
        .onConflictDoUpdate({ target: replica.chapterId, set: values })
      return 1
    })
  }
  return enqueued
}

export async function claimReplica(
  { database, visibility }: ReplicaDependencies,
  now = new Date()
) {
  const due = or(
    eq(replica.state, "pending"),
    and(eq(replica.state, "retry_wait"), lte(replica.nextRetryAt, now)),
    and(eq(replica.state, "running"), lte(replica.claimExpiresAt, now))
  )
  const candidates = await database
    .select({ id: replica.chapterId })
    .from(replica)
    .innerJoin(chapter, eq(chapter.id, replica.chapterId))
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .where(
      and(
        due,
        eq(chapter.pagesVersion, replica.sourceVersion),
        readableChapter(visibility),
        visibleManga(visibility)
      )
    )
    .orderBy(asc(replica.updatedAt), asc(replica.chapterId))
    .limit(20)
  for (const { id } of candidates) {
    const job = await database.transaction(async (tx) => {
      // Serialize claims against the admin switch. Existing claims may finish.
      await tx
        .insert(imageServer2Control)
        .values({ id: 1 })
        .onConflictDoNothing()
      const [control] = await tx
        .select()
        .from(imageServer2Control)
        .where(eq(imageServer2Control.id, 1))
        .for("share")
      if (!control!.enabled) return null
      const target = await lockReadable(tx, id, visibility)
      if (!target) return null
      const [current] = await tx
        .select()
        .from(replica)
        .where(and(eq(replica.chapterId, id), due))
        .for("update")
      if (!current || current.sourceVersion !== target.pagesVersion) return null
      if (current.attempts >= 5) {
        await tx
          .update(replica)
          .set({
            state: "failed",
            claimToken: null,
            claimExpiresAt: null,
            lastErrorCode: "ATTEMPTS_EXHAUSTED",
            lastError: "ATTEMPTS_EXHAUSTED",
            updatedAt: now,
          })
          .where(eq(replica.chapterId, id))
        return null
      }
      const [claimed] = await tx
        .update(replica)
        .set({
          state: "running",
          attempts: current.attempts + 1,
          claimToken: randomUUID(),
          claimExpiresAt: addSeconds(now, 120),
          nextRetryAt: null,
          updatedAt: now,
        })
        .where(eq(replica.chapterId, id))
        .returning()
      return claimed!
    })
    if (job) return job
  }
  return null
}

async function withClaim<T>(
  deps: ReplicaDependencies,
  job: Job,
  run: (tx: GroupTransaction, current: Job) => Promise<T>
) {
  return deps.database.transaction(async (tx) => {
    const target = await lockReadable(tx, job.chapterId, deps.visibility)
    if (!target || target.pagesVersion !== job.sourceVersion) return null
    const [current] = await tx
      .select()
      .from(replica)
      .where(
        and(
          eq(replica.chapterId, job.chapterId),
          eq(replica.sourceVersion, job.sourceVersion),
          eq(replica.state, "running"),
          eq(replica.claimToken, job.claimToken!),
          gt(replica.claimExpiresAt, new Date())
        )
      )
      .for("update")
    if (!current) return null
    return run(tx, current)
  })
}

export async function heartbeatReplica(deps: ReplicaDependencies, job: Job) {
  return withClaim(deps, job, async (tx) => {
    await tx
      .update(replica)
      .set({
        claimExpiresAt: addSeconds(new Date(), 120),
        updatedAt: new Date(),
      })
      .where(eq(replica.chapterId, job.chapterId))
    return true
  })
}

export async function checkpointReplica(
  deps: ReplicaDependencies,
  job: Job,
  position: number,
  page: TikTokReplicaPage
) {
  if (!verifiedPage(page)) throw new ReplicaError("INVALID_CHECKPOINT")
  return withClaim(deps, job, async (tx, current) => {
    const source = current.pages[String(position)]
    if (
      !source ||
      source.originalKey !== page.originalKey ||
      source.width !== page.width ||
      source.height !== page.height
    )
      return false
    await tx
      .update(replica)
      .set({
        pages: sql`jsonb_set(${replica.pages}, ARRAY[${String(position)}]::text[], ${JSON.stringify(page)}::jsonb, false)`,
        updatedAt: new Date(),
      })
      .where(eq(replica.chapterId, job.chapterId))
    return true
  })
}

export async function finishReplica(deps: ReplicaDependencies, job: Job) {
  return withClaim(deps, job, async (tx, current) => {
    const pages = await manifest(tx, job.chapterId)
    if (
      !replicaMatches(pages, job.sourceVersion, current) ||
      !Object.values(current.pages).every(verifiedPage)
    )
      return false
    const now = new Date()
    await tx
      .update(replica)
      .set({
        state: "ready",
        claimToken: null,
        claimExpiresAt: null,
        readyAt: now,
        updatedAt: now,
        lastError: null,
        lastErrorCode: null,
      })
      .where(eq(replica.chapterId, job.chapterId))
    return true
  })
}

export async function failReplica(
  deps: ReplicaDependencies,
  job: Job,
  error: ReplicaError
) {
  // Also release jobs hidden midway; only the current token/version may change them.
  await deps.database
    .update(replica)
    .set({
      state:
        error.code === "CLAIM_ABORTED"
          ? "pending"
          : error.retryable && job.attempts < 5
            ? "retry_wait"
            : "failed",
      nextRetryAt: error.retryable
        ? retryDelay(job.attempts, error.retryAt)
        : null,
      claimToken: null,
      claimExpiresAt: null,
      updatedAt: new Date(),
      lastErrorCode: error.code,
      lastError: error.code,
      ...(error.code === "CLAIM_ABORTED"
        ? { attempts: Math.max(0, job.attempts - 1) }
        : {}),
    })
    .where(
      and(
        eq(replica.chapterId, job.chapterId),
        eq(replica.sourceVersion, job.sourceVersion),
        eq(replica.state, "running"),
        eq(replica.claimToken, job.claimToken!),
        gt(replica.claimExpiresAt, new Date())
      )
    )
}

export async function processReplica(
  deps: ReplicaDependencies,
  job: Job,
  upload: (
    page: TikTokReplicaPage,
    signal: AbortSignal
  ) => ReturnType<typeof uploadReplicaPage>,
  signal: AbortSignal
) {
  const controller = new AbortController()
  const started = performance.now()
  const combined = AbortSignal.any([signal, controller.signal])
  let heartbeat: Promise<void> | undefined
  const timer = setInterval(() => {
    if (heartbeat) return
    heartbeat = heartbeatReplica(deps, job)
      .then((owned) => {
        if (!owned) controller.abort()
      })
      .catch(() => controller.abort())
      .finally(() => {
        heartbeat = undefined
      })
  }, 30_000)
  try {
    const remaining = Object.entries(job.pages).filter(
      ([, page]) => !verifiedPage(page)
    )
    let cursor = 0
    let failure: ReplicaError | undefined
    await Promise.all(
      Array.from({ length: 2 }, async () => {
        try {
          while (cursor < remaining.length) {
            combined.throwIfAborted()
            const [position, page] = remaining[cursor++]!
            const result = await upload(page, combined).catch(
              (error: unknown) => {
                deps.logger?.("warn", "image_server2_page_failed", {
                  chapterId: job.chapterId,
                  sourceVersion: job.sourceVersion,
                  position,
                  code:
                    error instanceof ReplicaError ? error.code : "UPLOAD_ERROR",
                })
                throw error
              }
            )
            combined.throwIfAborted()
            if (
              !(await checkpointReplica(deps, job, Number(position), {
                ...page,
                ...result,
              }))
            )
              throw new ReplicaError("CLAIM_ABORTED", true)
          }
        } catch (error) {
          if (error instanceof ReplicaError && error.code === "AUTH_REQUIRED")
            failure = error
          failure ??=
            error instanceof ReplicaError
              ? error
              : new ReplicaError(
                  combined.aborted ? "CLAIM_ABORTED" : "WORKER_ERROR",
                  true
                )
          controller.abort()
        }
      })
    )
    if (failure) throw failure
    combined.throwIfAborted()
    if (!(await finishReplica(deps, job)))
      throw new ReplicaError("CLAIM_ABORTED", true)
    deps.logger?.("info", "image_server2_ready", {
      chapterId: job.chapterId,
      sourceVersion: job.sourceVersion,
      pages: job.totalPages,
      durationMs: Math.round(performance.now() - started),
    })
    return true
  } catch (error) {
    const safe =
      error instanceof ReplicaError
        ? error
        : new ReplicaError(
            combined.aborted ? "CLAIM_ABORTED" : "WORKER_ERROR",
            true
          )
    deps.logger?.("warn", "image_server2_job_failed", {
      chapterId: job.chapterId,
      sourceVersion: job.sourceVersion,
      code: safe.code,
      attempt: job.attempts,
      durationMs: Math.round(performance.now() - started),
    })
    try {
      await failReplica(deps, job, safe)
    } catch (error) {
      if (safe.code === "AUTH_REQUIRED") throw safe
      throw error
    }
    if (safe.code === "AUTH_REQUIRED") throw safe
    return false
  } finally {
    clearInterval(timer)
    await heartbeat
  }
}

export async function operateReplica(
  deps: ReplicaDependencies,
  id: string,
  input: {
    action: "enqueue" | "retry"
    reset: boolean
    actor: string
    onlyFailed?: boolean
  }
) {
  return deps.database.transaction(async (tx) => {
    await requireActiveAccount(tx, input.actor)
    await requireGroupAdmin(tx, input.actor)
    const target = await lockReadable(tx, id, deps.visibility)
    if (!target) throw new ReplicaError("CHAPTER_NOT_READABLE")
    const [previous] = await tx
      .select()
      .from(replica)
      .where(eq(replica.chapterId, id))
      .for("update")
    if (
      input.onlyFailed &&
      !["failed", "retry_wait"].includes(previous?.state ?? "")
    )
      return false
    if (
      previous?.state === "running" &&
      previous.claimExpiresAt &&
      isAfter(previous.claimExpiresAt, new Date())
    )
      throw new ReplicaError("JOB_RUNNING")
    if (
      previous?.sourceVersion === target.pagesVersion &&
      !input.reset &&
      (input.action === "enqueue" || previous.state === "ready")
    )
      return false
    const pages = await manifest(tx, id)
    const next = pendingJob(id, target.pagesVersion, pages, new Date())
    if (!input.reset && replicaMatches(pages, target.pagesVersion, previous))
      next.pages = previous!.pages
    await tx
      .insert(replica)
      .values(next)
      .onConflictDoUpdate({ target: replica.chapterId, set: next })
    await tx.insert(moderationAction).values({
      actorUserId: input.actor,
      action: `chapter.tiktok_${input.action}`,
      targetKind: "chapter",
      targetId: id,
      reason: `Chapter TikTok ${input.action}`,
      before: previous
        ? { state: previous.state, sourceVersion: previous.sourceVersion }
        : null,
      after: {
        state: next.state,
        sourceVersion: next.sourceVersion,
        reset: input.reset,
      },
    })
    return true
  })
}

export async function replicaWorkerEnabled(database: Database) {
  const [control] = await database
    .select()
    .from(imageServer2Control)
    .where(eq(imageServer2Control.id, 1))
  return control?.enabled ?? true
}

export async function setReplicaWorkerEnabled(
  database: Database,
  actor: string,
  enabled: boolean
) {
  return database.transaction(async (tx) => {
    await requireActiveAccount(tx, actor)
    await requireGroupAdmin(tx, actor)
    await tx.insert(imageServer2Control).values({ id: 1 }).onConflictDoNothing()
    const [before] = await tx
      .select()
      .from(imageServer2Control)
      .where(eq(imageServer2Control.id, 1))
      .for("update")
    if (before!.enabled === enabled) return
    await tx
      .update(imageServer2Control)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(imageServer2Control.id, 1))
    await tx.insert(moderationAction).values({
      actorUserId: actor,
      action: "image_server2.worker_switch",
      targetKind: "image_server2",
      targetId: "worker",
      reason: enabled ? "Resume worker from admin" : "Pause worker from admin",
      before: { enabled: before!.enabled },
      after: { enabled },
    })
  })
}
