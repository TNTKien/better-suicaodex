import { and, desc, eq, lt } from "drizzle-orm"
import {
  coinLedger,
  coinOperation,
  coinWallet,
  member,
  organization,
  translationGroupMemberProfile,
  translationGroupProfile,
} from "../../db/schema.js"
import {
  groupFailure,
  lockGroup,
  requireGroupManager,
} from "../groups/service.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { lockActiveCoinUser } from "./access.js"
import { coinGroupEligibility } from "./policy.js"
import type { CoinHistoryQuery, CoinTransferInput } from "./api-contract.js"
import type { CoinOwner } from "./contract.js"
import type { CoinService, CoinTransaction } from "./service.js"

const ownerCondition = (owner: CoinOwner) =>
  owner.kind === "user"
    ? eq(coinWallet.userId, owner.id)
    : eq(coinWallet.groupId, owner.id)

export async function readCoinWallet(tx: CoinTransaction, owner: CoinOwner) {
  const [wallet] = await tx
    .select({ balance: coinWallet.balance })
    .from(coinWallet)
    .where(ownerCondition(owner))
  return { balance: String(wallet?.balance ?? 0n) }
}

export async function readCoinHistory(
  tx: CoinTransaction,
  owner: CoinOwner,
  query: CoinHistoryQuery
) {
  const rows = await tx
    .select({
      id: coinLedger.id,
      sequence: coinLedger.sequence,
      delta: coinLedger.delta,
      balanceAfter: coinLedger.balanceAfter,
      requestedAmount: coinLedger.requestedAmount,
      mode: coinLedger.mode,
      referenceLedgerId: coinLedger.referenceLedgerId,
      sourceType: coinOperation.sourceType,
      sourceId: coinOperation.sourceId,
      actorUserId: coinOperation.actorUserId,
      transactionGroup: coinOperation.transactionGroup,
      createdAt: coinLedger.createdAt,
    })
    .from(coinLedger)
    .innerJoin(coinWallet, eq(coinWallet.id, coinLedger.walletId))
    .innerJoin(coinOperation, eq(coinOperation.key, coinLedger.operationKey))
    .where(
      and(
        ownerCondition(owner),
        query.cursor ? lt(coinLedger.sequence, BigInt(query.cursor)) : undefined
      )
    )
    .orderBy(desc(coinLedger.sequence))
    .limit(query.limit + 1)
  const data = rows.slice(0, query.limit).map((row) => ({
    ...row,
    sequence: String(row.sequence),
    delta: String(row.delta),
    balanceAfter: String(row.balanceAfter),
    requestedAmount: String(row.requestedAmount),
    createdAt: formatTimestamp(row.createdAt),
  }))
  return {
    data,
    meta: {
      limit: query.limit,
      nextCursor: rows.length > query.limit ? data.at(-1)!.sequence : null,
    },
  }
}

export async function lockCoinGroupManager(
  tx: CoinTransaction,
  actor: string,
  groupId: string,
  excluded: readonly string[]
) {
  const group = await lockGroup(tx, groupId)
  await lockActiveCoinUser(tx, actor)
  await requireGroupManager(tx, group, actor)
  const [eligible] = await tx
    .select({ id: organization.id })
    .from(organization)
    .innerJoin(
      translationGroupProfile,
      eq(translationGroupProfile.organizationId, organization.id)
    )
    .where(and(eq(organization.id, groupId), coinGroupEligibility(excluded)))
  if (!eligible)
    groupFailure(
      403,
      "COIN_GROUP_INELIGIBLE",
      "This group cannot use SuicaoCoin"
    )
}

export async function transferGroupCoin(
  tx: CoinTransaction,
  coin: CoinService,
  actor: string,
  groupId: string,
  input: CoinTransferInput,
  excluded: readonly string[]
) {
  await lockCoinGroupManager(tx, actor, groupId, excluded)
  await lockActiveCoinUser(tx, input.recipientUserId)
  const [recipient] = await tx
    .select({ id: member.id })
    .from(member)
    .innerJoin(
      translationGroupMemberProfile,
      eq(translationGroupMemberProfile.memberId, member.id)
    )
    .where(
      and(
        eq(member.organizationId, groupId),
        eq(member.userId, input.recipientUserId)
      )
    )
    .for("share")
  if (!recipient)
    groupFailure(
      403,
      "COIN_RECIPIENT_NOT_MEMBER",
      "Recipient must be an approved member of this group"
    )
  const receipt = await coin.apply(tx, {
    key: `transfer:${actor}:${input.operationId}`,
    actorUserId: actor,
    sourceType: "group.transfer",
    sourceId: groupId,
    entries: [
      {
        owner: { kind: "group", id: groupId },
        mode: "debit",
        amount: input.amount,
      },
      {
        owner: { kind: "user", id: input.recipientUserId },
        mode: "credit",
        amount: input.amount,
      },
    ],
  })
  return {
    operationId: input.operationId,
    transactionGroup: receipt.transactionGroup,
    groupId,
    recipientUserId: input.recipientUserId,
    amount: input.amount,
    balanceAfter: receipt.entries[0]!.balanceAfter,
    createdAt: receipt.createdAt,
  }
}
