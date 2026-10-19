import { and, desc, eq, lt, sql } from "drizzle-orm"
import { z } from "@hono/zod-openapi"
import { parseISO } from "date-fns"
import type { Database } from "../../db/client.js"
import {
  avatarFrameTopic,
  coinLedger,
  coinOperation,
  moderationAction,
  shopChest,
  shopGachaRoll,
  shopGachaState,
  userAvatarFrame,
} from "../../db/schema.js"
import { IdSchema } from "../../shared/contract.js"
import { stableHash } from "../../shared/cache.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { frameById } from "../avatar-frames/service.js"
import { lockActiveCoinUser } from "../coin/access.js"
import {
  MAX_COIN,
  PositiveCoinAmountSchema,
  type CoinReceipt,
} from "../coin/contract.js"
import type { CoinService } from "../coin/service.js"
import type { CoinHistoryQuery } from "../coin/api-contract.js"
import { groupFailure } from "../groups/service.js"
import { lockGachaCatalog } from "./gacha-catalog.js"
import {
  readGachaPool,
  summarizeGachaPool,
  type GachaDependencies,
} from "./gacha-chests.js"
import { drawGacha } from "./gacha-draw.js"
import { NORMAL_GACHA_RULE } from "./gacha-policy.js"

export const GachaRollInputSchema = z
  .object({
    operationId: IdSchema.transform((value) => value.toLowerCase()),
    chestId: IdSchema.transform((value) => value.toLowerCase()),
    expectedChestVersion: z.number().int().min(1).max(2_147_483_647),
    expectedRuleVersion: z.number().int().min(1).max(2_147_483_647),
    expectedPoolDigest: z.string().regex(/^[0-9a-f]{64}$/),
    expectedPrice: PositiveCoinAmountSchema,
  })
  .strict()
export type GachaRollInput = z.infer<typeof GachaRollInputSchema>

export function gachaRollReceipt(
  row: typeof shopGachaRoll.$inferSelect,
  coin: CoinReceipt
) {
  const debit = coin.entries[0]!,
    refund = coin.entries[1]
  return {
    id: row.id,
    operationId: row.operationId,
    chest: {
      id: row.chestId,
      kind: row.chestKind,
      name: row.chestName,
      topicId: row.topicId,
      version: row.chestVersion,
    },
    frame: {
      id: row.frameId,
      code: row.frameCode,
      name: row.frameName,
      rarity: row.rarity,
    },
    ruleVersion: row.ruleVersion,
    poolDigest: row.poolDigest,
    price: row.price.toString(),
    duplicate: row.duplicate,
    refund: row.refund.toString(),
    pity: {
      rollSequence: row.rollSequence.toString(),
      before: { sinceSr: row.sinceSrBefore, sinceSsr: row.sinceSsrBefore },
      after: { sinceSr: row.sinceSrAfter, sinceSsr: row.sinceSsrAfter },
    },
    transactionGroup: coin.transactionGroup,
    debitLedgerId: debit.id,
    refundLedgerId: refund?.id ?? null,
    sequence: debit.sequence,
    balanceAfter: (refund ?? debit).balanceAfter,
    createdAt: formatTimestamp(row.createdAt),
  }
}
export type GachaReceipt = ReturnType<typeof gachaRollReceipt>

export async function personalGachaRoll(
  database: Database,
  actor: string,
  operationId: string
) {
  return database.transaction(async (tx) => {
    await lockActiveCoinUser(tx, actor)
    const [row] = await tx
      .select({ roll: shopGachaRoll, coin: coinOperation.result })
      .from(shopGachaRoll)
      .innerJoin(
        coinOperation,
        eq(coinOperation.key, shopGachaRoll.coinOperationKey)
      )
      .where(
        and(
          eq(shopGachaRoll.actorUserId, actor),
          eq(shopGachaRoll.operationId, operationId)
        )
      )
    if (!row) groupFailure(404, "NOT_FOUND", "Gacha receipt not found")
    return { data: gachaRollReceipt(row.roll, row.coin) }
  })
}

export async function personalGachaHistory(
  database: Database,
  actor: string,
  input: CoinHistoryQuery
) {
  return database.transaction(async (tx) => {
    await lockActiveCoinUser(tx, actor)
    const rows = await tx
      .select({ roll: shopGachaRoll, coin: coinOperation.result })
      .from(shopGachaRoll)
      .innerJoin(
        coinOperation,
        eq(coinOperation.key, shopGachaRoll.coinOperationKey)
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
          eq(shopGachaRoll.actorUserId, actor),
          input.cursor
            ? lt(coinLedger.sequence, BigInt(input.cursor))
            : undefined
        )
      )
      .orderBy(desc(coinLedger.sequence))
      .limit(input.limit + 1)
    const data = rows
      .slice(0, input.limit)
      .map((row) => gachaRollReceipt(row.roll, row.coin))
    return {
      data,
      meta: {
        limit: input.limit,
        nextCursor: rows.length > input.limit ? data.at(-1)!.sequence : null,
      },
    }
  })
}

export async function rollShopGacha(
  deps: Omit<GachaDependencies, "coinEnabled"> & { coin: CoinService },
  actor: string,
  rawInput: unknown,
  // Server-only test seam; request input is strict and never supplies RNG.
  rng?: Parameters<typeof drawGacha>[2]
): Promise<GachaReceipt> {
  const parsed = GachaRollInputSchema.safeParse(rawInput)
  if (!parsed.success)
    groupFailure(400, "VALIDATION_ERROR", "Invalid gacha input")
  const { operationId, ...quote } = parsed.data
  const key = `shop.gacha:${actor}:${operationId}`
  const fingerprint = stableHash(quote)
  return deps.database.transaction(
    async (tx) => {
      await lockActiveCoinUser(tx, actor)
      // Same operation namespace as coin.apply, before state/catalog/frame/wallet.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`coin:${key}`}, 0))`
      )
      const [previous] = await tx
        .select({ roll: shopGachaRoll, coin: coinOperation.result })
        .from(shopGachaRoll)
        .innerJoin(
          coinOperation,
          eq(coinOperation.key, shopGachaRoll.coinOperationKey)
        )
        .where(
          and(
            eq(shopGachaRoll.actorUserId, actor),
            eq(shopGachaRoll.operationId, operationId)
          )
        )
      if (previous) {
        if (previous.roll.fingerprint !== fingerprint)
          groupFailure(
            409,
            "GACHA_IDEMPOTENCY_CONFLICT",
            "Operation ID was already used with different input"
          )
        return gachaRollReceipt(previous.roll, previous.coin)
      }
      if (!deps.shopEnabled)
        groupFailure(503, "SHOP_DISABLED", "Shop is disabled")
      if (!deps.coin.enabled)
        groupFailure(503, "COIN_DISABLED", "SuicaoCoin is disabled")
      if (!deps.avatarFramesEnabled)
        groupFailure(
          403,
          "AVATAR_FRAMES_DISABLED",
          "Avatar frames are disabled"
        )
      if (!deps.gachaEnabled)
        groupFailure(503, "GACHA_DISABLED", "Gacha is disabled")

      await tx
        .insert(shopGachaState)
        .values({ userId: actor })
        .onConflictDoNothing()
      const [state] = await tx
        .select()
        .from(shopGachaState)
        .where(eq(shopGachaState.userId, actor))
        .for("update")
      if (!state) throw new Error("Gacha state creation failed")
      if (state.rollCount === MAX_COIN)
        groupFailure(
          409,
          "COIN_AMOUNT_OVERFLOW",
          "Gacha sequence exceeds storage limit"
        )
      await lockGachaCatalog(tx, "share")
      const [current] = await tx
        .select()
        .from(shopChest)
        .where(eq(shopChest.id, quote.chestId))
      if (!current || current.retiredAt)
        groupFailure(404, "NOT_FOUND", "Chest not found")
      if (current.topicId)
        await tx
          .select({ id: avatarFrameTopic.id })
          .from(avatarFrameTopic)
          .where(eq(avatarFrameTopic.id, current.topicId))
          .for("share")
      const [chest] = await tx
        .select()
        .from(shopChest)
        .where(eq(shopChest.id, current.id))
        .for("share")
      if (!chest || chest.retiredAt)
        groupFailure(404, "NOT_FOUND", "Chest not found")
      if (!chest.saleEnabled)
        groupFailure(409, "GACHA_CHEST_CLOSED", "Chest is not on sale")
      const rows = await readGachaPool(tx, deps.assetBaseUrl, chest)
      const summary = summarizeGachaPool(rows)
      if (!summary.R || !summary.SR || !summary.SSR)
        groupFailure(
          409,
          "GACHA_POOL_UNAVAILABLE",
          "Chest must contain R, SR and SSR frames"
        )
      const rule = NORMAL_GACHA_RULE
      if (
        chest.version !== quote.expectedChestVersion ||
        rule.version !== quote.expectedRuleVersion ||
        rule.price !== quote.expectedPrice ||
        summary.digest !== quote.expectedPoolDigest
      )
        groupFailure(
          409,
          "GACHA_QUOTE_CHANGED",
          "Chest, rule or pool changed; reload and confirm again"
        )
      const pool = {
        R: rows.filter((f) => f.rarity === "R"),
        SR: rows.filter((f) => f.rarity === "SR"),
        SSR: rows.filter((f) => f.rarity === "SSR"),
      }
      const draw = drawGacha(pool, state, rng)
      // UPDATE, not SHARE: purchase also locks frame before ownership/wallet.
      const frame = await frameById(tx, draw.frame.id, "update")
      const [owned] = await tx
        .select()
        .from(userAvatarFrame)
        .where(
          and(
            eq(userAvatarFrame.userId, actor),
            eq(userAvatarFrame.frameId, frame.id)
          )
        )
      const duplicate = !!owned && owned.revokedAt === null
      const refund = duplicate ? rule.duplicateRefund[draw.rarity] : "0"
      const identity = await tx.execute<{ id: string }>(
        sql`SELECT public.uuid_generate_v7() AS id`
      )
      const id = identity.rows[0]!.id
      const owner = { kind: "user" as const, id: actor }
      const financial = await deps.coin.apply(tx, {
        key,
        actorUserId: actor,
        sourceType: "shop.gacha",
        sourceId: id,
        entries: [
          { owner, mode: "debit", amount: rule.price },
          ...(duplicate
            ? [{ owner, mode: "credit" as const, amount: refund }]
            : []),
        ],
      })
      const now = parseISO(financial.createdAt)
      if (!duplicate)
        await tx
          .insert(userAvatarFrame)
          .values({
            userId: actor,
            frameId: frame.id,
            source: "gacha",
            grantedByUserId: null,
            grantedAt: now,
          })
          .onConflictDoUpdate({
            target: [userAvatarFrame.userId, userAvatarFrame.frameId],
            set: {
              source: "gacha",
              grantedByUserId: null,
              grantedAt: now,
              revokedAt: null,
            },
          })
      const rollSequence = state.rollCount + 1n
      await tx
        .update(shopGachaState)
        .set({ ...draw.pity, rollCount: rollSequence, updatedAt: now })
        .where(eq(shopGachaState.userId, actor))
      const [roll] = await tx
        .insert(shopGachaRoll)
        .values({
          id,
          actorUserId: actor,
          operationId,
          fingerprint,
          chestId: chest.id,
          chestKind: chest.kind,
          chestName:
            chest.kind === "common"
              ? "Rương thường"
              : `Rương ${chest.topicName}`,
          topicId: chest.topicId,
          chestVersion: chest.version,
          ruleVersion: rule.version,
          ruleSnapshot: rule,
          poolDigest: summary.digest,
          frameId: frame.id,
          frameCode: frame.code,
          frameName: frame.name,
          frameVersion: frame.version,
          rarity: draw.rarity,
          price: BigInt(rule.price),
          duplicate,
          refund: BigInt(refund),
          rollSequence,
          sinceSrBefore: state.sinceSr,
          sinceSsrBefore: state.sinceSsr,
          sinceSrAfter: draw.pity.sinceSr,
          sinceSsrAfter: draw.pity.sinceSsr,
          coinOperationKey: key,
          createdAt: now,
        })
        .returning()
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "shop.gacha_rolled",
        targetKind: "shop_chest",
        targetId: chest.id,
        reason: "Avatar frame chest opened with SuicaoCoin",
        before: {
          sinceSr: state.sinceSr,
          sinceSsr: state.sinceSsr,
          rollCount: state.rollCount.toString(),
          owned: duplicate,
        },
        after: {
          userId: actor,
          receiptId: id,
          coinOperationKey: key,
          frameId: frame.id,
          rarity: draw.rarity,
          duplicate,
          refund,
          ...draw.pity,
          rollCount: rollSequence.toString(),
        },
      })
      return gachaRollReceipt(roll!, financial)
    },
    { isolationLevel: "read committed" }
  )
}
