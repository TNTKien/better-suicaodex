import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import {
  avatarFrame,
  userAvatarFrame,
  userProfile,
  user,
} from "../../db/schema.js"
import type { AvatarFrameSummary } from "../../shared/contract.js"
import { resolveAssetUrl } from "../catalog/routes.js"

export type FrameProjection = {
  database: Database
  assetBaseUrl?: string
  avatarFramesEnabled?: boolean
}
export function frameSummary(
  row: Pick<
    typeof avatarFrame.$inferSelect,
    | "id"
    | "name"
    | "assetKey"
    | "previewKey"
    | "width"
    | "height"
    | "frameCount"
    | "displayScale"
    | "offsetX"
    | "offsetY"
  >,
  assetBaseUrl: string
): AvatarFrameSummary | null {
  if (
    !row.assetKey ||
    !row.previewKey ||
    !row.width ||
    !row.height ||
    !row.frameCount
  )
    return null
  const assetUrl = resolveAssetUrl(assetBaseUrl, row.assetKey)
  const previewUrl = resolveAssetUrl(assetBaseUrl, row.previewKey)
  if (!assetUrl || !previewUrl) return null
  return {
    id: row.id,
    name: row.name,
    assetUrl,
    previewUrl,
    animated: row.frameCount > 1,
    width: row.width,
    height: row.height,
    displayScale: row.displayScale,
    offsetX: row.offsetX,
    offsetY: row.offsetY,
  }
}

// Keep eligibility aligned with resolveAssetUrl/frameSummary before pagination.
export function readyFrameAssets(assetBaseUrl?: string) {
  const relativeKey = (
    key: typeof avatarFrame.assetKey | typeof avatarFrame.previewKey
  ) => sql`
    ${key} IS NOT NULL AND ${key} <> '' AND left(${key}, 1) <> '/'
    AND position(chr(92) in ${key}) = 0
    AND ${key} !~ '(^|/)[.][.](/|$)' AND ${key} !~* '^[a-z][a-z0-9+.-]*:'`
  return and(
    assetBaseUrl ? undefined : sql`false`,
    relativeKey(avatarFrame.assetKey),
    relativeKey(avatarFrame.previewKey),
    sql`${avatarFrame.width} > 0 AND ${avatarFrame.height} > 0 AND ${avatarFrame.frameCount} > 0`
  )
}

export async function effectiveAvatarFrames(
  deps: FrameProjection,
  userIds: string[]
) {
  const result = new Map<string, AvatarFrameSummary>()
  if (!deps.avatarFramesEnabled || !deps.assetBaseUrl || !userIds.length)
    return result
  const rows = await deps.database
    .select({ userId: userProfile.userId, frame: avatarFrame })
    .from(userProfile)
    .innerJoin(user, eq(user.id, userProfile.userId))
    .innerJoin(
      userAvatarFrame,
      and(
        eq(userAvatarFrame.userId, userProfile.userId),
        eq(userAvatarFrame.frameId, userProfile.avatarFrameId),
        isNull(userAvatarFrame.revokedAt)
      )
    )
    .innerJoin(
      avatarFrame,
      and(
        eq(avatarFrame.id, userProfile.avatarFrameId),
        eq(avatarFrame.active, true)
      )
    )
    .where(
      and(
        inArray(userProfile.userId, [...new Set(userIds)]),
        eq(userProfile.status, "active"),
        sql`${user.banned} IS NOT TRUE`
      )
    )
  for (const row of rows) {
    const summary = frameSummary(row.frame, deps.assetBaseUrl)
    if (summary) result.set(row.userId, summary)
  }
  return result
}
