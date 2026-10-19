import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"
import { and, asc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm"
import {
  chapter,
  chapterTikTokReplica as replica,
  manga,
} from "../../db/schema.js"
import {
  apiError,
  ApiErrorSchema,
  IdSchema,
  PageQuerySchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import type { Auth } from "../account/auth.js"
import { freshSessionUser } from "../account/guard.js"
import {
  readableChapter,
  normalizeDecimal,
  visibleManga,
  type CatalogDependencies,
} from "../catalog/routes.js"
import { groupFailure, requireGroupAdmin } from "../groups/service.js"
import {
  operateReplica,
  replicaWorkerEnabled,
  setReplicaWorkerEnabled,
  verifiedPage,
} from "./service.js"
import { ReplicaError } from "./tiktok.js"

const base = "/v1/admin/image-server2"
const tags = ["admin-image-server2"]
const errorResponse = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Request rejected",
}
const errors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  413: errorResponse,
}
const meta = z.object({
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
})
const WorkerSchema = z
  .object({
    enabled: z.boolean(),
    uploadConfigured: z.boolean(),
    readEnabled: z.boolean(),
  })
  .openapi("ImageServer2Worker")
const stateSchema = z.enum([
  "missing",
  "stale",
  "pending",
  "running",
  "retry_wait",
  "ready",
  "failed",
])
const MangaSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    slug: z.string(),
    chapters: z.number(),
    ready: z.number(),
    failed: z.number(),
    running: z.number(),
    queued: z.number(),
  })
  .openapi("ImageServer2Manga")
const MangaListSchema = z
  .object({ data: z.array(MangaSchema), meta })
  .openapi("ImageServer2MangaList")
const ChapterSchema = z
  .object({
    id: IdSchema,
    number: z.string().nullable(),
    title: z.string().nullable(),
    pagesVersion: z.number(),
    sourceVersion: z.number().nullable(),
    state: stateSchema,
    verified: z.number(),
    total: z.number(),
    attempts: z.number(),
    lastErrorCode: z.string().nullable(),
    nextRetryAt: TimestampSchema.nullable(),
    updatedAt: TimestampSchema.nullable(),
  })
  .openapi("ImageServer2Chapter")
const ChapterListSchema = z
  .object({
    manga: MangaSchema.pick({ id: true, title: true }),
    data: z.array(ChapterSchema),
    meta,
  })
  .openapi("ImageServer2ChapterList")
const BatchInputSchema = z
  .object({
    action: z.enum(["enqueue", "retry"]),
    chapterIds: z.array(IdSchema).min(1).max(100).optional(),
    mangaIds: z.array(IdSchema).min(1).max(20).optional(),
  })
  .strict()
  .refine(
    (value) => !!value.chapterIds !== !!value.mangaIds,
    "Choose chapters or manga"
  )
  .openapi("ImageServer2BatchInput")
const BatchResultSchema = z
  .object({
    applied: z.number(),
    skipped: z.number(),
    hasMore: z.boolean(),
    errors: z.array(z.object({ chapterId: IdSchema, code: z.string() })),
  })
  .openapi("ImageServer2BatchResult")
const workerRoute = createRoute({
  method: "get",
  path: `${base}/worker`,
  tags,
  responses: {
    200: {
      description:
        "Persisted switch and effective environment flags; not process liveness",
      content: { "application/json": { schema: WorkerSchema } },
    },
    ...errors,
  },
})
const switchRoute = createRoute({
  method: "put",
  path: `${base}/worker`,
  tags,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ enabled: z.boolean() }).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Switch saved",
      content: { "application/json": { schema: WorkerSchema } },
    },
    ...errors,
  },
})
const mangasRoute = createRoute({
  method: "get",
  path: `${base}/mangas`,
  tags,
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().max(120).default(""),
    }),
  },
  responses: {
    200: {
      description: "Readable manga and current-generation chapter progress",
      content: { "application/json": { schema: MangaListSchema } },
    },
    ...errors,
  },
})
const chaptersRoute = createRoute({
  method: "get",
  path: `${base}/mangas/{id}/chapters`,
  tags,
  request: {
    params: z.object({ id: IdSchema }),
    query: PageQuerySchema.extend({ state: stateSchema.optional() }),
  },
  responses: {
    200: {
      description: "Readable chapters and replica progress",
      content: { "application/json": { schema: ChapterListSchema } },
    },
    ...errors,
  },
})
const batchRoute = createRoute({
  method: "post",
  path: `${base}/jobs`,
  tags,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: BatchInputSchema } },
    },
  },
  responses: {
    200: {
      description: "At most 100 eligible chapters processed; repeat if hasMore",
      content: { "application/json": { schema: BatchResultSchema } },
    },
    ...errors,
  },
})

export function registerImageServer2Routes(
  app: OpenAPIHono,
  dependencies: CatalogDependencies & {
    auth?: Auth
    webOrigin: WebOrigins
    uploadConfigured: boolean
  }
) {
  const { database, auth, webOrigin, cache } = dependencies
  const deps = { database, visibility: dependencies }
  app.use(`${base}/*`, async (c, next) => {
    c.header("Cache-Control", "private, no-store")
    const currentUser = await freshSessionUser(auth, c.req.raw.headers)
    if (!currentUser)
      groupFailure(401, "UNAUTHORIZED", "Authentication is required")
    c.set("accountUserId", currentUser.id)
    await requireGroupAdmin(database, currentUser.id)
    if (
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      !isTrustedWebOrigin(c.req.header("Origin"), webOrigin)
    )
      groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
    await next()
  })
  app.use(
    `${base}/*`,
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
  const workerStatus = async () => ({
    enabled: await replicaWorkerEnabled(database),
    uploadConfigured: dependencies.uploadConfigured,
    readEnabled: dependencies.imageServer2ReadEnabled ?? false,
  })
  app.openapi(workerRoute, async (c) => c.json(await workerStatus(), 200))
  app.openapi(switchRoute, async (c) => {
    await setReplicaWorkerEnabled(
      database,
      c.get("accountUserId"),
      c.req.valid("json").enabled
    )
    return c.json(await workerStatus(), 200)
  })
  app.openapi(mangasRoute, async (c) => {
    const { q, page, limit } = c.req.valid("query")
    const rows = await database
      .select({ id: manga.id, title: manga.title, slug: manga.slug })
      .from(manga)
      .where(
        and(
          visibleManga(dependencies),
          q
            ? ilike(manga.title, `%${q.replace(/[\\%_]/g, "\\$&")}%`)
            : undefined
        )
      )
      .orderBy(asc(manga.title), asc(manga.id))
      .offset((page - 1) * limit)
      .limit(limit + 1)
    const shown = rows.slice(0, limit)
    const counts = shown.length
      ? await database
          .select({
            mangaId: chapter.mangaId,
            chapters: sql<number>`count(*)::int`,
            ready: sql<number>`count(*) filter (where ${replica.state} = 'ready')::int`,
            failed: sql<number>`count(*) filter (where ${replica.state} = 'failed')::int`,
            running: sql<number>`count(*) filter (where ${replica.state} = 'running')::int`,
            queued: sql<number>`count(*) filter (where ${replica.state} in ('pending', 'retry_wait'))::int`,
          })
          .from(chapter)
          .leftJoin(
            replica,
            and(
              eq(replica.chapterId, chapter.id),
              eq(replica.sourceVersion, chapter.pagesVersion)
            )
          )
          .where(
            and(
              inArray(
                chapter.mangaId,
                shown.map((row) => row.id)
              ),
              readableChapter(dependencies)
            )
          )
          .groupBy(chapter.mangaId)
      : []
    const byManga = new Map(
      counts.map(({ mangaId, ...count }) => [mangaId, count])
    )
    return c.json(
      {
        data: shown.map((row) => ({
          ...row,
          ...(byManga.get(row.id) ?? {
            chapters: 0,
            ready: 0,
            failed: 0,
            running: 0,
            queued: 0,
          }),
        })),
        meta: { page, limit, hasMore: rows.length > limit },
      },
      200
    )
  })
  app.openapi(chaptersRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { page, limit, state } = c.req.valid("query")
    const [parent] = await database
      .select({ id: manga.id, title: manga.title })
      .from(manga)
      .where(and(eq(manga.id, id), visibleManga(dependencies)))
    if (!parent) groupFailure(404, "NOT_FOUND", "Manga not found")
    const effectiveState = sql<
      z.infer<typeof stateSchema>
    >`case when ${replica.chapterId} is null then 'missing' when ${replica.sourceVersion} <> ${chapter.pagesVersion} then 'stale' else ${replica.state}::text end`
    const rows = await database
      .select({
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        pagesVersion: chapter.pagesVersion,
        total: chapter.availablePageCount,
        state: effectiveState,
        job: replica,
      })
      .from(chapter)
      .innerJoin(manga, eq(manga.id, chapter.mangaId))
      .leftJoin(replica, eq(replica.chapterId, chapter.id))
      .where(
        and(
          eq(chapter.mangaId, id),
          readableChapter(dependencies),
          visibleManga(dependencies),
          state ? eq(effectiveState, state) : undefined
        )
      )
      .orderBy(asc(chapter.number), asc(chapter.id))
      .offset((page - 1) * limit)
      .limit(limit + 1)
    return c.json(
      {
        manga: parent,
        data: rows.slice(0, limit).map(({ job, ...row }) => ({
          ...row,
          number: normalizeDecimal(row.number),
          sourceVersion: job?.sourceVersion ?? null,
          verified:
            job?.sourceVersion === row.pagesVersion
              ? Object.values(job.pages).filter(verifiedPage).length
              : 0,
          attempts: job?.attempts ?? 0,
          lastErrorCode: job?.lastErrorCode ?? null,
          nextRetryAt: job?.nextRetryAt
            ? formatTimestamp(job.nextRetryAt)
            : null,
          updatedAt: job ? formatTimestamp(job.updatedAt) : null,
        })),
        meta: { page, limit, hasMore: rows.length > limit },
      },
      200
    )
  })
  app.openapi(batchRoute, async (c) => {
    const input = c.req.valid("json")
    const rows = await database
      .select({ id: chapter.id })
      .from(chapter)
      .innerJoin(manga, eq(manga.id, chapter.mangaId))
      .leftJoin(replica, eq(replica.chapterId, chapter.id))
      .where(
        and(
          readableChapter(dependencies),
          visibleManga(dependencies),
          input.chapterIds
            ? inArray(chapter.id, input.chapterIds)
            : inArray(manga.id, input.mangaIds!),
          input.action === "enqueue"
            ? or(
                isNull(replica.chapterId),
                ne(replica.sourceVersion, chapter.pagesVersion)
              )
            : inArray(replica.state, ["failed", "retry_wait"])
        )
      )
      .orderBy(asc(chapter.id))
      .limit(101)
    const result: z.infer<typeof BatchResultSchema> = {
      applied: 0,
      skipped: 0,
      hasMore: rows.length > 100,
      errors: [],
    }
    // Each chapter commits independently; report expected failures without hiding successful work.
    for (const { id } of rows.slice(0, 100)) {
      try {
        const applied = await operateReplica(deps, id, {
          ...input,
          reset: false,
          actor: c.get("accountUserId"),
          onlyFailed: input.action === "retry",
        })
        if (applied) result.applied++
        else result.skipped++
      } catch (error) {
        if (!(error instanceof ReplicaError)) throw error
        result.errors.push({ chapterId: id, code: error.code })
      }
    }
    if (result.applied) await cache.invalidateCatalog()
    return c.json(result, 200)
  })
}
