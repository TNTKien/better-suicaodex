import { createHash, randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import { coinLedger, coinOperation, coinWallet } from "../../db/schema.js"
import {
  CoinError,
  CoinOperationSchema,
  CoinOwnerSchema,
  MAX_COIN,
  type CoinOperation,
  type CoinOwner,
  type CoinReceipt,
} from "./contract.js"

export type CoinTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]
export type CoinService = ReturnType<typeof createCoinService>
const ownerKey = (owner: CoinOwner) => `${owner.kind}:${owner.id}`
const ownerCondition = (owner: CoinOwner) =>
  owner.kind === "user"
    ? eq(coinWallet.userId, owner.id)
    : eq(coinWallet.groupId, owner.id)

export async function lockCoinWallets(
  tx: CoinTransaction,
  owners: readonly CoinOwner[]
) {
  const unique = new Map(owners.map((owner) => [ownerKey(owner), owner]))
  const wallets = new Map<string, typeof coinWallet.$inferSelect>()
  for (const key of [...unique.keys()].sort()) {
    const owner = unique.get(key)!
    await tx
      .insert(coinWallet)
      .values(
        owner.kind === "user" ? { userId: owner.id } : { groupId: owner.id }
      )
      .onConflictDoNothing()
    const [wallet] = await tx
      .select()
      .from(coinWallet)
      .where(ownerCondition(owner))
      .for("update")
    if (!wallet) throw new Error("Coin wallet creation failed")
    wallets.set(key, wallet)
  }
  return wallets
}

async function apply(
  tx: CoinTransaction,
  input: CoinOperation
): Promise<CoinReceipt> {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
  // A transaction-scoped lock also covers lazy wallet creation and a lost COMMIT ACK.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`coin:${input.key}`}, 0))`
  )
  const [previous] = await tx
    .select()
    .from(coinOperation)
    .where(eq(coinOperation.key, input.key))
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new CoinError(
        "COIN_IDEMPOTENCY_CONFLICT",
        409,
        "Operation key was already used with different input"
      )
    return previous.result
  }

  // Always lock ALL touched wallets before changing any balance. Entry order can
  // still be debit then refund on one wallet (gacha); a refund cannot fund its debit.
  const wallets = await lockCoinWallets(
    tx,
    input.entries.map((entry) => entry.owner)
  )

  const createdAt = new Date()
  const receipt: CoinReceipt = {
    operationKey: input.key,
    transactionGroup: randomUUID(),
    createdAt: createdAt.toISOString(),
    entries: [],
  }
  for (const entry of input.entries) {
    const wallet = wallets.get(ownerKey(entry.owner))!
    const amount = BigInt(entry.amount)
    if (entry.referenceLedgerId) {
      const [reference] = await tx
        .select({ walletId: coinLedger.walletId })
        .from(coinLedger)
        .where(eq(coinLedger.id, entry.referenceLedgerId))
      if (reference?.walletId !== wallet.id)
        throw new CoinError(
          "COIN_REFERENCE_INVALID",
          400,
          "Referenced ledger entry must belong to the same wallet"
        )
    }
    if (entry.mode === "debit" && wallet.balance < amount)
      throw new CoinError(
        "COIN_INSUFFICIENT_BALANCE",
        409,
        "Insufficient coin balance"
      )
    const delta =
      entry.mode === "credit"
        ? amount
        : entry.mode === "penalty" && wallet.balance < amount
          ? -wallet.balance
          : -amount
    const balance = wallet.balance + delta
    if (balance > MAX_COIN || wallet.sequence === MAX_COIN)
      throw new CoinError(
        "COIN_AMOUNT_OVERFLOW",
        409,
        "Coin amount exceeds storage limit"
      )
    wallet.balance = balance
    wallet.sequence += 1n
    receipt.entries.push({
      id: randomUUID(),
      walletId: wallet.id,
      owner: entry.owner,
      mode: entry.mode,
      requestedAmount: entry.amount,
      delta: delta.toString(),
      balanceAfter: balance.toString(),
      sequence: wallet.sequence.toString(),
    })
  }

  await tx.insert(coinOperation).values({
    key: input.key,
    fingerprint,
    transactionGroup: receipt.transactionGroup,
    actorUserId: input.actorUserId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    result: receipt,
    createdAt,
  })
  await tx.insert(coinLedger).values(
    receipt.entries.map((entry, position) => ({
      id: entry.id,
      operationKey: input.key,
      position,
      walletId: entry.walletId,
      sequence: BigInt(entry.sequence),
      mode: entry.mode,
      requestedAmount: BigInt(entry.requestedAmount),
      delta: BigInt(entry.delta),
      balanceAfter: BigInt(entry.balanceAfter),
      referenceLedgerId: input.entries[position]!.referenceLedgerId,
      createdAt,
    }))
  )
  for (const wallet of wallets.values())
    await tx
      .update(coinWallet)
      .set({
        balance: wallet.balance,
        sequence: wallet.sequence,
        updatedAt: createdAt,
      })
      .where(eq(coinWallet.id, wallet.id))
  return receipt
}

export function createCoinService(options: { enabled?: boolean } = {}) {
  return {
    enabled: options.enabled === true,
    async apply(
      tx: CoinTransaction,
      operation: CoinOperation
    ): Promise<CoinReceipt> {
      if (options.enabled !== true)
        throw new CoinError("COIN_DISABLED", 503, "SuicaoCoin is disabled")
      const input = CoinOperationSchema.safeParse(operation)
      if (!input.success)
        throw new CoinError(
          "COIN_INVALID_OPERATION",
          400,
          "Invalid coin operation"
        )
      // A SAVEPOINT prevents partial writes if a caller catches a domain error.
      // Releasing it does not commit the caller's business transaction.
      return tx.transaction((savepoint) => apply(savepoint, input.data))
    },
  }
}

export async function reconcileCoinWallet(
  db: Pick<Database, "select">,
  owner: CoinOwner
) {
  const parsed = CoinOwnerSchema.parse(owner)
  const [row] = await db
    .select({
      walletId: coinWallet.id,
      balance: coinWallet.balance,
      sequence: coinWallet.sequence,
      ledgerBalance: sql<string>`coalesce(sum(${coinLedger.delta}), 0)::text`,
      ledgerCount: sql<string>`count(${coinLedger.id})::text`,
      lastSequence: sql<string>`coalesce(max(${coinLedger.sequence}), 0)::text`,
    })
    .from(coinWallet)
    .leftJoin(coinLedger, eq(coinLedger.walletId, coinWallet.id))
    .where(ownerCondition(parsed))
    .groupBy(coinWallet.id)
  if (!row)
    return {
      walletId: null,
      balance: "0",
      ledgerBalance: "0",
      sequence: "0",
      matches: true,
    }
  return {
    walletId: row.walletId,
    balance: row.balance.toString(),
    ledgerBalance: row.ledgerBalance,
    sequence: row.sequence.toString(),
    matches:
      row.balance === BigInt(row.ledgerBalance) &&
      row.sequence === BigInt(row.ledgerCount) &&
      row.sequence === BigInt(row.lastSequence),
  }
}
