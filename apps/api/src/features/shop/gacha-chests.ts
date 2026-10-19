import { and, asc, count, eq, inArray, isNull } from "drizzle-orm"
import { z } from "@hono/zod-openapi"
import type { Database } from "../../db/client.js"
import {
  avatarFrame,
  avatarFrameTopic,
  moderationAction,
  shopChest,
  shopGachaState,
} from "../../db/schema.js"
import { stableHash } from "../../shared/cache.js"
import { PageQuerySchema } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { frameSummary, readyFrameAssets } from "../avatar-frames/projection.js"
import { lockActiveCoinUser } from "../coin/access.js"
import { MAX_COIN } from "../coin/contract.js"
import { readCoinWallet } from "../coin/wallet.js"
import {
  groupFailure,
  hasAdminRole,
  type GroupTransaction,
} from "../groups/service.js"
import type { ShopDependencies } from "./service.js"
import { lockGachaCatalog } from "./gacha-catalog.js"
import { NORMAL_GACHA_RULE } from "./gacha-policy.js"

export type GachaDependencies = ShopDependencies & { gachaEnabled: boolean }
export const ChestQuerySchema = PageQuerySchema.strict()
export const ChestPoolQuerySchema = PageQuerySchema.extend({
  rarity: z.enum(["R", "SR", "SSR"]).optional(),
}).strict()
export const UpdateChestSchema = z
  .object({
    expectedVersion: z.number().int().min(1).max(2_147_483_647),
    saleEnabled: z.boolean(),
  })
  .strict()
export const gachaRollEnabled = (deps: GachaDependencies) =>
  deps.gachaEnabled &&
  deps.shopEnabled &&
  deps.coinEnabled &&
  deps.avatarFramesEnabled
type Chest = typeof shopChest.$inferSelect
type Reader = Pick<Database, "select">
const poolFields = {
  id: avatarFrame.id,
  code: avatarFrame.code,
  name: avatarFrame.name,
  topicId: avatarFrame.topicId,
  rarity: avatarFrame.rarity,
  assetKey: avatarFrame.assetKey,
  previewKey: avatarFrame.previewKey,
  sha256: avatarFrame.sha256,
  previewSha256: avatarFrame.previewSha256,
  width: avatarFrame.width,
  height: avatarFrame.height,
  frameCount: avatarFrame.frameCount,
  displayScale: avatarFrame.displayScale,
  offsetX: avatarFrame.offsetX,
  offsetY: avatarFrame.offsetY,
}
export type GachaPoolFrame = Pick<
  typeof avatarFrame.$inferSelect,
  keyof typeof poolFields
>

export function summarizeGachaPool(rows: readonly GachaPoolFrame[]) {
  const counts = { R: 0, SR: 0, SSR: 0 }
  const ordered = [...rows].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )
  const members = ordered.map((row) => {
    counts[row.rarity]++
    const {
      id,
      topicId,
      rarity,
      assetKey,
      previewKey,
      sha256,
      previewSha256,
      width,
      height,
      frameCount,
    } = row
    return {
      id,
      topicId,
      rarity,
      assetKey,
      previewKey,
      sha256,
      previewSha256,
      width,
      height,
      frameCount,
    }
  })
  return { ...counts, total: rows.length, digest: stableHash(members) }
}

export async function readGachaPool(
  database: Reader,
  assetBaseUrl: string | undefined,
  chest: Pick<Chest, "kind" | "topicId" | "retiredAt">
) {
  return database
    .select(poolFields)
    .from(avatarFrame)
    .where(
      and(
        readyFrameAssets(assetBaseUrl),
        eq(avatarFrame.active, true),
        eq(avatarFrame.limited, false),
        chest.kind === "topic"
          ? chest.topicId
            ? eq(avatarFrame.topicId, chest.topicId)
            : inArray(avatarFrame.id, [])
          : undefined
      )
    )
    .orderBy(asc(avatarFrame.id))
}
function chestDto(chest: Chest, rows: readonly GachaPoolFrame[]) {
  const pool = summarizeGachaPool(rows)
  const ready = !chest.retiredAt && pool.R > 0 && pool.SR > 0 && pool.SSR > 0
  return {
    id: chest.id,
    name: chest.kind === "common" ? "Rương thường" : `Rương ${chest.topicName}`,
    kind: chest.kind,
    topic:
      chest.kind === "topic"
        ? { id: chest.topicId, name: chest.topicName! }
        : null,
    version: chest.version,
    saleEnabled: chest.saleEnabled,
    retiredAt: chest.retiredAt ? formatTimestamp(chest.retiredAt) : null,
    price: NORMAL_GACHA_RULE.price,
    pool,
    ready,
    blockReason: chest.retiredAt
      ? ("retired" as const)
      : !ready
        ? ("pool_unavailable" as const)
        : null,
  }
}
async function chestById(database: Reader, id: string, lock = false) {
  const query = database.select().from(shopChest).where(eq(shopChest.id, id))
  const [chest] = await (lock ? query.for("update") : query)
  if (!chest || chest.retiredAt)
    groupFailure(404, "NOT_FOUND", "Chest not found")
  return chest
}
async function listChests(
  deps: GachaDependencies,
  tx: Reader,
  input: z.infer<typeof ChestQuerySchema>,
  admin = false
) {
  const where = admin ? undefined : isNull(shopChest.retiredAt)
  const [total] = await tx
    .select({ value: count() })
    .from(shopChest)
    .where(where)
  const chests = await tx
    .select()
    .from(shopChest)
    .where(where)
    .orderBy(asc(shopChest.kind), asc(shopChest.id))
    .limit(input.limit)
    .offset((input.page - 1) * input.limit)
  const topics = chests.flatMap((chest) =>
    chest.topicId ? [chest.topicId] : []
  )
  const rows = chests.length
    ? await tx
        .select(poolFields)
        .from(avatarFrame)
        .where(
          and(
            readyFrameAssets(deps.assetBaseUrl),
            eq(avatarFrame.active, true),
            eq(avatarFrame.limited, false),
            chests.some((chest) => chest.kind === "common")
              ? undefined
              : inArray(avatarFrame.topicId, topics)
          )
        )
        .orderBy(asc(avatarFrame.id))
    : []
  return {
    // ponytail: page <=100, catalog ~1k; batch read once, no query per chest/frame.
    // Group rows by topic if larger catalogs make these in-memory filters costly.
    data: chests.map((chest) =>
      chestDto(
        chest,
        chest.kind === "common"
          ? rows
          : rows.filter(
              (row) => chest.topicId !== null && row.topicId === chest.topicId
            )
      )
    ),
    meta: {
      page: input.page,
      limit: input.limit,
      total: total?.value ?? 0,
      totalPages: Math.ceil((total?.value ?? 0) / input.limit),
    },
    rule: NORMAL_GACHA_RULE,
    rollEnabled: gachaRollEnabled(deps),
  }
}
export async function listShopChests(
  deps: GachaDependencies,
  input: z.infer<typeof ChestQuerySchema>
) {
  const query = ChestQuerySchema.parse(input)
  return deps.database.transaction((tx) => listChests(deps, tx, query), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  })
}
export async function getShopChest(deps: GachaDependencies, id: string) {
  return deps.database.transaction(
    async (tx) => {
      const chest = await chestById(tx, id)
      return {
        data: chestDto(
          chest,
          await readGachaPool(tx, deps.assetBaseUrl, chest)
        ),
        rule: NORMAL_GACHA_RULE,
        rollEnabled: gachaRollEnabled(deps),
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" }
  )
}
export async function personalShopChest(
  deps: GachaDependencies,
  actor: string,
  id: string
) {
  return deps.database.transaction(
    async (tx) => {
      await lockActiveCoinUser(tx, actor)
      const chest = await chestById(tx, id)
      const data = chestDto(
        chest,
        await readGachaPool(tx, deps.assetBaseUrl, chest)
      )
      const { balance } = await readCoinWallet(tx, { kind: "user", id: actor })
      const [state] = await tx
        .select()
        .from(shopGachaState)
        .where(eq(shopGachaState.userId, actor))
      const rollBlockReason = !deps.shopEnabled
        ? ("shop_disabled" as const)
        : !deps.coinEnabled
          ? ("coin_disabled" as const)
          : !deps.avatarFramesEnabled
            ? ("avatar_frames_disabled" as const)
            : !deps.gachaEnabled
              ? ("gacha_disabled" as const)
              : !chest.saleEnabled
                ? ("chest_closed" as const)
                : !data.ready
                  ? ("pool_unavailable" as const)
                  : state?.rollCount === MAX_COIN
                    ? ("sequence_limit" as const)
                    : BigInt(balance) < BigInt(data.price)
                      ? ("insufficient_coin" as const)
                      : null
      return {
        data,
        rule: NORMAL_GACHA_RULE,
        rollEnabled: gachaRollEnabled(deps),
        balance,
        pity: {
          sinceSr: state?.sinceSr ?? 0,
          sinceSsr: state?.sinceSsr ?? 0,
          rollCount: (state?.rollCount ?? 0n).toString(),
        },
        canRoll: rollBlockReason === null,
        rollBlockReason,
      }
    },
    { isolationLevel: "repeatable read" }
  )
}
export async function getShopChestPool(
  deps: GachaDependencies,
  id: string,
  input: z.infer<typeof ChestPoolQuerySchema>
) {
  const query = ChestPoolQuerySchema.parse(input)
  return deps.database.transaction(
    async (tx) => {
      const chest = await chestById(tx, id)
      const rows = await readGachaPool(tx, deps.assetBaseUrl, chest)
      const filtered = query.rarity
        ? rows.filter((row) => row.rarity === query.rarity)
        : rows
      const page = filtered.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit
      )
      const topicIds = [
        ...new Set(page.flatMap((row) => (row.topicId ? [row.topicId] : []))),
      ]
      const topics = new Map(
        (topicIds.length
          ? await tx
              .select({ id: avatarFrameTopic.id, name: avatarFrameTopic.name })
              .from(avatarFrameTopic)
              .where(inArray(avatarFrameTopic.id, topicIds))
          : []
        ).map((topic) => [topic.id, topic])
      )
      return {
        data: page.map((row) => {
          const frame = frameSummary(row, deps.assetBaseUrl ?? "")
          if (!frame)
            groupFailure(
              503,
              "SERVICE_UNAVAILABLE",
              "Chest pool is unavailable"
            )
          return {
            frame,
            code: row.code,
            rarity: row.rarity,
            topic: row.topicId ? (topics.get(row.topicId) ?? null) : null,
          }
        }),
        meta: {
          page: query.page,
          limit: query.limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / query.limit),
        },
        poolDigest: summarizeGachaPool(rows).digest,
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" }
  )
}
async function admin(tx: GroupTransaction, actor: string) {
  const account = await lockActiveCoinUser(tx, actor)
  if (!hasAdminRole(account.role))
    groupFailure(403, "FORBIDDEN", "Administrator access is required")
}
export async function listAdminChests(
  deps: GachaDependencies,
  actor: string,
  input: z.infer<typeof ChestQuerySchema>
) {
  const query = ChestQuerySchema.parse(input)
  return deps.database.transaction(
    async (tx) => {
      await admin(tx, actor)
      return listChests(deps, tx, query, true)
    },
    { isolationLevel: "repeatable read" }
  )
}
export async function updateShopChest(
  deps: GachaDependencies,
  actor: string,
  id: string,
  input: z.infer<typeof UpdateChestSchema>
) {
  const request = UpdateChestSchema.parse(input)
  return deps.database.transaction(async (tx) => {
    await admin(tx, actor)
    await lockGachaCatalog(tx)
    const current = await chestById(tx, id)
    if (current.topicId)
      await tx
        .select({ id: avatarFrameTopic.id })
        .from(avatarFrameTopic)
        .where(eq(avatarFrameTopic.id, current.topicId))
        .for("share")
    const chest = await chestById(tx, id, true)
    if (request.expectedVersion !== chest.version)
      groupFailure(
        409,
        "GACHA_VERSION_CONFLICT",
        "Chest changed; reload and retry"
      )
    const rows = await readGachaPool(tx, deps.assetBaseUrl, chest)
    const before = chestDto(chest, rows)
    if (request.saleEnabled && !before.ready)
      groupFailure(
        409,
        "GACHA_POOL_UNAVAILABLE",
        "Chest must contain R, SR and SSR frames"
      )
    if (request.saleEnabled === chest.saleEnabled) return { data: before }
    if (chest.version === 2_147_483_647)
      groupFailure(
        409,
        "GACHA_VERSION_CONFLICT",
        "Chest revision limit reached"
      )
    const [updated] = await tx
      .update(shopChest)
      .set({
        saleEnabled: request.saleEnabled,
        version: chest.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(shopChest.id, chest.id))
      .returning()
    await tx.insert(moderationAction).values({
      actorUserId: actor,
      action: "shop.chest_updated",
      targetKind: "shop_chest",
      targetId: chest.id,
      reason: "Chest sale managed by administrator",
      before: { saleEnabled: chest.saleEnabled, version: chest.version },
      after: {
        saleEnabled: updated!.saleEnabled,
        version: updated!.version,
        poolDigest: before.pool.digest,
      },
    })
    return { data: chestDto(updated!, rows) }
  })
}
