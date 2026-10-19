import type { OpenAPIHono } from "@hono/zod-openapi"
import { eq } from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"

import { organization, translationGroupProfile } from "../../db/schema.js"
import type { Database } from "../../db/client.js"
import type { BusinessCache } from "../../shared/cache.js"
import { apiError } from "../../shared/contract.js"
import { errorFields, type Logger } from "../../shared/logger.js"
import {
  ownedProfileMediaKey,
  PROFILE_MEDIA_MAX_INPUT_BYTES,
  PROFILE_MEDIA_MULTIPART_MAX_BYTES,
  ProfileMediaBusyError,
  ProfileMediaError,
  type ProfileMediaKind,
  profileMediaKey,
  profileMediaUrl,
  putProfileMedia,
  transformProfileMedia,
} from "../../shared/profile-media.js"
import type { MediaStorage } from "../../shared/storage.js"
import * as routes from "./contract.js"
import {
  auditGroup,
  groupDto,
  groupFailure,
  groupWrite,
  lockGroup,
  requireGroupSettingsManager,
} from "./service.js"

type Dependencies = {
  assetBaseUrl: string
  cache: BusinessCache
  database: Database
  logger: Logger
  storage?: MediaStorage
}

type GroupMediaKind = Extract<ProfileMediaKind, "group-avatar" | "group-banner">

export const isGroupMediaUpload = (method: string, path: string) =>
  method === "POST" &&
  /^\/v1\/contribution\/groups\/[^/]+\/(?:avatar|banner)$/.test(path)

function prefix(kind: GroupMediaKind, groupId: string) {
  return `groups/${groupId}/${kind === "group-avatar" ? "avatars" : "banners"}/`
}

async function cleanup(
  dependencies: Dependencies,
  value: string | null,
  kind: GroupMediaKind,
  groupId: string
) {
  const key = ownedProfileMediaKey(
    value,
    dependencies.assetBaseUrl,
    prefix(kind, groupId)
  )
  if (!dependencies.storage || !key) return
  try {
    await dependencies.storage.delete(key)
  } catch (error) {
    dependencies.logger("warn", "group_media.cleanup_failed", {
      groupId,
      key,
      ...errorFields(error, false),
    })
  }
}

async function authorize(
  dependencies: Dependencies,
  actor: string,
  groupId: string
) {
  return groupWrite(dependencies.database, actor, async (tx) => {
    const group = await lockGroup(tx, groupId)
    await requireGroupSettingsManager(tx, group, actor)
    return group
  })
}

async function updateGroupMedia(
  dependencies: Dependencies,
  actor: string,
  groupId: string,
  kind: GroupMediaKind,
  url: string | null
) {
  return groupWrite(dependencies.database, actor, async (tx) => {
    const group = await lockGroup(tx, groupId)
    await requireGroupSettingsManager(tx, group, actor)
    const before = kind === "group-avatar" ? group.avatarUrl : group.bannerUrl
    if (before === url) return { data: groupDto(group), previousUrl: before }

    if (kind === "group-avatar") {
      await tx
        .update(organization)
        .set({ logo: url })
        .where(eq(organization.id, groupId))
    } else {
      await tx
        .update(translationGroupProfile)
        .set({ bannerUrl: url })
        .where(eq(translationGroupProfile.organizationId, groupId))
    }
    await tx
      .update(translationGroupProfile)
      .set({ updatedAt: new Date() })
      .where(eq(translationGroupProfile.organizationId, groupId))

    const updated = await lockGroup(tx, groupId)
    const target = kind === "group-avatar" ? "avatar" : "banner"
    await auditGroup(
      tx,
      actor,
      groupId,
      url ? `group_${target}_updated` : `group_${target}_removed`,
      url ? `Group ${target} updated` : `Group ${target} removed`,
      { [`${target}Url`]: before },
      { [`${target}Url`]: url }
    )
    return { data: groupDto(updated), previousUrl: before }
  })
}

async function processImage(file: File, kind: GroupMediaKind) {
  if (file.size > PROFILE_MEDIA_MAX_INPUT_BYTES)
    groupFailure(413, "PAYLOAD_TOO_LARGE", "Image must not exceed 5 MiB")
  try {
    return await transformProfileMedia(
      new Uint8Array(await file.arrayBuffer()),
      kind
    )
  } catch (error) {
    if (error instanceof ProfileMediaBusyError)
      groupFailure(429, "IMAGE_PROCESSOR_BUSY", error.message)
    if (error instanceof ProfileMediaError)
      groupFailure(400, "INVALID_GROUP_IMAGE", error.message)
    throw error
  }
}

export function registerGroupMediaRoutes(
  app: OpenAPIHono,
  dependencies: Dependencies
) {
  const imageBodyLimit = bodyLimit({
    maxSize: PROFILE_MEDIA_MULTIPART_MAX_BYTES,
    onError: (c) =>
      c.json(
        apiError(
          "PAYLOAD_TOO_LARGE",
          "Image must not exceed 5 MiB",
          c.get("requestId")
        ),
        413
      ),
  })
  app.use("/v1/contribution/groups/*", (c, next) =>
    isGroupMediaUpload(c.req.method, c.req.path)
      ? imageBodyLimit(c, next)
      : next()
  )

  const upload = async (
    actor: string,
    groupId: string,
    file: File,
    kind: GroupMediaKind
  ) => {
    await authorize(dependencies, actor, groupId)
    if (!dependencies.storage)
      groupFailure(
        503,
        "MEDIA_STORAGE_UNAVAILABLE",
        "Group media storage is unavailable"
      )
    const data = await processImage(file, kind)
    const key = profileMediaKey(kind, groupId)
    const url = profileMediaUrl(dependencies.assetBaseUrl, key)
    try {
      await putProfileMedia(dependencies.storage, key, data)
    } catch (error) {
      await cleanup(dependencies, url, kind, groupId)
      dependencies.logger("warn", "group_media.store_failed", {
        groupId,
        key,
        ...errorFields(error, false),
      })
      groupFailure(
        503,
        "MEDIA_STORAGE_UNAVAILABLE",
        "Group media storage is unavailable"
      )
    }

    let changed: Awaited<ReturnType<typeof updateGroupMedia>>
    try {
      changed = await updateGroupMedia(dependencies, actor, groupId, kind, url)
    } catch (error) {
      await cleanup(dependencies, url, kind, groupId)
      throw error
    }
    await cleanup(dependencies, changed.previousUrl, kind, groupId)
    await dependencies.cache.invalidateCatalog()
    return changed.data
  }

  const remove = async (
    actor: string,
    groupId: string,
    kind: GroupMediaKind
  ) => {
    const changed = await updateGroupMedia(
      dependencies,
      actor,
      groupId,
      kind,
      null
    )
    await cleanup(dependencies, changed.previousUrl, kind, groupId)
    await dependencies.cache.invalidateCatalog()
    return changed.data
  }

  app.openapi(routes.uploadGroupAvatarRoute, async (c) =>
    c.json(
      {
        data: await upload(
          c.get("accountUserId"),
          c.req.valid("param").groupId,
          c.req.valid("form").image,
          "group-avatar"
        ),
      },
      200
    )
  )
  app.openapi(routes.deleteGroupAvatarRoute, async (c) =>
    c.json(
      {
        data: await remove(
          c.get("accountUserId"),
          c.req.valid("param").groupId,
          "group-avatar"
        ),
      },
      200
    )
  )
  app.openapi(routes.uploadGroupBannerRoute, async (c) =>
    c.json(
      {
        data: await upload(
          c.get("accountUserId"),
          c.req.valid("param").groupId,
          c.req.valid("form").image,
          "group-banner"
        ),
      },
      200
    )
  )
  app.openapi(routes.deleteGroupBannerRoute, async (c) =>
    c.json(
      {
        data: await remove(
          c.get("accountUserId"),
          c.req.valid("param").groupId,
          "group-banner"
        ),
      },
      200
    )
  )
}
