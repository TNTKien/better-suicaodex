import type { OpenAPIHono } from "@hono/zod-openapi"
import { and, asc, count, desc, eq, isNull, or } from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"

import { apiError } from "../../shared/contract.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import type { Database } from "../../db/client.js"
import {
  account,
  chapter,
  comment,
  coinWallet,
  manga,
  member as translationGroupMember,
  organization as translationGroup,
  translationGroupProfile,
  user,
  userProfile,
} from "../../db/schema.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { errorFields, type Logger } from "../../shared/logger.js"
import {
  ownedProfileMediaKey,
  PROFILE_MEDIA_MAX_INPUT_BYTES,
  PROFILE_MEDIA_MULTIPART_MAX_BYTES,
  ProfileMediaBusyError,
  ProfileMediaError,
  profileMediaKey,
  profileMediaUrl,
  putProfileMedia,
  transformProfileMedia,
} from "../../shared/profile-media.js"
import type { MediaStorage } from "../../shared/storage.js"
import {
  normalizeDecimal,
  publicGroup,
  readableChapter,
  visibleManga,
  type CatalogVisibility,
} from "../catalog/routes.js"
import type { Auth } from "./auth.js"
import {
  deleteOwnAvatarRoute,
  getCurrentAccountRoute,
  getPublicProfileRoute,
  uploadOwnAvatarRoute,
  updateOwnProfileRoute,
  type CurrentAccount,
  type PublicProfile,
} from "./contract.js"
import { freshSessionUser } from "./guard.js"
import {
  effectiveAvatarFrames,
  type FrameProjection,
} from "../avatar-frames/projection.js"

export type ProfileDependencies = CatalogVisibility & {
  assetBaseUrl?: string
  avatarFramesEnabled?: boolean
  auth?: Auth
  database: Database
  logger?: Logger
  storage?: MediaStorage
  webOrigin?: WebOrigins
}

const profileSelection = {
  bio: userProfile.bio,
  isPublic: userProfile.isPublic,
  status: userProfile.status,
  createdAt: userProfile.createdAt,
  updatedAt: userProfile.updatedAt,
}

type ProfileRow = {
  bio: string | null
  isPublic: boolean
  status: "active" | "suspended" | "banned"
  createdAt: Date
  updatedAt: Date
}
export async function ensureUserProfile(database: Database, userId: string) {
  await database
    .insert(userProfile)
    .values({ userId })
    .onConflictDoNothing({ target: userProfile.userId })
}

async function loadProfile(database: Database, userId: string) {
  const [profile] = await database
    .select(profileSelection)
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1)
  return profile ?? null
}

async function loadOrCreateProfile(database: Database, userId: string) {
  const existing = await loadProfile(database, userId)
  if (existing) return existing
  await ensureUserProfile(database, userId)
  return loadProfile(database, userId)
}

async function currentAccount(
  database: Database,
  userId: string,
  profile: ProfileRow,
  frames: Omit<FrameProjection, "database">
): Promise<CurrentAccount> {
  const [providers, [identity], [membership]] = await Promise.all([
    database
      .selectDistinct({ id: account.providerId })
      .from(account)
      .where(eq(account.userId, userId))
      .orderBy(asc(account.providerId)),
    database
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        coinBalance: coinWallet.balance,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .leftJoin(coinWallet, eq(coinWallet.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1),
    database
      .select({ role: translationGroupMember.role })
      .from(translationGroupMember)
      .innerJoin(
        translationGroupProfile,
        eq(
          translationGroupProfile.organizationId,
          translationGroupMember.organizationId
        )
      )
      .where(
        and(
          eq(translationGroupMember.userId, userId),
          eq(translationGroupProfile.approvalStatus, "approved"),
          isNull(translationGroupProfile.deletedAt)
        )
      )
      .limit(1),
  ])
  if (!identity) throw new Error("Authenticated user is unavailable")
  const role = identity?.role
    ?.split(",")
    .some((value) => value.trim() === "admin")
    ? "admin"
    : membership?.role === "owner"
      ? "leader"
      : membership
        ? "member"
        : "user"
  return {
    coinBalance: String(identity.coinBalance ?? 0n),
    user: {
      id: identity.id,
      name: identity.name,
      email: identity.email,
      emailVerified: identity.emailVerified,
      image: identity.image ?? null,
      avatarFrame:
        (await effectiveAvatarFrames({ database, ...frames }, [userId])).get(
          userId
        ) ?? null,
      role,
      createdAt: formatTimestamp(identity.createdAt),
      updatedAt: formatTimestamp(identity.updatedAt),
    },
    profile: {
      ...profile,
      createdAt: formatTimestamp(profile.createdAt),
      updatedAt: formatTimestamp(profile.updatedAt),
    },
    linkedProviders: providers.map(({ id }) => id),
  }
}

export async function loadCurrentAccount(
  dependencies: FrameProjection,
  userId: string
) {
  const profile = await loadOrCreateProfile(dependencies.database, userId)
  if (!profile) throw new Error("Authenticated user profile is unavailable")
  return currentAccount(dependencies.database, userId, profile, dependencies)
}

async function replaceUserImage(
  database: Database,
  userId: string,
  image: string | null
) {
  return database.transaction(async (tx) => {
    const [state] = await tx
      .select({
        image: user.image,
        banned: user.banned,
        status: userProfile.status,
      })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, userId))
      .for("update")
    if (!state || state.status !== "active" || state.banned === true)
      return null
    await tx
      .update(user)
      .set({ image, updatedAt: new Date() })
      .where(eq(user.id, userId))
    return { previousImage: state.image }
  })
}

function trustedOrigin(
  origin: string | undefined,
  expected: WebOrigins | undefined
) {
  return expected === undefined || isTrustedWebOrigin(origin, expected)
}

async function cleanupProfileMedia(
  storage: MediaStorage | undefined,
  value: string | null,
  assetBaseUrl: string,
  prefix: string,
  logger: Logger | undefined
) {
  const key = ownedProfileMediaKey(value, assetBaseUrl, prefix)
  if (!storage || !key) return
  try {
    await storage.delete(key)
  } catch (error) {
    logger?.("warn", "profile_media.cleanup_failed", {
      key,
      ...errorFields(error, false),
    })
  }
}

export function registerProfileRoutes(
  app: OpenAPIHono,
  dependencies: ProfileDependencies
) {
  const { auth, database, logger, storage, webOrigin } = dependencies
  const assetBaseUrl = dependencies.assetBaseUrl ?? ""
  const avatarBodyLimit = bodyLimit({
    maxSize: PROFILE_MEDIA_MULTIPART_MAX_BYTES,
    onError: (c) =>
      c.json(
        apiError(
          "PAYLOAD_TOO_LARGE",
          "Avatar must not exceed 5 MiB",
          c.get("requestId")
        ),
        413
      ),
  })
  app.use("/v1/me/avatar", (c, next) =>
    c.req.method === "POST" ? avatarBodyLimit(c, next) : next()
  )

  app.openapi(getCurrentAccountRoute, async (c) => {
    c.header("Cache-Control", "private, no-store")
    const currentUser = await freshSessionUser(auth, c.req.raw.headers)
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

    const profile = await loadOrCreateProfile(database, currentUser.id)
    if (!profile) throw new Error("Authenticated user profile is unavailable")
    return c.json(
      await currentAccount(database, currentUser.id, profile, dependencies),
      200
    )
  })

  app.openapi(updateOwnProfileRoute, async (c) => {
    c.header("Cache-Control", "private, no-store")
    if (!trustedOrigin(c.req.header("Origin"), webOrigin))
      return c.json(
        apiError(
          "INVALID_ORIGIN",
          "A trusted origin is required",
          c.get("requestId")
        ),
        403
      )
    const currentUser = await freshSessionUser(auth, c.req.raw.headers)
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

    const profile = await loadOrCreateProfile(database, currentUser.id)
    if (!profile) throw new Error("Authenticated user profile is unavailable")
    if (profile.status !== "active") {
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot update its profile",
          c.get("requestId")
        ),
        403
      )
    }

    const input = c.req.valid("json")
    const [updatedProfile] = await database
      .update(userProfile)
      .set({
        ...(input.bio !== undefined
          ? { bio: input.bio === "" ? null : input.bio }
          : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userProfile.userId, currentUser.id),
          eq(userProfile.status, "active")
        )
      )
      .returning({ userId: userProfile.userId })
    if (!updatedProfile)
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot update its profile",
          c.get("requestId")
        ),
        403
      )

    const updated = await loadProfile(database, currentUser.id)
    if (!updated) throw new Error("Updated profile is unavailable")
    return c.json(
      await currentAccount(database, currentUser.id, updated, dependencies),
      200
    )
  })

  app.openapi(uploadOwnAvatarRoute, async (c) => {
    c.header("Cache-Control", "private, no-store")
    if (!trustedOrigin(c.req.header("Origin"), webOrigin))
      return c.json(
        apiError(
          "INVALID_ORIGIN",
          "A trusted origin is required",
          c.get("requestId")
        ),
        403
      )
    const currentUser = await freshSessionUser(auth, c.req.raw.headers)
    if (!currentUser)
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    const profile = await loadOrCreateProfile(database, currentUser.id)
    if (!profile) throw new Error("Authenticated user profile is unavailable")
    if (profile.status !== "active")
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot update its avatar",
          c.get("requestId")
        ),
        403
      )
    if (!storage || !assetBaseUrl)
      return c.json(
        apiError(
          "MEDIA_STORAGE_UNAVAILABLE",
          "Profile media storage is unavailable",
          c.get("requestId")
        ),
        503
      )

    const file = c.req.valid("form").avatar
    if (file.size > PROFILE_MEDIA_MAX_INPUT_BYTES)
      return c.json(
        apiError(
          "PAYLOAD_TOO_LARGE",
          "Avatar must not exceed 5 MiB",
          c.get("requestId")
        ),
        413
      )
    let image: Uint8Array
    try {
      image = await transformProfileMedia(
        new Uint8Array(await file.arrayBuffer()),
        "user-avatar"
      )
    } catch (error) {
      if (error instanceof ProfileMediaBusyError)
        return c.json(
          apiError("IMAGE_PROCESSOR_BUSY", error.message, c.get("requestId")),
          429
        )
      if (error instanceof ProfileMediaError)
        return c.json(
          apiError("INVALID_AVATAR", error.message, c.get("requestId")),
          400
        )
      throw error
    }

    const key = profileMediaKey("user-avatar", currentUser.id)
    const url = profileMediaUrl(assetBaseUrl, key)
    try {
      await putProfileMedia(storage, key, image)
    } catch (error) {
      await cleanupProfileMedia(
        storage,
        url,
        assetBaseUrl,
        `users/${currentUser.id}/avatars/`,
        logger
      )
      logger?.("warn", "profile_media.store_failed", {
        key,
        ...errorFields(error, false),
      })
      return c.json(
        apiError(
          "MEDIA_STORAGE_UNAVAILABLE",
          "Profile media storage is unavailable",
          c.get("requestId")
        ),
        503
      )
    }

    let changed: Awaited<ReturnType<typeof replaceUserImage>>
    try {
      changed = await replaceUserImage(database, currentUser.id, url)
    } catch (error) {
      await cleanupProfileMedia(
        storage,
        url,
        assetBaseUrl,
        `users/${currentUser.id}/avatars/`,
        logger
      )
      throw error
    }
    if (!changed) {
      await cleanupProfileMedia(
        storage,
        url,
        assetBaseUrl,
        `users/${currentUser.id}/avatars/`,
        logger
      )
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot update its avatar",
          c.get("requestId")
        ),
        403
      )
    }
    await cleanupProfileMedia(
      storage,
      changed.previousImage,
      assetBaseUrl,
      `users/${currentUser.id}/avatars/`,
      logger
    )
    const updated = await loadProfile(database, currentUser.id)
    if (!updated) throw new Error("Updated profile is unavailable")
    return c.json(
      await currentAccount(database, currentUser.id, updated, dependencies),
      200
    )
  })

  app.openapi(deleteOwnAvatarRoute, async (c) => {
    c.header("Cache-Control", "private, no-store")
    if (!trustedOrigin(c.req.header("Origin"), webOrigin))
      return c.json(
        apiError(
          "INVALID_ORIGIN",
          "A trusted origin is required",
          c.get("requestId")
        ),
        403
      )
    const currentUser = await freshSessionUser(auth, c.req.raw.headers)
    if (!currentUser)
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    const profile = await loadOrCreateProfile(database, currentUser.id)
    if (!profile) throw new Error("Authenticated user profile is unavailable")
    const changed = await replaceUserImage(database, currentUser.id, null)
    if (!changed)
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot update its avatar",
          c.get("requestId")
        ),
        403
      )
    await cleanupProfileMedia(
      storage,
      changed.previousImage,
      assetBaseUrl,
      `users/${currentUser.id}/avatars/`,
      logger
    )
    const updated = await loadProfile(database, currentUser.id)
    if (!updated) throw new Error("Updated profile is unavailable")
    return c.json(
      await currentAccount(database, currentUser.id, updated, dependencies),
      200
    )
  })

  app.openapi(getPublicProfileRoute, async (c) => {
    c.header("Cache-Control", "no-store")
    const { id } = c.req.valid("param")
    const [profile] = await database
      .select({
        userId: user.id,
        name: user.name,
        image: user.image,
        verified: user.emailVerified,
        bio: userProfile.bio,
        createdAt: user.createdAt,
      })
      .from(userProfile)
      .innerJoin(user, eq(user.id, userProfile.userId))
      .where(
        and(
          eq(user.id, id),
          eq(userProfile.isPublic, true),
          eq(userProfile.status, "active")
        )
      )
      .limit(1)

    if (!profile) {
      return c.json(
        apiError("NOT_FOUND", "Profile not found", c.get("requestId")),
        404
      )
    }

    const { userId, ...publicProfile } = profile
    const visibleComments = and(
      eq(comment.userId, userId),
      eq(comment.status, "visible"),
      isNull(comment.deletedAt),
      visibleManga(dependencies),
      or(isNull(comment.chapterId), readableChapter(dependencies))
    )
    const [groups, [total], recentComments] = await Promise.all([
      database
        .select({
          id: translationGroup.id,
          slug: translationGroup.slug,
          name: translationGroup.name,
          role: translationGroupMember.role,
        })
        .from(translationGroupMember)
        .innerJoin(
          translationGroup,
          eq(translationGroup.id, translationGroupMember.organizationId)
        )
        .innerJoin(
          translationGroupProfile,
          eq(translationGroupProfile.organizationId, translationGroup.id)
        )
        .where(and(eq(translationGroupMember.userId, userId), publicGroup))
        .orderBy(asc(translationGroup.name), asc(translationGroup.id)),
      database
        .select({ value: count() })
        .from(comment)
        .innerJoin(manga, eq(manga.id, comment.mangaId))
        .leftJoin(chapter, eq(chapter.id, comment.chapterId))
        .where(visibleComments),
      database
        .select({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          manga: { id: manga.id, slug: manga.slug, title: manga.title },
          chapter: {
            id: chapter.id,
            number: chapter.number,
            title: chapter.title,
          },
        })
        .from(comment)
        .innerJoin(manga, eq(manga.id, comment.mangaId))
        .leftJoin(chapter, eq(chapter.id, comment.chapterId))
        .where(visibleComments)
        .orderBy(desc(comment.createdAt), desc(comment.id))
        .limit(5),
    ])
    const result: PublicProfile = {
      ...publicProfile,
      avatarFrame:
        (await effectiveAvatarFrames(dependencies, [userId])).get(userId) ??
        null,
      createdAt: formatTimestamp(profile.createdAt),
      groups: groups.map(({ role, ...group }) => ({
        ...group,
        isLeader: role === "owner",
      })),
      commentCount: total?.value ?? 0,
      recentComments: recentComments.map((row) => ({
        ...row,
        chapter: row.chapter
          ? {
              ...row.chapter,
              number: normalizeDecimal(row.chapter.number),
            }
          : null,
        createdAt: formatTimestamp(row.createdAt),
      })),
    }
    return c.json(result, 200)
  })
}
