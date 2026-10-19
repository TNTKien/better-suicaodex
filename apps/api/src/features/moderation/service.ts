import { and, desc, eq, inArray } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import { moderationAction } from "../../db/schema.js"

export async function latestModerationReasons(
  database: Database,
  targetKind: "manga" | "chapter",
  ids: string[]
) {
  if (!ids.length) return new Map<string, string>()
  const rows = await database
    .selectDistinctOn([moderationAction.targetId], {
      targetId: moderationAction.targetId,
      reason: moderationAction.reason,
    })
    .from(moderationAction)
    .where(
      and(
        eq(moderationAction.targetKind, targetKind),
        eq(moderationAction.action, `moderation.${targetKind}.hidden`),
        inArray(moderationAction.targetId, ids)
      )
    )
    .orderBy(
      moderationAction.targetId,
      desc(moderationAction.createdAt),
      desc(moderationAction.id)
    )
  return new Map(rows.map(({ targetId, reason }) => [targetId, reason]))
}
