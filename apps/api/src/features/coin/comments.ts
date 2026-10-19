import { createHash } from "node:crypto"
import { differenceInSeconds, isAfter, subSeconds } from "date-fns"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import { coinCommentReward, coinWallet, comment } from "../../db/schema.js"
import { groupFailure } from "../groups/service.js"
import { commentRewardWords, normalizedCommentText } from "../comments/text.js"
import type { CoinService, CoinTransaction } from "./service.js"

export function commentCreationFingerprint(input: {
  mangaId: string
  chapterId?: string | null
  parentId?: string
  body: string
}) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.mangaId,
        input.chapterId ?? null,
        input.parentId ?? null,
        input.body,
      ])
    )
    .digest("hex")
}

export async function lockCommentAuthor(tx: CoinTransaction, userId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`comment-author:${userId}`}, 0))`
  )
}

export async function guardCommentSpam(
  tx: CoinTransaction,
  userId: string,
  body: string,
  now: Date
) {
  const recent = await tx
    .select({ body: comment.body, createdAt: comment.createdAt })
    .from(comment)
    .where(
      and(
        eq(comment.userId, userId),
        gte(comment.createdAt, subSeconds(now, 30))
      )
    )
    .orderBy(desc(comment.createdAt))
  // Include hidden/deleted comments: deleting one must not bypass the cooldown.
  if (
    recent.some(
      (row) =>
        isAfter(row.createdAt, subSeconds(now, 30)) &&
        normalizedCommentText(row.body) === normalizedCommentText(body)
    )
  )
    groupFailure(
      429,
      "COMMENT_DUPLICATE",
      "Vui lòng không gửi bình luận trùng trong 30 giây"
    )
  if (recent[0] && differenceInSeconds(now, recent[0].createdAt) < 10)
    groupFailure(
      429,
      "COMMENT_COOLDOWN",
      "Vui lòng chờ 10 giây trước khi bình luận tiếp"
    )
}

// Caller holds the comment lock (or just inserted it); all writes share its tx.
export async function syncCommentCoin(
  tx: CoinTransaction,
  coin: CoinService,
  current: {
    id: string
    userId: string
    parentId: string | null
    body: string
    version: number
  },
  created = false
) {
  if (!coin.enabled || current.parentId) return
  const owner = { kind: "user" as const, id: current.userId }
  let [state] = await tx
    .select()
    .from(coinCommentReward)
    .where(eq(coinCommentReward.commentId, current.id))
    .for("update")
  // Missing state on an old/off-period comment cannot mint a historical reward.
  if (!state && !created) return
  if (!state) {
    await tx
      .insert(coinWallet)
      .values({ userId: current.userId })
      .onConflictDoNothing()
    const [wallet] = await tx
      .select({ id: coinWallet.id })
      .from(coinWallet)
      .where(eq(coinWallet.userId, current.userId))
    ;[state] = await tx
      .insert(coinCommentReward)
      .values({ commentId: current.id, walletId: wallet!.id })
      .returning()
  }
  const qualifying = commentRewardWords(current.body) >= 5
  if (state!.qualifying === qualifying) return
  const amount = qualifying
    ? state!.revision === 0n
      ? 1
      : state!.reversalAmount
    : state!.rewardedAmount
  let actual = 0
  if (amount) {
    const receipt = await coin.apply(tx, {
      key: `comment:${current.id}:${current.version}:reward`,
      actorUserId: current.userId,
      sourceType: "comment.reward",
      sourceId: current.id,
      entries: [
        {
          owner,
          mode: qualifying ? "credit" : "penalty",
          amount: String(amount),
        },
      ],
    })
    actual = Number(BigInt(receipt.entries[0]!.delta) * (qualifying ? 1n : -1n))
  }
  await tx
    .update(coinCommentReward)
    .set({
      qualifying,
      rewardedAmount: qualifying ? actual : 0,
      reversalAmount: qualifying ? 0 : actual,
      revision: state!.revision + 1n,
      updatedAt: new Date(),
    })
    .where(eq(coinCommentReward.commentId, current.id))
}

export async function penalizeCommentDelete(
  tx: CoinTransaction,
  coin: CoinService,
  current: { id: string; userId: string; version: number },
  actorUserId: string
) {
  if (!coin.enabled) return
  await coin.apply(tx, {
    key: `comment:${current.id}:delete`,
    actorUserId,
    sourceType: "comment.delete",
    sourceId: current.id,
    entries: [
      {
        owner: { kind: "user", id: current.userId },
        mode: "penalty",
        amount: "3",
      },
    ],
  })
  await tx
    .update(coinCommentReward)
    .set({
      qualifying: false,
      rewardedAmount: 0,
      reversalAmount: 0,
      revision: sql`${coinCommentReward.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(coinCommentReward.commentId, current.id))
}
