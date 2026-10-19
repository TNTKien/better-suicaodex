import { randomUUID } from "node:crypto"
import type { OpenAPIHono } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"
import { freshSessionUser } from "../account/guard.js"
import type { Auth } from "../account/auth.js"
import { ensureUserProfile, loadCurrentAccount } from "../account/routes.js"
import {
  GroupError,
  groupFailure,
  requireGroupAdmin,
} from "../groups/service.js"
import { apiError } from "../../shared/contract.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import { frameLimits, normalizeFrame } from "../../shared/avatar-frame-media.js"
import { ImageTransformBusyError } from "../../shared/image-transform.js"
import { putProfileMedia } from "../../shared/profile-media.js"
import type { MediaStorage } from "../../shared/storage.js"
import type { Logger } from "../../shared/logger.js"
import type { BusinessCache } from "../../shared/cache.js"
import type { FrameProjection } from "./projection.js"
import {
  createAvatarFrameRoute,
  equipAvatarFrameRoute,
  grantAvatarFrameRoute,
  listAvatarFramesRoute,
  ownAvatarFramesRoute,
  revokeAvatarFrameRoute,
  unequipAvatarFrameRoute,
  updateAvatarFrameRoute,
  updateAvatarFrameShopRoute,
  uploadAvatarFrameRoute,
  userAvatarFramesRoute,
  listFrameTopicsRoute,
  createFrameTopicRoute,
  updateFrameTopicRoute,
  deleteFrameTopicRoute,
} from "./contract.js"
import {
  AvatarFrameCommitUnknownError,
  adminFrame,
  createAvatarFrame,
  equipAvatarFrame,
  frameInventory,
  listAvatarFrames,
  preflightFrameUpload,
  publishAvatarFrame,
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
  listFrameTopics,
  saveFrameTopic,
  deleteFrameTopic,
} from "./service.js"

type Dependencies = FrameProjection & {
  auth?: Auth
  storage?: MediaStorage
  logger?: Logger
  cache?: BusinessCache
  webOrigin: WebOrigins
}
export function registerAvatarFrameRoutes(
  app: OpenAPIHono,
  deps: Dependencies
) {
  const bases = [
    "/v1/admin/avatar-frames/*",
    "/v1/admin/avatar-frame-topics/*",
    "/v1/admin/users/:userId/avatar-frames/*",
    "/v1/me/avatar-frame",
    "/v1/me/avatar-frames",
  ]
  for (const base of bases) {
    app.use(base, async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      const identity = await freshSessionUser(deps.auth, c.req.raw.headers)
      if (!identity)
        groupFailure(401, "UNAUTHORIZED", "Authentication is required")
      c.set("accountUserId", identity.id)
      if (c.req.path.startsWith("/v1/admin/"))
        await requireGroupAdmin(deps.database, identity.id)
      if (
        !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
        !isTrustedWebOrigin(c.req.header("Origin"), deps.webOrigin)
      )
        groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
      await next()
    })
    const smallBody = bodyLimit({
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
    const uploadBody = bodyLimit({
      maxSize: frameLimits.sourceBytes + 64 * 1024,
      onError: (c) =>
        c.json(
          apiError(
            "PAYLOAD_TOO_LARGE",
            "Frame must not exceed 10 MiB",
            c.get("requestId")
          ),
          413
        ),
    })
    app.use(base, (c, next) =>
      (c.req.method === "POST" &&
        /^\/v1\/admin\/avatar-frames\/[^/]+\/asset$/.test(c.req.path)
        ? uploadBody
        : smallBody)(c, next)
    )
  }
  app.openapi(listFrameTopicsRoute, async (c) =>
    c.json(await listFrameTopics(deps.database), 200)
  )
  app.openapi(createFrameTopicRoute, async (c) =>
    c.json(
      await saveFrameTopic(
        deps.database,
        c.get("accountUserId"),
        c.req.valid("json")
      ),
      201
    )
  )
  app.openapi(updateFrameTopicRoute, async (c) =>
    c.json(
      await saveFrameTopic(
        deps.database,
        c.get("accountUserId"),
        c.req.valid("json"),
        {
          id: c.req.valid("param").id,
          expectedVersion: c.req.valid("json").expectedVersion,
        }
      ),
      200
    )
  )
  app.openapi(deleteFrameTopicRoute, async (c) => {
    const result = await deleteFrameTopic(
      deps.database,
      c.get("accountUserId"),
      c.req.valid("param").id,
      c.req.valid("json").expectedVersion
    )
    await deps.cache?.invalidateCatalog()
    return c.json(result, 200)
  })
  app.openapi(listAvatarFramesRoute, async (c) =>
    c.json(await listAvatarFrames(deps, c.req.valid("query")), 200)
  )
  app.openapi(createAvatarFrameRoute, async (c) =>
    c.json(
      {
        data: adminFrame(
          await createAvatarFrame(
            deps.database,
            c.get("accountUserId"),
            c.req.valid("json")
          ),
          deps.assetBaseUrl ?? ""
        ),
      },
      201
    )
  )
  app.openapi(updateAvatarFrameRoute, async (c) => {
    const row = await updateAvatarFrame(
      deps.database,
      c.get("accountUserId"),
      c.req.valid("param").id,
      c.req.valid("json")
    )
    await deps.cache?.invalidateCatalog()
    return c.json({ data: adminFrame(row, deps.assetBaseUrl ?? "") }, 200)
  })
  app.openapi(updateAvatarFrameShopRoute, async (c) =>
    c.json(
      {
        data: adminFrame(
          await updateAvatarFrameShop(
            deps.database,
            c.get("accountUserId"),
            c.req.valid("param").id,
            c.req.valid("json")
          ),
          deps.assetBaseUrl ?? ""
        ),
      },
      200
    )
  )
  app.openapi(ownAvatarFramesRoute, async (c) =>
    c.json(
      await frameInventory(deps, c.get("accountUserId"), c.req.valid("query")),
      200
    )
  )
  app.openapi(userAvatarFramesRoute, async (c) =>
    c.json(
      await frameInventory(
        deps,
        c.req.valid("param").userId,
        c.req.valid("query")
      ),
      200
    )
  )
  app.openapi(grantAvatarFrameRoute, async (c) => {
    const { userId, frameId } = c.req.valid("param")
    const result = await setFrameOwnership(
      deps.database,
      c.get("accountUserId"),
      userId,
      frameId,
      true,
      c.req.valid("json").reason
    )
    return c.json(result, 200)
  })
  app.openapi(revokeAvatarFrameRoute, async (c) => {
    const { userId, frameId } = c.req.valid("param")
    const result = await setFrameOwnership(
      deps.database,
      c.get("accountUserId"),
      userId,
      frameId,
      false,
      c.req.valid("json").reason
    )
    if (result.changed) await deps.cache?.invalidateCatalog()
    return c.json(result, 200)
  })
  app.openapi(equipAvatarFrameRoute, async (c) => {
    const userId = c.get("accountUserId")
    await ensureUserProfile(deps.database, userId)
    await equipAvatarFrame(
      deps.database,
      userId,
      c.req.valid("json").frameId,
      deps.avatarFramesEnabled ?? false
    )
    await deps.cache?.invalidateCatalog()
    return c.json(await loadCurrentAccount(deps, userId), 200)
  })
  app.openapi(unequipAvatarFrameRoute, async (c) => {
    const userId = c.get("accountUserId")
    await ensureUserProfile(deps.database, userId)
    await equipAvatarFrame(
      deps.database,
      userId,
      null,
      deps.avatarFramesEnabled ?? false
    )
    await deps.cache?.invalidateCatalog()
    return c.json(await loadCurrentAccount(deps, userId), 200)
  })
  app.openapi(uploadAvatarFrameRoute, async (c) => {
    if (!deps.storage || !deps.assetBaseUrl)
      groupFailure(
        503,
        "MEDIA_STORAGE_UNAVAILABLE",
        "Frame storage is unavailable"
      )
    const { id } = c.req.valid("param")
    const { file, expectedVersion } = c.req.valid("form")
    if (file.size > frameLimits.sourceBytes)
      groupFailure(413, "PAYLOAD_TOO_LARGE", "Frame must not exceed 10 MiB")
    await preflightFrameUpload(deps.database, id, expectedVersion)
    let result: Awaited<ReturnType<typeof normalizeFrame>>
    try {
      result = await normalizeFrame(Buffer.from(await file.arrayBuffer()))
    } catch (error) {
      if (error instanceof ImageTransformBusyError)
        groupFailure(429, "IMAGE_PROCESSOR_BUSY", "The image processor is busy")
      groupFailure(
        400,
        "INVALID_AVATAR_FRAME",
        "Frame format, dimensions, frames or animation could not be preserved within limits"
      )
    }
    const prefix = `avatar-frames/${id}/${randomUUID()}`
    const keys = {
      asset: `${prefix}/frame.webp`,
      preview: `${prefix}/preview.webp`,
    }
    let published = false
    try {
      await putProfileMedia(deps.storage, keys.asset, result.asset)
      await putProfileMedia(deps.storage, keys.preview, result.preview)
      const row = await publishAvatarFrame(
        deps.database,
        c.get("accountUserId"),
        id,
        expectedVersion,
        keys,
        result
      )
      published = true
      await deps.cache?.invalidateCatalog()
      return c.json({ data: adminFrame(row, deps.assetBaseUrl) }, 200)
    } catch (error) {
      // Only a failure before COMMIT permits deletion. Absence in a concurrent
      // read cannot prove an ambiguous commit failed; retain those exact objects.
      if (!published) {
        if (!(error instanceof AvatarFrameCommitUnknownError))
          for (const key of [keys.asset, keys.preview]) {
            try {
              await deps.storage.delete(key)
            } catch {
              deps.logger?.("warn", "avatar_frame.cleanup_failed", { key })
            }
          }
        else
          deps.logger?.("warn", "avatar_frame.publication_uncertain", {
            frameId: id,
            assetKey: keys.asset,
            previewKey: keys.preview,
          })
      }
      if (error instanceof GroupError) throw error
      deps.logger?.("warn", "avatar_frame.publication_failed", { frameId: id })
      groupFailure(
        503,
        "MEDIA_STORAGE_UNAVAILABLE",
        "Frame publication failed; reload before retrying"
      )
    }
  })
}
