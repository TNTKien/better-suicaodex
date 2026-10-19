import type { OpenAPIHono } from "@hono/zod-openapi"
import { createHash, randomUUID } from "node:crypto"
import { addHours, subMinutes } from "date-fns"
import { and, eq, isNull, lte, or, sql } from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "../../db/client.js"
import {
  cover,
  coverUploadOperation,
  coverUploadSession,
  manga,
  moderationAction,
} from "../../db/schema.js"
import type { BusinessCache } from "../../shared/cache.js"
import { apiError } from "../../shared/contract.js"
import { errorFields } from "../../shared/logger.js"
import type { Logger } from "../../shared/logger.js"
import type { ChapterStorage, CoverStorage } from "../../shared/storage.js"
import { resolveCoverUrl } from "../catalog/routes.js"
import * as routes from "./contract.js"
import {
  CoverImageBusyError,
  CoverImageError,
  COVER_MAX_INPUT_BYTES,
  COVER_MULTIPART_MAX_BYTES,
  transformCover,
} from "./cover-image.js"
import { authorizeMangaCreate, requireMangaPermission } from "./manga.js"
import { groupFailure } from "./service.js"

const cacheControl = "public, max-age=31536000, immutable"
const coverPath = routes.uploadMangaCoverRoute.getRoutingPath()
const stagePath = routes.stageMangaCoverRoute.getRoutingPath()
const sessionTtlHours = 3
const privatePreviewFetchSeconds = 60

type Dependencies = {
  assetBaseUrl: string
  cache: BusinessCache
  database: Database
  logger: Logger
  now?: () => Date
  storage?: CoverStorage
  stagingStorage?: ChapterStorage
}

export const isMangaCoverUpload = (method: string, path: string) =>
  method === "POST" &&
  (/^\/v1\/contribution\/groups\/[^/]+\/manga\/[^/]+\/cover$/.test(path) ||
    /^\/v1\/contribution\/groups\/[^/]+\/manga\/cover-uploads$/.test(path))

function keys(mangaId: string, coverId: string) {
  const base = `covers/${mangaId}/${coverId}`
  return {
    originalKey: `${base}.webp`,
    mediumKey: `${base}.512.webp`,
    smallKey: `${base}.256.webp`,
  }
}

async function putVerified(
  storage: CoverStorage,
  key: string,
  data: Uint8Array,
  expectedCacheControl = cacheControl
) {
  await storage.put(key, data)
  const stored = await storage.head(key)
  if (
    stored.contentLength !== data.byteLength ||
    stored.contentType !== "image/webp" ||
    (expectedCacheControl && stored.cacheControl !== expectedCacheControl)
  )
    throw new Error(`Stored cover verification failed for ${key}`)
}

function stagingKeys(sessionId: string) {
  const base = `covers/staging/${sessionId}`
  return {
    originalStagingKey: `${base}.webp`,
    mediumStagingKey: `${base}.512.webp`,
    smallStagingKey: `${base}.256.webp`,
  }
}

function coverPreviewPath(sessionId: string) {
  return `/uploads/covers/tmp/${encodeURIComponent(sessionId)}.webp`
}

const sha256 = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex")

async function processCover(file: File) {
  if (file.size > COVER_MAX_INPUT_BYTES)
    groupFailure(413, "PAYLOAD_TOO_LARGE", "Cover must not exceed 5 MiB")
  try {
    return await transformCover(new Uint8Array(await file.arrayBuffer()))
  } catch (error) {
    if (error instanceof CoverImageBusyError)
      groupFailure(503, "IMAGE_PROCESSOR_BUSY", error.message)
    if (error instanceof CoverImageError)
      groupFailure(400, "INVALID_COVER", error.message)
    throw error
  }
}

async function deleteStagedObjects(
  storage: ChapterStorage,
  session: typeof coverUploadSession.$inferSelect,
  includePublic: boolean
) {
  const removals = [
    storage.delete(session.originalStagingKey),
    storage.delete(session.mediumStagingKey),
    storage.delete(session.smallStagingKey),
  ]
  if (includePublic && session.mangaId) {
    const final = keys(session.mangaId, session.id)
    removals.push(
      storage.deletePublic(final.originalKey),
      storage.deletePublic(final.mediumKey),
      storage.deletePublic(final.smallKey)
    )
  }
  const results = await Promise.allSettled(removals)
  const failed = results.find((result) => result.status === "rejected")
  if (failed) throw failed.reason
}

async function attachedCoverResult(
  database: Database,
  assetBaseUrl: string,
  mangaId: string,
  sessionId: string
) {
  const [result] = await database
    .select({
      storageKey: cover.storageKey,
      width: cover.width,
      height: cover.height,
      version: manga.version,
    })
    .from(cover)
    .innerJoin(manga, eq(manga.id, cover.mangaId))
    .where(and(eq(cover.id, sessionId), eq(cover.mangaId, mangaId)))
    .limit(1)
  if (!result)
    groupFailure(409, "COVER_SESSION_CHANGED", "Cover session changed")
  return {
    url: resolveCoverUrl(assetBaseUrl, result.storageKey),
    width: result.width,
    height: result.height,
    version: result.version,
  }
}

async function copyStagedCover(
  storage: ChapterStorage,
  session: typeof coverUploadSession.$inferSelect
) {
  if (!session.mangaId) throw new Error("Cover session target is missing")
  const final = keys(session.mangaId, session.id)
  const copies = [
    {
      source: session.originalStagingKey,
      target: final.originalKey,
      sha256: session.originalSha256,
      byteSize: session.originalByteSize,
    },
    {
      source: session.mediumStagingKey,
      target: final.mediumKey,
      sha256: session.mediumSha256,
      byteSize: session.mediumByteSize,
    },
    {
      source: session.smallStagingKey,
      target: final.smallKey,
      sha256: session.smallSha256,
      byteSize: session.smallByteSize,
    },
  ]
  await Promise.all(
    copies.map(async (item) => {
      await storage.copyToPublic(item.source, item.target, item.sha256)
      const stored = await storage.headPublic(item.target)
      if (
        stored.contentLength !== item.byteSize ||
        stored.contentType !== "image/webp" ||
        stored.cacheControl !== cacheControl
      )
        throw new Error(`Stored cover verification failed for ${item.target}`)
    })
  )
  return final
}

async function abandon(
  database: Database,
  storage: CoverStorage,
  operationId: string,
  objectKeys: ReturnType<typeof keys>,
  now: Date
) {
  await Promise.allSettled(
    Object.values(objectKeys).map((key) => storage.delete(key))
  )
  await database
    .update(coverUploadOperation)
    .set({ state: "cleaning", updatedAt: now })
    .where(
      and(
        eq(coverUploadOperation.id, operationId),
        eq(coverUploadOperation.state, "pending")
      )
    )
}

export function registerMangaCoverRoute(
  app: OpenAPIHono,
  dependencies: Dependencies
) {
  app.use(coverPath, async (c, next) => {
    if (!dependencies.storage)
      return c.json(
        apiError(
          "STORAGE_UNAVAILABLE",
          "Cover upload is not configured",
          c.get("requestId")
        ),
        503
      )
    await next()
  })
  app.use(
    coverPath,
    bodyLimit({
      maxSize: COVER_MULTIPART_MAX_BYTES,
      onError: (c) =>
        c.json(
          apiError(
            "PAYLOAD_TOO_LARGE",
            "Cover requests must not exceed 5 MiB",
            c.get("requestId")
          ),
          413
        ),
    })
  )
  app.use(stagePath, async (c, next) => {
    if (!dependencies.stagingStorage)
      return c.json(
        apiError(
          "STORAGE_UNAVAILABLE",
          "Cover staging is not configured",
          c.get("requestId")
        ),
        503
      )
    await next()
  })
  app.use(
    stagePath,
    bodyLimit({
      maxSize: COVER_MULTIPART_MAX_BYTES,
      onError: (c) =>
        c.json(
          apiError(
            "PAYLOAD_TOO_LARGE",
            "Cover requests must not exceed 5 MiB",
            c.get("requestId")
          ),
          413
        ),
    })
  )
  app.openapi(routes.stageMangaCoverRoute, async (c) => {
    const storage = dependencies.stagingStorage!
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { cover: file, mangaId, expectedVersion } = c.req.valid("form")
    await dependencies.database.transaction(async (tx) => {
      if (mangaId)
        await requireMangaPermission(tx, actor, groupId, mangaId, {
          expectedVersion,
        })
      else await authorizeMangaCreate(tx, actor, groupId)
    })
    const image = await processCover(file)
    const now = dependencies.now?.() ?? new Date()
    const expiresAt = addHours(now, sessionTtlHours)
    const id = randomUUID()
    const [session] = await dependencies.database
      .insert(coverUploadSession)
      .values({
        id,
        mangaId: mangaId ?? null,
        groupId,
        actorUserId: actor,
        createFlow: !mangaId,
        ...stagingKeys(id),
        originalSha256: sha256(image.full),
        mediumSha256: sha256(image.medium),
        smallSha256: sha256(image.small),
        originalByteSize: image.full.byteLength,
        mediumByteSize: image.medium.byteLength,
        smallByteSize: image.small.byteLength,
        width: image.width,
        height: image.height,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!session) throw new Error("Cover upload session was not created")

    try {
      const writes = await Promise.allSettled([
        putVerified(storage, session.originalStagingKey, image.full, ""),
        putVerified(storage, session.mediumStagingKey, image.medium, ""),
        putVerified(storage, session.smallStagingKey, image.small, ""),
      ])
      const failed = writes.find((write) => write.status === "rejected")
      if (failed) throw failed.reason
    } catch (error) {
      await dependencies.database
        .update(coverUploadSession)
        .set({ state: "cleaning", updatedAt: now })
        .where(eq(coverUploadSession.id, session.id))
      try {
        await deleteStagedObjects(storage, session, false)
        await dependencies.database
          .update(coverUploadSession)
          .set({ state: "cleaned", stagingCleanedAt: now, updatedAt: now })
          .where(eq(coverUploadSession.id, session.id))
      } catch {
        // The cleanup command retries sessions left in cleaning state.
      }
      dependencies.logger("error", "cover.staging_failed", {
        sessionId: session.id,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover storage is unavailable")
    }

    return c.json(
      {
        data: {
          id: session.id,
          previewUrl: new URL(coverPreviewPath(session.id), c.req.url).href,
          width: session.width,
          height: session.height,
          expiresAt: expiresAt.toISOString(),
        },
      },
      201
    )
  })

  app.openapi(routes.previewMangaCoverUploadRoute, async (c) => {
    const storage = dependencies.stagingStorage
    if (!storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover staging is unavailable")
    const { file } = c.req.valid("param")
    const sessionId = file.slice(0, -".webp".length)
    const now = dependencies.now?.() ?? new Date()
    const [session] = await dependencies.database
      .select({
        expiresAt: coverUploadSession.expiresAt,
        key: coverUploadSession.mediumStagingKey,
        state: coverUploadSession.state,
      })
      .from(coverUploadSession)
      .where(eq(coverUploadSession.id, sessionId))
      .limit(1)
    if (!session) groupFailure(404, "NOT_FOUND", "Cover session not found")
    if (session.state !== "pending" || session.expiresAt <= now)
      groupFailure(
        409,
        "COVER_SESSION_CHANGED",
        "Cover session is no longer available"
      )

    try {
      const source = await fetch(
        await storage.previewUrl(session.key, privatePreviewFetchSeconds),
        { signal: AbortSignal.timeout(30_000) }
      )
      if (!source.ok || !source.body)
        throw new Error(`Cover preview returned ${source.status}`)
      return new Response(source.body, {
        headers: {
          "Cache-Control": "public, max-age=300",
          "Content-Type": "image/webp",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch (error) {
      dependencies.logger("error", "cover.staging_preview_failed", {
        sessionId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover storage is unavailable")
    }
  })

  app.openapi(routes.uploadMangaCoverRoute, async (c) => {
    const storage = dependencies.storage!
    const actor = c.get("accountUserId")
    const { groupId, mangaId } = c.req.valid("param")
    const { cover: file, expectedVersion } = c.req.valid("form")

    await dependencies.database.transaction((tx) =>
      requireMangaPermission(tx, actor, groupId, mangaId, { expectedVersion })
    )
    const image = await processCover(file)

    const startedAt = dependencies.now?.() ?? new Date()
    const operation = await dependencies.database.transaction(async (tx) => {
      await requireMangaPermission(tx, actor, groupId, mangaId, {
        expectedVersion,
      })
      const [created] = await tx
        .insert(coverUploadOperation)
        .values({
          mangaId,
          groupId,
          actorUserId: actor,
          originalKey: "pending",
          mediumKey: "pending",
          smallKey: "pending",
          expiresAt: addHours(startedAt, 3),
          createdAt: startedAt,
          updatedAt: startedAt,
        })
        .returning({ id: coverUploadOperation.id })
      if (!created) throw new Error("Cover operation was not created")
      const objectKeys = keys(mangaId, created.id)
      await tx
        .update(coverUploadOperation)
        .set(objectKeys)
        .where(eq(coverUploadOperation.id, created.id))
      return { id: created.id, keys: objectKeys }
    })
    const operationId = operation.id
    const objectKeys = operation.keys

    try {
      const writes = await Promise.allSettled([
        putVerified(storage, objectKeys.originalKey, image.full),
        putVerified(storage, objectKeys.mediumKey, image.medium),
        putVerified(storage, objectKeys.smallKey, image.small),
      ])
      const failed = writes.find((write) => write.status === "rejected")
      if (failed) throw failed.reason
    } catch (error) {
      await abandon(
        dependencies.database,
        storage,
        operationId,
        objectKeys,
        dependencies.now?.() ?? new Date()
      )
      dependencies.logger("error", "cover.storage_failed", {
        mangaId,
        operationId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover storage is unavailable")
    }

    try {
      const result = await dependencies.database.transaction(async (tx) => {
        const committedAt = dependencies.now?.() ?? new Date()
        const [operation] = await tx
          .select({
            actorUserId: coverUploadOperation.actorUserId,
            groupId: coverUploadOperation.groupId,
            mangaId: coverUploadOperation.mangaId,
            state: coverUploadOperation.state,
          })
          .from(coverUploadOperation)
          .where(eq(coverUploadOperation.id, operationId))
          .for("update")
        if (
          !operation ||
          operation.actorUserId !== actor ||
          operation.groupId !== groupId ||
          operation.mangaId !== mangaId
        )
          groupFailure(404, "NOT_FOUND", "Cover operation not found")
        if (operation.state !== "pending")
          groupFailure(
            409,
            "COVER_OPERATION_CHANGED",
            "Cover operation changed"
          )

        const { target } = await requireMangaPermission(
          tx,
          actor,
          groupId,
          mangaId,
          { expectedVersion }
        )
        const [previous] = await tx
          .select({ id: cover.id, storageKey: cover.storageKey })
          .from(cover)
          .where(and(eq(cover.mangaId, mangaId), eq(cover.isPrimary, true)))
          .for("update")
        await tx
          .update(cover)
          .set({ isPrimary: false, updatedAt: committedAt })
          .where(and(eq(cover.mangaId, mangaId), eq(cover.isPrimary, true)))
        await tx.insert(cover).values({
          id: operationId,
          mangaId,
          storageKey: objectKeys.originalKey,
          width: image.width,
          height: image.height,
          isPrimary: true,
          createdAt: committedAt,
          updatedAt: committedAt,
        })
        const [updated] = await tx
          .update(manga)
          .set({
            updatedAt: committedAt,
            version: sql`${manga.version} + 1`,
          })
          .where(and(eq(manga.id, mangaId), eq(manga.version, expectedVersion)))
          .returning({ version: manga.version })
        if (!updated)
          groupFailure(
            409,
            "STALE_MANGA",
            "Manga changed since it was loaded",
            [
              {
                path: "expectedVersion",
                message: `Current version is ${target.version}`,
              },
            ]
          )
        await tx.insert(moderationAction).values({
          actorUserId: actor,
          action: previous ? "manga.cover_replaced" : "manga.cover_attached",
          targetKind: "manga",
          targetId: mangaId,
          reason: previous ? "Manga cover replaced" : "Manga cover attached",
          before: previous ?? null,
          after: { id: operationId, storageKey: objectKeys.originalKey },
          createdAt: committedAt,
        })
        await tx
          .update(coverUploadOperation)
          .set({
            state: "attached",
            attachedAt: committedAt,
            updatedAt: committedAt,
          })
          .where(eq(coverUploadOperation.id, operationId))
        return {
          url: resolveCoverUrl(
            dependencies.assetBaseUrl,
            objectKeys.originalKey
          ),
          width: image.width,
          height: image.height,
          version: updated.version,
        }
      })
      await dependencies.cache.invalidateCatalog()
      return c.json({ data: result }, 200)
    } catch (error) {
      await abandon(
        dependencies.database,
        storage,
        operationId,
        objectKeys,
        dependencies.now?.() ?? new Date()
      )
      throw error
    }
  })

  app.openapi(routes.commitMangaCoverRoute, async (c) => {
    const storage = dependencies.stagingStorage
    if (!storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover staging is unavailable")
    const actor = c.get("accountUserId")
    const { groupId, mangaId, sessionId } = c.req.valid("param")
    const { expectedVersion } = c.req.valid("json")
    const now = dependencies.now?.() ?? new Date()
    const [staged] = await dependencies.database
      .select({ createFlow: coverUploadSession.createFlow })
      .from(coverUploadSession)
      .where(
        and(
          eq(coverUploadSession.id, sessionId),
          eq(coverUploadSession.groupId, groupId),
          eq(coverUploadSession.actorUserId, actor)
        )
      )
      .limit(1)
    if (!staged) groupFailure(404, "NOT_FOUND", "Cover session not found")
    const session = await dependencies.database.transaction(async (tx) => {
      await requireMangaPermission(tx, actor, groupId, mangaId, {
        expectedVersion,
        createFlow: staged.createFlow,
      })
      const [row] = await tx
        .select()
        .from(coverUploadSession)
        .where(
          and(
            eq(coverUploadSession.id, sessionId),
            eq(coverUploadSession.groupId, groupId),
            eq(coverUploadSession.actorUserId, actor)
          )
        )
        .for("update")
      if (!row) groupFailure(404, "NOT_FOUND", "Cover session not found")
      if (row.state === "attached") return row
      if (row.state !== "pending" || row.expiresAt <= now)
        groupFailure(
          409,
          "COVER_SESSION_CHANGED",
          "Cover session is no longer available"
        )
      if (row.mangaId && row.mangaId !== mangaId)
        groupFailure(404, "NOT_FOUND", "Cover session not found")
      if (!row.mangaId)
        groupFailure(
          409,
          "COVER_SESSION_CHANGED",
          "Cover session is not attached to this manga"
        )
      return row
    })
    if (session.state === "attached")
      return c.json(
        {
          data: await attachedCoverResult(
            dependencies.database,
            dependencies.assetBaseUrl,
            mangaId,
            sessionId
          ),
        },
        200
      )

    let objectKeys: ReturnType<typeof keys>
    try {
      objectKeys = await copyStagedCover(storage, session)
    } catch (error) {
      dependencies.logger("error", "cover.staging_copy_failed", {
        mangaId,
        sessionId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover storage is unavailable")
    }

    const result = await dependencies.database.transaction(async (tx) => {
      const committedAt = dependencies.now?.() ?? new Date()
      const { target } = await requireMangaPermission(
        tx,
        actor,
        groupId,
        mangaId,
        { expectedVersion, createFlow: session.createFlow }
      )
      const [current] = await tx
        .select()
        .from(coverUploadSession)
        .where(
          and(
            eq(coverUploadSession.id, sessionId),
            eq(coverUploadSession.groupId, groupId),
            eq(coverUploadSession.actorUserId, actor),
            eq(coverUploadSession.mangaId, mangaId)
          )
        )
        .for("update")
      if (!current) groupFailure(404, "NOT_FOUND", "Cover session not found")
      if (current.state === "attached") return null
      if (current.state !== "pending" || current.expiresAt <= committedAt)
        groupFailure(
          409,
          "COVER_SESSION_CHANGED",
          "Cover session is no longer available"
        )
      const [previous] = await tx
        .select({ id: cover.id, storageKey: cover.storageKey })
        .from(cover)
        .where(and(eq(cover.mangaId, mangaId), eq(cover.isPrimary, true)))
        .for("update")
      await tx
        .update(cover)
        .set({ isPrimary: false, updatedAt: committedAt })
        .where(and(eq(cover.mangaId, mangaId), eq(cover.isPrimary, true)))
      await tx.insert(cover).values({
        id: sessionId,
        mangaId,
        storageKey: objectKeys.originalKey,
        width: current.width,
        height: current.height,
        isPrimary: true,
        createdAt: committedAt,
        updatedAt: committedAt,
      })
      const [updated] = await tx
        .update(manga)
        .set({
          updatedAt: committedAt,
          version: sql`${manga.version} + 1`,
        })
        .where(and(eq(manga.id, mangaId), eq(manga.version, expectedVersion)))
        .returning({ version: manga.version })
      if (!updated)
        groupFailure(409, "STALE_MANGA", "Manga changed since it was loaded", [
          {
            path: "expectedVersion",
            message: `Current version is ${target.version}`,
          },
        ])
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: previous ? "manga.cover_replaced" : "manga.cover_attached",
        targetKind: "manga",
        targetId: mangaId,
        reason: previous ? "Manga cover replaced" : "Manga cover attached",
        before: previous ?? null,
        after: { id: sessionId, storageKey: objectKeys.originalKey },
        createdAt: committedAt,
      })
      await tx
        .update(coverUploadSession)
        .set({
          state: "attached",
          attachedAt: committedAt,
          updatedAt: committedAt,
        })
        .where(eq(coverUploadSession.id, sessionId))
      return {
        url: resolveCoverUrl(dependencies.assetBaseUrl, objectKeys.originalKey),
        width: current.width,
        height: current.height,
        version: updated.version,
      }
    })
    const response =
      result ??
      (await attachedCoverResult(
        dependencies.database,
        dependencies.assetBaseUrl,
        mangaId,
        sessionId
      ))
    try {
      await deleteStagedObjects(storage, session, false)
      await dependencies.database
        .update(coverUploadSession)
        .set({ stagingCleanedAt: dependencies.now?.() ?? new Date() })
        .where(eq(coverUploadSession.id, sessionId))
    } catch (error) {
      dependencies.logger("warn", "cover.staging_cleanup_failed", {
        mangaId,
        sessionId,
        ...errorFields(error, true),
      })
    }
    await dependencies.cache.invalidateCatalog()
    return c.json({ data: response }, 200)
  })

  app.openapi(routes.cancelMangaCoverUploadRoute, async (c) => {
    const storage = dependencies.stagingStorage
    if (!storage)
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover staging is unavailable")
    const actor = c.get("accountUserId")
    const { groupId, sessionId } = c.req.valid("param")
    const now = dependencies.now?.() ?? new Date()
    const session = await dependencies.database.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(coverUploadSession)
        .where(
          and(
            eq(coverUploadSession.id, sessionId),
            eq(coverUploadSession.groupId, groupId),
            eq(coverUploadSession.actorUserId, actor)
          )
        )
        .for("update")
      if (!row) groupFailure(404, "NOT_FOUND", "Cover session not found")
      if (row.state === "attached")
        groupFailure(409, "COVER_SESSION_CHANGED", "Cover is already attached")
      if (row.state === "cleaned") return null
      await tx
        .update(coverUploadSession)
        .set({ state: "cleaning", updatedAt: now })
        .where(eq(coverUploadSession.id, sessionId))
      return row
    })
    if (!session) return c.body(null, 204)
    try {
      await deleteStagedObjects(storage, session, true)
      await dependencies.database
        .update(coverUploadSession)
        .set({ state: "cleaned", stagingCleanedAt: now, updatedAt: now })
        .where(eq(coverUploadSession.id, sessionId))
    } catch (error) {
      dependencies.logger("error", "cover.staging_cleanup_failed", {
        sessionId,
        ...errorFields(error, true),
      })
      groupFailure(503, "STORAGE_UNAVAILABLE", "Cover storage is unavailable")
    }
    return c.body(null, 204)
  })
}

export async function cleanupCoverUploads(
  database: Database,
  storage: CoverStorage,
  options: { apply: boolean; limit?: number; now?: Date }
) {
  const now = options.now ?? new Date()
  const staleClaim = subMinutes(now, 2)
  const candidates = await database
    .select()
    .from(coverUploadOperation)
    .where(
      or(
        and(
          eq(coverUploadOperation.state, "pending"),
          lte(coverUploadOperation.expiresAt, now)
        ),
        and(
          eq(coverUploadOperation.state, "cleaning"),
          lte(coverUploadOperation.updatedAt, staleClaim)
        )
      )
    )
    .orderBy(coverUploadOperation.expiresAt, coverUploadOperation.id)
    .limit(Math.min(options.limit ?? 100, 100))
  if (!options.apply)
    return candidates.map((row) => ({ id: row.id, state: row.state }))

  const cleaned: Array<{ id: string; state: "cleaned" | "cleaning" }> = []
  for (const candidate of candidates) {
    const claim = await database.transaction(async (tx) => {
      const [operation] = await tx
        .select()
        .from(coverUploadOperation)
        .where(eq(coverUploadOperation.id, candidate.id))
        .for("update")
      if (!operation) return null
      const [reference] = await tx
        .select({ id: cover.id })
        .from(cover)
        .where(eq(cover.id, operation.id))
      if (reference) {
        await tx
          .update(coverUploadOperation)
          .set({ state: "attached", attachedAt: now, updatedAt: now })
          .where(eq(coverUploadOperation.id, operation.id))
        return null
      }
      const eligible =
        (operation.state === "pending" && operation.expiresAt <= now) ||
        (operation.state === "cleaning" && operation.updatedAt <= staleClaim)
      if (!eligible) return null
      await tx
        .update(coverUploadOperation)
        .set({ state: "cleaning", updatedAt: now })
        .where(eq(coverUploadOperation.id, operation.id))
      return { operation, finalize: operation.state === "cleaning" }
    })
    if (!claim) continue
    await Promise.all([
      storage.delete(claim.operation.originalKey),
      storage.delete(claim.operation.mediumKey),
      storage.delete(claim.operation.smallKey),
    ])
    if (claim.finalize)
      await database
        .update(coverUploadOperation)
        .set({ state: "cleaned", updatedAt: now })
        .where(
          and(
            eq(coverUploadOperation.id, claim.operation.id),
            eq(coverUploadOperation.state, "cleaning"),
            eq(coverUploadOperation.updatedAt, now)
          )
        )
    cleaned.push({
      id: claim.operation.id,
      state: claim.finalize ? "cleaned" : "cleaning",
    })
  }
  return cleaned
}

export async function cleanupCoverUploadSessions(
  database: Database,
  storage: ChapterStorage,
  options: { apply: boolean; limit?: number; now?: Date }
) {
  const now = options.now ?? new Date()
  const staleClaim = subMinutes(now, 2)
  const candidates = await database
    .select()
    .from(coverUploadSession)
    .where(
      or(
        and(
          eq(coverUploadSession.state, "pending"),
          lte(coverUploadSession.expiresAt, now)
        ),
        and(
          eq(coverUploadSession.state, "cleaning"),
          lte(coverUploadSession.updatedAt, staleClaim)
        ),
        and(
          eq(coverUploadSession.state, "attached"),
          isNull(coverUploadSession.stagingCleanedAt)
        )
      )
    )
    .orderBy(coverUploadSession.expiresAt, coverUploadSession.id)
    .limit(Math.min(options.limit ?? 100, 100))
  if (!options.apply)
    return candidates.map((row) => ({ id: row.id, state: row.state }))

  const cleaned: Array<{
    id: string
    state: "attached" | "cleaned" | "cleaning"
  }> = []
  for (const candidate of candidates) {
    const claim = await database.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(coverUploadSession)
        .where(eq(coverUploadSession.id, candidate.id))
        .for("update")
      if (!session) return null
      if (session.state === "attached" && !session.stagingCleanedAt)
        return { session, attached: true }
      const eligible =
        (session.state === "pending" && session.expiresAt <= now) ||
        (session.state === "cleaning" && session.updatedAt <= staleClaim)
      if (!eligible) return null
      await tx
        .update(coverUploadSession)
        .set({ state: "cleaning", updatedAt: now })
        .where(eq(coverUploadSession.id, session.id))
      return { session, attached: false }
    })
    if (!claim) continue
    try {
      await deleteStagedObjects(storage, claim.session, !claim.attached)
      await database
        .update(coverUploadSession)
        .set(
          claim.attached
            ? { stagingCleanedAt: now, updatedAt: now }
            : {
                state: "cleaned",
                stagingCleanedAt: now,
                updatedAt: now,
              }
        )
        .where(eq(coverUploadSession.id, claim.session.id))
      cleaned.push({
        id: claim.session.id,
        state: claim.attached ? "attached" : "cleaned",
      })
    } catch {
      cleaned.push({
        id: claim.session.id,
        state: claim.attached ? "attached" : "cleaning",
      })
    }
  }
  return cleaned
}
