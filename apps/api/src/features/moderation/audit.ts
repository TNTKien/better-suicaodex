import { parseISO } from "date-fns"
import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  effectiveAvatarFrames,
  type FrameProjection,
} from "../avatar-frames/projection.js"
import { moderationAction, user } from "../../db/schema.js"
import { formatTimestamp } from "../../shared/timestamp.js"

const sensitiveKey = /(?:password|token|secret|cookie|authorization)/i

function sanitizeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeSnapshot)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : sanitizeSnapshot(nested),
    ])
  )
}

export type AuditQuery = {
  cursor?: string
  limit: number
  targetKind?:
    | "user"
    | "manga"
    | "volume"
    | "chapter"
    | "comment"
    | "group"
    | "person"
    | "tag"
    | "image_server2"
    | "system_notice"
    | "avatar_frame"
    | "avatar_frame_topic"
    | "shop_chest"
  targetId?: string
  actorUserId?: string
  action?: string
  from?: string
  to?: string
}

export async function listModerationAudit(
  database: Database,
  query: AuditQuery,
  frames: Omit<FrameProjection, "database"> = {}
) {
  const filters = [
    query.targetKind
      ? eq(moderationAction.targetKind, query.targetKind)
      : undefined,
    query.targetId ? eq(moderationAction.targetId, query.targetId) : undefined,
    query.actorUserId
      ? eq(moderationAction.actorUserId, query.actorUserId)
      : undefined,
    query.action ? eq(moderationAction.action, query.action) : undefined,
    query.from
      ? gte(moderationAction.createdAt, parseISO(query.from))
      : undefined,
    query.to ? lte(moderationAction.createdAt, parseISO(query.to)) : undefined,
  ]
  let cursorCondition
  if (query.cursor) {
    const [anchor] = await database
      .select({ createdAt: moderationAction.createdAt })
      .from(moderationAction)
      .where(and(eq(moderationAction.id, query.cursor), ...filters))
    if (!anchor) return null
    cursorCondition = or(
      lt(moderationAction.createdAt, anchor.createdAt),
      and(
        eq(moderationAction.createdAt, anchor.createdAt),
        lt(moderationAction.id, query.cursor)
      )
    )
  }

  const rows = await database
    .select({
      id: moderationAction.id,
      actorUserId: moderationAction.actorUserId,
      actorName: user.name,
      actorImage: user.image,
      action: moderationAction.action,
      targetKind: moderationAction.targetKind,
      targetId: moderationAction.targetId,
      reason: moderationAction.reason,
      before: moderationAction.before,
      after: moderationAction.after,
      createdAt: moderationAction.createdAt,
    })
    .from(moderationAction)
    .leftJoin(user, eq(user.id, moderationAction.actorUserId))
    .where(and(...filters, cursorCondition))
    .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
    .limit(query.limit + 1)
  const page = rows.slice(0, query.limit)
  const projections = await effectiveAvatarFrames(
    { database, ...frames },
    page.flatMap((row) => (row.actorUserId ? [row.actorUserId] : []))
  )
  return {
    data: page.map((row) => ({
      id: row.id,
      actor:
        row.actorUserId && row.actorName
          ? {
              id: row.actorUserId,
              name: row.actorName,
              image: row.actorImage,
              avatarFrame: projections.get(row.actorUserId) ?? null,
            }
          : null,
      actorUserId: row.actorUserId,
      action: row.action,
      targetKind: row.targetKind,
      targetId: row.targetId,
      reason: row.reason,
      before: sanitizeSnapshot(row.before) as Record<string, unknown> | null,
      after: sanitizeSnapshot(row.after) as Record<string, unknown> | null,
      createdAt: formatTimestamp(row.createdAt),
    })),
    meta: {
      limit: query.limit,
      nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
    },
  }
}
