import { eq, ne, sql } from "drizzle-orm"
import { shopChest } from "../../db/schema.js"
import type { GroupTransaction } from "../groups/service.js"

export async function lockGachaCatalog(
  tx: GroupTransaction,
  mode: "share" | "update" = "update"
) {
  // ponytail: catalog edits are rare; split by pool only if writer contention is measured.
  await tx.execute(
    mode === "share"
      ? sql`SELECT pg_advisory_xact_lock_shared(hashtext('shop.gacha.catalog'))`
      : sql`SELECT pg_advisory_xact_lock(hashtext('shop.gacha.catalog'))`
  )
}

// Called inside the topic writer's transaction and catalog lock, never at startup.
export async function syncTopicChest(
  tx: GroupTransaction,
  topic: { id: string; name: string }
) {
  await tx
    .insert(shopChest)
    .values({ kind: "topic", topicId: topic.id, topicName: topic.name })
    .onConflictDoUpdate({
      target: shopChest.topicId,
      set: {
        topicName: topic.name,
        version: sql`${shopChest.version} + 1`,
        updatedAt: new Date(),
      },
      setWhere: ne(shopChest.topicName, topic.name),
    })
}

export async function lockTopicChest(tx: GroupTransaction, topicId: string) {
  await tx
    .select({ id: shopChest.id })
    .from(shopChest)
    .where(eq(shopChest.topicId, topicId))
    .for("update")
}
