import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm"
import type { z } from "@hono/zod-openapi"
import { parseISO } from "date-fns"
import type { Database } from "../../db/client.js"
import {
  avatarFrame,
  avatarFrameTopic,
  coinLedger,
  coinOperation,
  shopPurchase,
  userAvatarFrame,
} from "../../db/schema.js"
import { frameSummary, readyFrameAssets } from "../avatar-frames/projection.js"
import { audit, frameById } from "../avatar-frames/service.js"
import { lockActiveCoinUser } from "../coin/access.js"
import { readCoinWallet } from "../coin/wallet.js"
import { groupFailure } from "../groups/service.js"
import type { CoinService } from "../coin/service.js"
import type { CoinReceipt } from "../coin/contract.js"
import type { CoinHistoryQuery } from "../coin/api-contract.js"
import { stableHash } from "../../shared/cache.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  ShopPurchaseInputSchema,
  type ShopCatalogQuerySchema,
  type ShopPurchaseReceipt,
} from "./contract.js"

export type ShopDependencies = {
  database: Database
  assetBaseUrl?: string
  shopEnabled: boolean
  coinEnabled: boolean
  avatarFramesEnabled: boolean
}
type Query = z.infer<typeof ShopCatalogQuerySchema>
type Reader = Pick<Database, "select">
export const shopPurchaseEnabled = (deps: ShopDependencies) =>
  deps.shopEnabled && deps.coinEnabled && deps.avatarFramesEnabled

function eligible(assetBaseUrl?: string) {
  return and(
    readyFrameAssets(assetBaseUrl),
    eq(avatarFrame.active, true),
    eq(avatarFrame.limited, false),
    sql`${avatarFrame.shopPrice} > 0`
  )
}
function item(
  row: typeof avatarFrame.$inferSelect,
  topic: { id: string; name: string } | null,
  assetBaseUrl: string
) {
  const frame = frameSummary(row, assetBaseUrl)
  if (!frame || row.shopPrice === null)
    groupFailure(503, "SERVICE_UNAVAILABLE", "Shop catalog is unavailable")
  return {
    frame,
    code: row.code,
    description: row.description,
    topic,
    rarity: row.rarity,
    price: row.shopPrice.toString(),
    stock: row.shopStock,
    frameVersion: row.version,
    availability:
      row.shopStock > 0 ? ("in_stock" as const) : ("sold_out" as const),
  }
}
export async function listShopFrames(
  deps: ShopDependencies,
  input: Query,
  database: Reader = deps.database
) {
  const where = and(
    eligible(deps.assetBaseUrl),
    input.q
      ? or(
          ilike(avatarFrame.name, `%${input.q}%`),
          ilike(avatarFrame.code, `%${input.q}%`)
        )
      : undefined,
    input.rarity ? eq(avatarFrame.rarity, input.rarity) : undefined,
    input.topicId === "none"
      ? isNull(avatarFrame.topicId)
      : input.topicId
        ? eq(avatarFrame.topicId, input.topicId)
        : undefined
  )
  const [[total], rows] = await Promise.all([
    database.select({ value: count() }).from(avatarFrame).where(where),
    database
      .select({
        row: avatarFrame,
        topic: { id: avatarFrameTopic.id, name: avatarFrameTopic.name },
      })
      .from(avatarFrame)
      .leftJoin(avatarFrameTopic, eq(avatarFrame.topicId, avatarFrameTopic.id))
      .where(where)
      .orderBy(desc(avatarFrame.createdAt), desc(avatarFrame.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ])
  return {
    data: rows.map(({ row, topic }) =>
      item(row, topic, deps.assetBaseUrl ?? "")
    ),
    meta: {
      page: input.page,
      limit: input.limit,
      total: total?.value ?? 0,
      totalPages: Math.ceil((total?.value ?? 0) / input.limit),
    },
    purchaseEnabled: shopPurchaseEnabled(deps),
  }
}
export async function getShopFrame(deps: ShopDependencies, id: string) {
  const [result] = await deps.database
    .select({
      row: avatarFrame,
      topic: { id: avatarFrameTopic.id, name: avatarFrameTopic.name },
    })
    .from(avatarFrame)
    .leftJoin(avatarFrameTopic, eq(avatarFrame.topicId, avatarFrameTopic.id))
    .where(and(eligible(deps.assetBaseUrl), eq(avatarFrame.id, id)))
  if (!result) groupFailure(404, "NOT_FOUND", "Shop frame not found")
  return {
    data: item(result.row, result.topic, deps.assetBaseUrl ?? ""),
    purchaseEnabled: shopPurchaseEnabled(deps),
  }
}
export async function listShopTopics(deps: ShopDependencies) {
  const data = await deps.database
    .select({
      id: avatarFrameTopic.id,
      name: avatarFrameTopic.name,
      frameCount: count(avatarFrame.id),
    })
    .from(avatarFrameTopic)
    .innerJoin(avatarFrame, eq(avatarFrame.topicId, avatarFrameTopic.id))
    .where(eligible(deps.assetBaseUrl))
    .groupBy(avatarFrameTopic.id)
    .orderBy(asc(avatarFrameTopic.name), asc(avatarFrameTopic.id))
  return { data }
}
export async function personalShopFrames(
  deps: ShopDependencies,
  userId: string,
  input: Query
) {
  return deps.database.transaction(async (tx) => {
    await lockActiveCoinUser(tx, userId)
    const catalog = await listShopFrames(deps, input, tx)
    const { balance } = await readCoinWallet(tx, { kind: "user", id: userId })
    const owned = new Set(
      catalog.data.length
        ? (
            await tx
              .select({ frameId: userAvatarFrame.frameId })
              .from(userAvatarFrame)
              .where(
                and(
                  eq(userAvatarFrame.userId, userId),
                  isNull(userAvatarFrame.revokedAt),
                  inArray(
                    userAvatarFrame.frameId,
                    catalog.data.map(({ frame }) => frame.id)
                  )
                )
              )
          ).map(({ frameId }) => frameId)
        : []
    )
    return {
      ...catalog,
      balance,
      data: catalog.data.map((frame) => {
        const isOwned = owned.has(frame.frame.id)
        const purchaseBlockReason = !deps.shopEnabled
          ? ("shop_disabled" as const)
          : !deps.coinEnabled
            ? ("coin_disabled" as const)
            : !deps.avatarFramesEnabled
              ? ("avatar_frames_disabled" as const)
              : isOwned
                ? ("already_owned" as const)
                : frame.stock === 0
                  ? ("sold_out" as const)
                  : BigInt(balance) < BigInt(frame.price)
                    ? ("insufficient_coin" as const)
                    : null
        return {
          ...frame,
          owned: isOwned,
          canPurchase: purchaseBlockReason === null,
          purchaseBlockReason,
        }
      }),
    }
  })
}

export function shopPurchaseReceipt(
  row: typeof shopPurchase.$inferSelect,
  coin: CoinReceipt
): ShopPurchaseReceipt {
  const debit = coin.entries[0]!
  return {
    id: row.id,
    operationId: row.operationId,
    frame: {
      id: row.frameId,
      code: row.frameCode,
      name: row.frameName,
      rarity: row.rarity,
    },
    price: row.price.toString(),
    transactionGroup: coin.transactionGroup,
    ledgerId: debit.id,
    sequence: debit.sequence,
    balanceAfter: debit.balanceAfter,
    createdAt: formatTimestamp(row.createdAt),
  }
}

export async function personalShopPurchase(
  database: Database,
  actor: string,
  operationId: string
) {
  return database.transaction(async (tx) => {
    await lockActiveCoinUser(tx, actor)
    const [row] = await tx
      .select({ purchase: shopPurchase, coin: coinOperation.result })
      .from(shopPurchase)
      .innerJoin(
        coinOperation,
        eq(coinOperation.key, shopPurchase.coinOperationKey)
      )
      .where(
        and(
          eq(shopPurchase.actorUserId, actor),
          eq(shopPurchase.operationId, operationId)
        )
      )
    if (!row) groupFailure(404, "NOT_FOUND", "Purchase receipt not found")
    return { data: shopPurchaseReceipt(row.purchase, row.coin) }
  })
}

export async function personalShopHistory(
  database: Database,
  actor: string,
  input: CoinHistoryQuery
) {
  return database.transaction(async (tx) => {
    await lockActiveCoinUser(tx, actor)
    const rows = await tx
      .select({ purchase: shopPurchase, coin: coinOperation.result })
      .from(shopPurchase)
      .innerJoin(
        coinOperation,
        eq(coinOperation.key, shopPurchase.coinOperationKey)
      )
      .innerJoin(
        coinLedger,
        and(
          eq(coinLedger.operationKey, coinOperation.key),
          eq(coinLedger.position, 0)
        )
      )
      .where(
        and(
          eq(shopPurchase.actorUserId, actor),
          input.cursor
            ? lt(coinLedger.sequence, BigInt(input.cursor))
            : undefined
        )
      )
      .orderBy(desc(coinLedger.sequence))
      .limit(input.limit + 1)
    const data = rows
      .slice(0, input.limit)
      .map((row) => shopPurchaseReceipt(row.purchase, row.coin))
    return {
      data,
      meta: {
        limit: input.limit,
        nextCursor: rows.length > input.limit ? data.at(-1)!.sequence : null,
      },
    }
  })
}

export async function purchaseAvatarFrame(
  deps: Omit<ShopDependencies, "coinEnabled"> & { coin: CoinService },
  actor: string,
  rawInput: unknown
): Promise<ShopPurchaseReceipt> {
  const parsed = ShopPurchaseInputSchema.safeParse(rawInput)
  if (!parsed.success)
    groupFailure(400, "VALIDATION_ERROR", "Invalid purchase input")
  const input = parsed.data
  const key = `shop.purchase:${actor}:${input.operationId}`
  const fingerprint = stableHash({
    frameId: input.frameId,
    expectedFrameVersion: input.expectedFrameVersion,
    expectedPrice: input.expectedPrice,
  })
  return deps.database.transaction(async (tx) => {
    await lockActiveCoinUser(tx, actor)
    // Same namespace as coin.apply, acquired before frame/wallet locks.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`coin:${key}`}, 0))`
    )
    const [previous] = await tx
      .select({ purchase: shopPurchase, coin: coinOperation.result })
      .from(shopPurchase)
      .innerJoin(
        coinOperation,
        eq(coinOperation.key, shopPurchase.coinOperationKey)
      )
      .where(
        and(
          eq(shopPurchase.actorUserId, actor),
          eq(shopPurchase.operationId, input.operationId)
        )
      )
    if (previous) {
      if (previous.purchase.fingerprint !== fingerprint)
        groupFailure(
          409,
          "SHOP_IDEMPOTENCY_CONFLICT",
          "Operation ID was already used with different input"
        )
      return shopPurchaseReceipt(previous.purchase, previous.coin)
    }
    if (!deps.shopEnabled)
      groupFailure(503, "SHOP_DISABLED", "Shop is disabled")
    if (!deps.coin.enabled)
      groupFailure(503, "COIN_DISABLED", "SuicaoCoin is disabled")
    if (!deps.avatarFramesEnabled)
      groupFailure(403, "AVATAR_FRAMES_DISABLED", "Avatar frames are disabled")
    const frame = await frameById(tx, input.frameId, "update")
    if (frame.limited)
      groupFailure(
        403,
        "LIMITED_FRAME_PROTECTED",
        "Limited frames can only be obtained through their own banner"
      )
    const [ready] = await tx
      .select({ id: avatarFrame.id })
      .from(avatarFrame)
      .where(and(eq(avatarFrame.id, frame.id), eligible(deps.assetBaseUrl)))
    if (!ready || frame.shopPrice === null)
      groupFailure(
        409,
        "SHOP_FRAME_UNAVAILABLE",
        "Frame is not available for purchase"
      )
    if (
      frame.version !== input.expectedFrameVersion ||
      frame.shopPrice.toString() !== input.expectedPrice
    )
      groupFailure(
        409,
        "SHOP_QUOTE_CHANGED",
        "Frame or price changed; reload and confirm again"
      )
    const [owned] = await tx
      .select()
      .from(userAvatarFrame)
      .where(
        and(
          eq(userAvatarFrame.userId, actor),
          eq(userAvatarFrame.frameId, frame.id)
        )
      )
    if (owned && owned.revokedAt === null)
      groupFailure(409, "SHOP_ALREADY_OWNED", "Frame is already owned")
    if (frame.shopStock === 0)
      groupFailure(409, "SHOP_SOLD_OUT", "Frame is sold out")
    if (frame.shopVersion === 2_147_483_647)
      groupFailure(409, "SHOP_VERSION_CONFLICT", "Shop revision limit reached")

    const identity = await tx.execute<{ id: string }>(
      sql`select public.uuid_generate_v7() as id`
    )
    const id = identity.rows[0]!.id
    const financial = await deps.coin.apply(tx, {
      key,
      actorUserId: actor,
      sourceType: "shop.purchase",
      sourceId: id,
      entries: [
        {
          owner: { kind: "user", id: actor },
          mode: "debit",
          amount: frame.shopPrice.toString(),
        },
      ],
    })
    const now = parseISO(financial.createdAt)
    await tx
      .update(avatarFrame)
      .set({
        shopStock: frame.shopStock - 1,
        shopVersion: frame.shopVersion + 1,
        updatedAt: now,
      })
      .where(eq(avatarFrame.id, frame.id))
    await tx
      .insert(userAvatarFrame)
      .values({
        userId: actor,
        frameId: frame.id,
        source: "purchase",
        grantedByUserId: null,
        grantedAt: now,
      })
      .onConflictDoUpdate({
        target: [userAvatarFrame.userId, userAvatarFrame.frameId],
        set: {
          source: "purchase",
          grantedByUserId: null,
          grantedAt: now,
          revokedAt: null,
        },
      })
    const [purchase] = await tx
      .insert(shopPurchase)
      .values({
        id,
        actorUserId: actor,
        operationId: input.operationId,
        fingerprint,
        frameId: frame.id,
        frameCode: frame.code,
        frameName: frame.name,
        rarity: frame.rarity,
        price: frame.shopPrice,
        frameVersion: frame.version,
        coinOperationKey: key,
        createdAt: now,
      })
      .returning()
    await audit(
      tx,
      actor,
      "purchased",
      frame,
      "Avatar frame purchased with SuicaoCoin",
      {
        userId: actor,
        stock: frame.shopStock,
        shopVersion: frame.shopVersion,
        owned: false,
        source: owned?.source ?? null,
        grantedByUserId: owned?.grantedByUserId ?? null,
        grantedAt: owned ? formatTimestamp(owned.grantedAt) : null,
        revokedAt: owned?.revokedAt ? formatTimestamp(owned.revokedAt) : null,
      },
      {
        userId: actor,
        purchaseId: id,
        coinOperationKey: key,
        stock: frame.shopStock - 1,
        shopVersion: frame.shopVersion + 1,
        owned: true,
        source: "purchase",
      }
    )
    return shopPurchaseReceipt(purchase!, financial)
  })
}
