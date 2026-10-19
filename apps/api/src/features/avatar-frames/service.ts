import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm"
import type { z } from "@hono/zod-openapi"
import type { Database } from "../../db/client.js"
import {
  avatarFrame,
  avatarFrameTopic,
  moderationAction,
  user,
  userAvatarFrame,
  userProfile,
} from "../../db/schema.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  groupFailure,
  requireGroupAdmin,
  type GroupTransaction,
} from "../groups/service.js"
import { frameSummary, type FrameProjection } from "./projection.js"
import type {
  CreateAvatarFrameSchema,
  UpdateAvatarFrameSchema,
  UpdateAvatarFrameShopSchema,
} from "./contract.js"
import type { normalizeFrame } from "../../shared/avatar-frame-media.js"
import {
  lockGachaCatalog,
  lockTopicChest,
  syncTopicChest,
} from "../shop/gacha-catalog.js"

type FrameRow = typeof avatarFrame.$inferSelect
const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
})
export function adminFrame(row: FrameRow, assetBaseUrl: string) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    topicId: row.topicId,
    rarity: row.rarity,
    limited: row.limited,
    active: row.active,
    version: row.version,
    displayScale: row.displayScale,
    offsetX: row.offsetX,
    offsetY: row.offsetY,
    shop: {
      price: row.shopPrice?.toString() ?? null,
      stock: row.shopStock,
      version: row.shopVersion,
    },
    frame: frameSummary(row, assetBaseUrl),
    frameCount: row.frameCount,
    byteSize: row.byteSize,
    previewByteSize: row.previewByteSize,
    sha256: row.sha256,
    sourceSha256: row.sourceSha256,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}
async function lockUsers(tx: GroupTransaction, ids: string[]) {
  const unique = [...new Set(ids)].sort()
  const rows = await tx
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.id, unique))
    .orderBy(asc(user.id))
    .for("update")
  if (rows.length !== unique.length)
    groupFailure(404, "NOT_FOUND", "User not found")
}
export async function frameById(
  database: Pick<Database, "select">,
  id: string,
  lock?: "update" | "share"
) {
  const query = database
    .select()
    .from(avatarFrame)
    .where(eq(avatarFrame.id, id))
  const [row] = await (lock ? query.for(lock) : query)
  if (!row) groupFailure(404, "NOT_FOUND", "Avatar frame not found")
  return row
}
function expectVersion(row: { version: number }, expectedVersion: number) {
  if (row.version !== expectedVersion)
    groupFailure(
      409,
      "VERSION_CONFLICT",
      "Avatar frame changed; reload and retry"
    )
}
export async function audit(
  tx: GroupTransaction,
  actor: string,
  action: string,
  row: { id: string },
  reason: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  targetKind: "avatar_frame" | "avatar_frame_topic" = "avatar_frame"
) {
  await tx.insert(moderationAction).values({
    actorUserId: actor,
    action: `${targetKind}.${action}`,
    targetKind,
    targetId: row.id,
    reason,
    before,
    after,
  })
}
const snapshot = (row: FrameRow) => ({
  displayScale: row.displayScale,
  offsetX: row.offsetX,
  offsetY: row.offsetY,
  name: row.name,
  description: row.description,
  topicId: row.topicId,
  rarity: row.rarity,
  limited: row.limited,
  active: row.active,
  version: row.version,
  sha256: row.sha256,
  assetKey: row.assetKey,
  previewKey: row.previewKey,
})

export async function listAvatarFrames(
  deps: FrameProjection,
  input: {
    page: number
    limit: number
    q?: string
    rarity?: FrameRow["rarity"]
    active?: string
    limited?: string
    topicId?: string
  }
) {
  const where = and(
    input.q
      ? or(
          ilike(avatarFrame.name, `%${input.q}%`),
          ilike(avatarFrame.code, `%${input.q}%`)
        )
      : undefined,
    input.rarity ? eq(avatarFrame.rarity, input.rarity) : undefined,
    input.active !== undefined
      ? eq(avatarFrame.active, input.active === "true")
      : undefined,
    input.limited !== undefined
      ? eq(avatarFrame.limited, input.limited === "true")
      : undefined,
    input.topicId === "none"
      ? isNull(avatarFrame.topicId)
      : input.topicId
        ? eq(avatarFrame.topicId, input.topicId)
        : undefined
  )
  const [[total], rows] = await Promise.all([
    deps.database.select({ value: count() }).from(avatarFrame).where(where),
    deps.database
      .select()
      .from(avatarFrame)
      .where(where)
      .orderBy(desc(avatarFrame.createdAt), desc(avatarFrame.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ])
  return {
    data: rows.map((row) => adminFrame(row, deps.assetBaseUrl ?? "")),
    meta: pageMeta(input.page, input.limit, total?.value ?? 0),
  }
}
export async function createAvatarFrame(
  database: Database,
  actor: string,
  input: z.infer<typeof CreateAvatarFrameSchema>
) {
  return database.transaction(async (tx) => {
    await lockUsers(tx, [actor])
    await requireGroupAdmin(tx, actor)
    await lockGachaCatalog(tx)
    if (input.topicId) await topicById(tx, input.topicId, "share")
    const [row] = await tx
      .insert(avatarFrame)
      .values({
        ...input,
        shopPrice: { R: 5n, SR: 15n, SSR: 100n }[input.rarity],
      })
      .onConflictDoNothing({ target: avatarFrame.code })
      .returning()
    if (!row)
      groupFailure(409, "FRAME_CODE_CONFLICT", "Frame code is already in use")
    await audit(
      tx,
      actor,
      "created",
      row,
      "Frame created by administrator",
      null,
      snapshot(row)
    )
    return row
  })
}
export async function updateAvatarFrame(
  database: Database,
  actor: string,
  id: string,
  input: z.infer<typeof UpdateAvatarFrameSchema>
) {
  return database.transaction(async (tx) => {
    await lockUsers(tx, [actor])
    await requireGroupAdmin(tx, actor)
    const { expectedVersion, ...fields } = input
    await lockGachaCatalog(tx)
    // Lock topic before frame, matching topic deletion's lock order.
    if (input.topicId) await topicById(tx, input.topicId, "share")
    const row = await frameById(tx, id, "update")
    expectVersion(row, expectedVersion)
    const limited = input.limited ?? row.limited
    if (limited && (input.rarity ?? row.rarity) !== "SSR")
      groupFailure(400, "INVALID_RARITY", "Only SSR may be limited")
    if (limited !== row.limited) {
      const [owned] = await tx
        .select({ userId: userAvatarFrame.userId })
        .from(userAvatarFrame)
        .where(eq(userAvatarFrame.frameId, id))
        .limit(1)
      if (row.activatedAt || owned)
        groupFailure(
          403,
          "LIMITED_IMMUTABLE",
          "Limited status cannot change after activation or grant"
        )
    }
    if (input.active && !row.assetKey)
      groupFailure(
        409,
        "FRAME_NOT_READY",
        "Upload a valid asset before activation"
      )
    const [updated] = await tx
      .update(avatarFrame)
      .set({
        ...fields,
        activatedAt: input.active
          ? (row.activatedAt ?? new Date())
          : row.activatedAt,
        version: row.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(avatarFrame.id, id))
      .returning()
    await audit(
      tx,
      actor,
      "updated",
      updated!,
      "Frame updated by administrator",
      snapshot(row),
      snapshot(updated!)
    )
    return updated!
  })
}
export async function updateAvatarFrameShop(
  database: Database,
  actor: string,
  id: string,
  input: z.infer<typeof UpdateAvatarFrameShopSchema>
) {
  return database.transaction(async (tx) => {
    await lockUsers(tx, [actor])
    await requireGroupAdmin(tx, actor)
    const row = await frameById(tx, id, "update")
    expectVersion(row, input.expectedVersion)
    if (row.shopVersion !== input.expectedShopVersion)
      groupFailure(
        409,
        "SHOP_VERSION_CONFLICT",
        "Shop changed; reload and retry"
      )
    const price =
      input.price === undefined ? row.shopPrice : BigInt(input.price)
    const stock = input.stock ?? row.shopStock
    const priceChanged = price !== row.shopPrice
    if (!priceChanged && stock === row.shopStock) return row
    if (priceChanged && row.version === 2_147_483_647)
      groupFailure(409, "VERSION_CONFLICT", "Frame revision limit reached")
    if (row.shopVersion === 2_147_483_647)
      groupFailure(409, "SHOP_VERSION_CONFLICT", "Shop revision limit reached")
    const [updated] = await tx
      .update(avatarFrame)
      .set({
        shopPrice: price,
        shopStock: stock,
        shopVersion: row.shopVersion + 1,
        version: row.version + (priceChanged ? 1 : 0),
        updatedAt: new Date(),
      })
      .where(eq(avatarFrame.id, id))
      .returning()
    const commerce = (frame: FrameRow) => ({
      price: frame.shopPrice?.toString() ?? null,
      stock: frame.shopStock,
      version: frame.version,
      shopVersion: frame.shopVersion,
    })
    await audit(
      tx,
      actor,
      "shop_updated",
      updated!,
      "Shop price or stock updated by administrator",
      commerce(row),
      commerce(updated!)
    )
    return updated!
  })
}
export async function preflightFrameUpload(
  database: Database,
  id: string,
  version: number
) {
  expectVersion(await frameById(database, id), version)
}

const topicSummary = (row: typeof avatarFrameTopic.$inferSelect) => ({
  id: row.id,
  name: row.name,
  version: row.version,
})

async function topicById(
  database: Pick<Database, "select">,
  id: string,
  lock: "share" | "update"
) {
  const [row] = await database
    .select()
    .from(avatarFrameTopic)
    .where(eq(avatarFrameTopic.id, id))
    .for(lock)
  if (!row)
    groupFailure(
      404,
      "FRAME_TOPIC_NOT_FOUND",
      "Frame topic not found; reload topics"
    )
  return row
}

export async function listFrameTopics(database: Database) {
  const rows = await database
    .select({
      id: avatarFrameTopic.id,
      name: avatarFrameTopic.name,
      version: avatarFrameTopic.version,
      frameCount: count(avatarFrame.id),
    })
    .from(avatarFrameTopic)
    .leftJoin(avatarFrame, eq(avatarFrame.topicId, avatarFrameTopic.id))
    .groupBy(avatarFrameTopic.id)
    .orderBy(asc(avatarFrameTopic.name), asc(avatarFrameTopic.id))
  return { data: rows }
}

export async function saveFrameTopic(
  database: Database,
  actor: string,
  input: { name: string },
  existing?: { id: string; expectedVersion: number }
) {
  try {
    return await database.transaction(async (tx) => {
      await lockUsers(tx, [actor])
      await requireGroupAdmin(tx, actor)
      await lockGachaCatalog(tx)
      const before = existing
        ? await topicById(tx, existing.id, "update")
        : null
      if (before && existing) expectVersion(before, existing.expectedVersion)
      const [row] = before
        ? await tx
            .update(avatarFrameTopic)
            .set({
              name: input.name,
              version: before.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(avatarFrameTopic.id, before.id))
            .returning()
        : await tx
            .insert(avatarFrameTopic)
            .values({ name: input.name })
            .returning()
      await syncTopicChest(tx, row!)
      await audit(
        tx,
        actor,
        before ? "updated" : "created",
        row!,
        "Frame topic managed by administrator",
        before ? topicSummary(before) : null,
        topicSummary(row!),
        "avatar_frame_topic"
      )
      return { data: topicSummary(row!) }
    })
  } catch (error) {
    const cause = error instanceof Error && error.cause ? error.cause : error
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "23505"
    )
      groupFailure(
        409,
        "FRAME_TOPIC_NAME_CONFLICT",
        "Frame topic name already exists"
      )
    throw error
  }
}

export async function deleteFrameTopic(
  database: Database,
  actor: string,
  id: string,
  expectedVersion: number
) {
  return database.transaction(async (tx) => {
    await lockUsers(tx, [actor])
    await requireGroupAdmin(tx, actor)
    await lockGachaCatalog(tx)
    const row = await topicById(tx, id, "update")
    expectVersion(row, expectedVersion)
    await lockTopicChest(tx, id)
    // Keep assets/ownership intact; bump versions so stale editors cannot
    // silently save the old classification back after deletion.
    const affected = await tx
      .update(avatarFrame)
      .set({
        topicId: null,
        version: sql`${avatarFrame.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(avatarFrame.topicId, id))
      .returning({ id: avatarFrame.id })
    await tx.delete(avatarFrameTopic).where(eq(avatarFrameTopic.id, id))
    await audit(
      tx,
      actor,
      "deleted",
      row,
      "Frame topic deleted; frames retained",
      { ...topicSummary(row), frameCount: affected.length },
      null,
      "avatar_frame_topic"
    )
    return { deleted: true as const }
  })
}

export class AvatarFrameCommitUnknownError extends Error {}
export async function publishAvatarFrame(
  database: Database,
  actor: string,
  id: string,
  version: number,
  keys: { asset: string; preview: string },
  result: Awaited<ReturnType<typeof normalizeFrame>>
) {
  let prepared = false
  try {
    return await database.transaction(async (tx) => {
      await lockUsers(tx, [actor])
      await requireGroupAdmin(tx, actor)
      await lockGachaCatalog(tx)
      const row = await frameById(tx, id, "update")
      expectVersion(row, version)
      const [updated] = await tx
        .update(avatarFrame)
        .set({
          assetKey: keys.asset,
          previewKey: keys.preview,
          width: result.output.width,
          height: result.output.height,
          frameCount: result.output.frames,
          byteSize: result.output.bytes,
          previewByteSize: result.thumbnail.bytes,
          sha256: result.output.sha256,
          previewSha256: result.thumbnail.sha256,
          sourceSha256: result.source.sha256,
          loop: result.output.loop,
          delays: result.output.delay,
          version: row.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(avatarFrame.id, id))
        .returning()
      await audit(
        tx,
        actor,
        "asset_published",
        updated!,
        "Frame asset published by administrator",
        snapshot(row),
        snapshot(updated!)
      )
      // The callback completed. Any subsequent failure may be a lost COMMIT ACK,
      // even if a concurrent read cannot see its audit yet.
      prepared = true
      return updated!
    })
  } catch (error) {
    if (prepared)
      throw new AvatarFrameCommitUnknownError(
        "Frame commit result is unknown",
        {
          cause: error,
        }
      )
    throw error
  }
}
export async function frameInventory(
  deps: FrameProjection,
  userId: string,
  input: { page: number; limit: number }
) {
  const [identity] = await deps.database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
  if (!identity) groupFailure(404, "NOT_FOUND", "User not found")
  const where = and(
    eq(userAvatarFrame.userId, userId),
    isNull(userAvatarFrame.revokedAt)
  )
  const [[profile], [total], rows] = await Promise.all([
    deps.database
      .select({ selected: userProfile.avatarFrameId })
      .from(userProfile)
      .where(eq(userProfile.userId, userId)),
    deps.database.select({ value: count() }).from(userAvatarFrame).where(where),
    deps.database
      .select({
        frame: avatarFrame,
        topic: { id: avatarFrameTopic.id, name: avatarFrameTopic.name },
        grantedAt: userAvatarFrame.grantedAt,
      })
      .from(userAvatarFrame)
      .innerJoin(avatarFrame, eq(avatarFrame.id, userAvatarFrame.frameId))
      .leftJoin(avatarFrameTopic, eq(avatarFrame.topicId, avatarFrameTopic.id))
      .where(where)
      .orderBy(desc(userAvatarFrame.grantedAt), asc(avatarFrame.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ])
  const selected = profile?.selected ?? null
  return {
    data: rows.map((row) => {
      const frame = frameSummary(row.frame, deps.assetBaseUrl ?? "")
      if (!frame) throw new Error("Owned frame asset is unavailable")
      return {
        frame,
        topic: row.topic,
        rarity: row.frame.rarity,
        limited: row.frame.limited,
        active: row.frame.active,
        selected: selected === frame.id,
        grantedAt: formatTimestamp(row.grantedAt),
      }
    }),
    meta: pageMeta(input.page, input.limit, total?.value ?? 0),
    selectedFrameId: selected,
    enabled: deps.avatarFramesEnabled ?? false,
  }
}
export async function setFrameOwnership(
  database: Database,
  actor: string,
  target: string,
  frameId: string,
  grant: boolean,
  reason: string
) {
  return database.transaction(async (tx) => {
    await lockUsers(tx, [actor, target])
    await requireGroupAdmin(tx, actor)
    const frame = await frameById(tx, frameId, "share")
    if (frame.limited)
      groupFailure(
        403,
        "LIMITED_FRAME_PROTECTED",
        "Limited frames can only be obtained through their own banner"
      )
    if (grant && (!frame.active || !frame.assetKey))
      groupFailure(
        409,
        "FRAME_NOT_READY",
        "Frame must have a valid active asset"
      )
    const where = and(
      eq(userAvatarFrame.userId, target),
      eq(userAvatarFrame.frameId, frameId)
    )
    const [owned] = await tx.select().from(userAvatarFrame).where(where)
    if (
      (grant && owned && !owned.revokedAt) ||
      (!grant && (!owned || owned.revokedAt))
    )
      return { changed: false }
    const now = new Date()
    if (grant)
      await tx
        .insert(userAvatarFrame)
        .values({
          userId: target,
          frameId,
          source: "admin",
          grantedAt: now,
          grantedByUserId: actor,
        })
        .onConflictDoUpdate({
          target: [userAvatarFrame.userId, userAvatarFrame.frameId],
          set: {
            revokedAt: null,
            grantedAt: now,
            grantedByUserId: actor,
            source: "admin",
          },
        })
    else {
      await tx.update(userAvatarFrame).set({ revokedAt: now }).where(where)
      await tx
        .update(userProfile)
        .set({ avatarFrameId: null, updatedAt: now })
        .where(
          and(
            eq(userProfile.userId, target),
            eq(userProfile.avatarFrameId, frameId)
          )
        )
    }
    await audit(
      tx,
      actor,
      grant ? "granted" : "revoked",
      frame,
      reason,
      { userId: target, owned: !grant },
      { userId: target, owned: grant }
    )
    return { changed: true }
  })
}
export async function equipAvatarFrame(
  database: Database,
  userId: string,
  frameId: string | null,
  enabled: boolean
) {
  return database.transaction(async (tx) => {
    await lockUsers(tx, [userId])
    const [profile] = await tx
      .select({ status: userProfile.status })
      .from(userProfile)
      .where(eq(userProfile.userId, userId))
      .for("update")
    if (!profile) groupFailure(404, "NOT_FOUND", "User profile not found")
    if (frameId) {
      if (!enabled)
        groupFailure(
          403,
          "AVATAR_FRAMES_DISABLED",
          "Avatar frames are disabled"
        )
      const [identity] = await tx
        .select({ banned: user.banned })
        .from(user)
        .where(eq(user.id, userId))
      if (profile.status !== "active" || identity?.banned)
        groupFailure(
          403,
          "ACCOUNT_RESTRICTED",
          "This account cannot equip frames"
        )
      const frame = await frameById(tx, frameId, "share")
      const [owned] = await tx
        .select({ id: userAvatarFrame.frameId })
        .from(userAvatarFrame)
        .where(
          and(
            eq(userAvatarFrame.userId, userId),
            eq(userAvatarFrame.frameId, frameId),
            isNull(userAvatarFrame.revokedAt)
          )
        )
      if (!owned || !frame.active || !frame.assetKey)
        groupFailure(403, "FRAME_UNAVAILABLE", "Frame is not owned or active")
    }
    await tx
      .update(userProfile)
      .set({ avatarFrameId: frameId, updatedAt: new Date() })
      .where(eq(userProfile.userId, userId))
  })
}
