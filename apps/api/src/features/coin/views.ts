import { randomUUID } from "node:crypto"
import { addMilliseconds, addSeconds, isBefore, subSeconds } from "date-fns"
import { and, eq } from "drizzle-orm"
import { chapterStats, coinViewReceipt, coinWallet } from "../../db/schema.js"
import { addViewEngagement } from "../ranking/engagement.js"
import { CHAPTER_VIEW_WINDOW_SECONDS } from "../views/tracking.js"
import { eligibleCoinGroups } from "./policy.js"
import {
  lockCoinWallets,
  type CoinService,
  type CoinTransaction,
} from "./service.js"
import type { CoinOperation } from "./contract.js"

// Round 1/count to one decimal, half up, without floating-point accumulation.
export function creditedTenthsForGroups(count: number) {
  if (!Number.isSafeInteger(count) || count < 1) return 0
  const n = BigInt(count)
  return Number((20n + n) / (2n * n))
}

export async function acceptCoinView(
  tx: CoinTransaction,
  coin: CoinService,
  input: {
    sessionHash: string
    chapterId: string
    mangaId: string
    now: Date
    excludedGroupIds: readonly string[]
    cachedRemainingMilliseconds?: number
  }
) {
  const condition = and(
    eq(coinViewReceipt.sessionHash, input.sessionHash),
    eq(coinViewReceipt.chapterId, input.chapterId)
  )
  const values = {
    sessionHash: input.sessionHash,
    chapterId: input.chapterId,
    mangaId: input.mangaId,
    eventId: randomUUID(),
    acceptedAt: input.now,
    expiresAt: addSeconds(input.now, CHAPTER_VIEW_WINDOW_SECONDS),
  }
  const inserted = await tx
    .insert(coinViewReceipt)
    .values(values)
    .onConflictDoNothing()
    .returning({ eventId: coinViewReceipt.eventId })
  const [previous] = await tx
    .select()
    .from(coinViewReceipt)
    .where(condition)
    .for("update")
  if (!inserted.length && isBefore(input.now, previous!.expiresAt)) {
    const [stats] = await tx
      .select({ views: chapterStats.views })
      .from(chapterStats)
      .where(eq(chapterStats.chapterId, input.chapterId))
    return {
      counted: false,
      alreadyCounted: true,
      viewCount: Number(stats?.views ?? 0n),
    }
  }
  // Carry over the remaining cache TTL, without ranking/reward or renewing 12h.
  const cachedTtl = input.cachedRemainingMilliseconds ?? 0
  if (cachedTtl > 0) {
    const expiresAt = addMilliseconds(
      input.now,
      Math.min(cachedTtl, CHAPTER_VIEW_WINDOW_SECONDS * 1000)
    )
    await tx
      .update(coinViewReceipt)
      .set({
        ...values,
        acceptedAt: subSeconds(expiresAt, CHAPTER_VIEW_WINDOW_SECONDS),
        expiresAt,
        allocations: [],
      })
      .where(condition)
    const [stats] = await tx
      .select({ views: chapterStats.views })
      .from(chapterStats)
      .where(eq(chapterStats.chapterId, input.chapterId))
    return {
      counted: false,
      alreadyCounted: true,
      viewCount: Number(stats?.views ?? 0n),
    }
  }
  const groups = await eligibleCoinGroups(
    tx,
    input.mangaId,
    input.excludedGroupIds
  ).for("share")
  const share = creditedTenthsForGroups(groups.length)
  const viewCount = await addViewEngagement(
    tx,
    input.chapterId,
    input.mangaId,
    input.now
  )
  const allocations = groups.map(({ groupId }) => ({
    groupId,
    creditedTenths: share,
  }))
  const owners = groups
    .filter(() => share > 0)
    .map(({ groupId }) => ({ kind: "group" as const, id: groupId }))
  const wallets = await lockCoinWallets(tx, owners)
  const entries: CoinOperation["entries"] = []
  for (const wallet of wallets.values()) {
    const total = wallet.viewRemainderTenths + share
    if (total >= 1000)
      entries.push({
        owner: { kind: "group", id: wallet.groupId! },
        mode: "credit",
        amount: "1",
      })
    await tx
      .update(coinWallet)
      .set({ viewRemainderTenths: total % 1000, updatedAt: input.now })
      .where(eq(coinWallet.id, wallet.id))
  }
  // The locked session/chapter receipt serializes this event before wallet locks;
  // no other caller can submit its unique event key in reverse lock order.
  if (entries.length)
    await coin.apply(tx, {
      key: `view:${values.eventId}`,
      actorUserId: null,
      sourceType: "view.credit",
      sourceId: values.eventId,
      entries,
    })
  await tx
    .update(coinViewReceipt)
    .set({ ...values, allocations })
    .where(condition)
  return { counted: true, alreadyCounted: false, viewCount }
}
