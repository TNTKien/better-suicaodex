import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { organization, user } from "./auth-schema.js"
import { chapter, comment, manga } from "./schema.js"
import type { CoinReceipt } from "../features/coin/contract.js"

const instant = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true })
const id = () =>
  uuid("id")
    .default(sql`public.uuid_generate_v7()`)
    .primaryKey()
export const coinWallet = pgTable(
  "coin_wallet",
  {
    id: id(),
    userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
    groupId: text("group_id").references(() => organization.id, {
      onDelete: "restrict",
    }),
    balance: bigint("balance", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    sequence: bigint("sequence", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    viewRemainderTenths: integer("view_remainder_tenths").notNull().default(0),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("coin_wallet_user_unique").on(t.userId),
    uniqueIndex("coin_wallet_group_unique").on(t.groupId),
    check(
      "coin_wallet_owner_check",
      sql`num_nonnulls(${t.userId}, ${t.groupId}) = 1`
    ),
    check(
      "coin_wallet_balance_check",
      sql`${t.balance} >= 0 AND ${t.sequence} >= 0`
    ),
    check(
      "coin_wallet_remainder_check",
      sql`${t.viewRemainderTenths} BETWEEN 0 AND 999 AND (${t.groupId} IS NOT NULL OR ${t.viewRemainderTenths} = 0)`
    ),
  ]
)
export const coinOperation = pgTable(
  "coin_operation",
  {
    key: text("key").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    transactionGroup: uuid("transaction_group").notNull().unique(),
    // Identity snapshot: deleting an actor must not rewrite an immutable receipt.
    actorUserId: text("actor_user_id"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    result: jsonb("result").$type<CoinReceipt>().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "coin_operation_fingerprint_check",
      sql`${t.fingerprint} ~ '^[0-9a-f]{64}$'`
    ),
    check("coin_operation_key_check", sql`length(${t.key}) BETWEEN 1 AND 240`),
    index("coin_operation_source_idx").on(t.sourceType, t.sourceId),
  ]
)
export const coinLedger = pgTable(
  "coin_ledger",
  {
    id: id(),
    operationKey: text("operation_key")
      .notNull()
      .references(() => coinOperation.key, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => coinWallet.id, { onDelete: "restrict" }),
    sequence: bigint("sequence", { mode: "bigint" }).notNull(),
    mode: text("mode").$type<"credit" | "debit" | "penalty">().notNull(),
    requestedAmount: bigint("requested_amount", { mode: "bigint" }).notNull(),
    delta: bigint("delta", { mode: "bigint" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "bigint" }).notNull(),
    referenceLedgerId: uuid("reference_ledger_id"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("coin_ledger_operation_position_unique").on(
      t.operationKey,
      t.position
    ),
    unique("coin_ledger_wallet_sequence_unique").on(t.walletId, t.sequence),
    foreignKey({
      columns: [t.referenceLedgerId],
      foreignColumns: [t.id],
    }).onDelete("restrict"),
    check(
      "coin_ledger_amount_check",
      sql`${t.requestedAmount} > 0 AND ${t.balanceAfter} >= 0 AND ${t.sequence} > 0 AND ${t.position} >= 0`
    ),
    check(
      "coin_ledger_delta_check",
      sql`(${t.mode} = 'credit' AND ${t.delta} = ${t.requestedAmount}) OR (${t.mode} = 'debit' AND ${t.delta} = -${t.requestedAmount}) OR (${t.mode} = 'penalty' AND ${t.delta} BETWEEN -${t.requestedAmount} AND 0)`
    ),
    index("coin_ledger_wallet_created_idx").on(
      t.walletId,
      t.createdAt.desc(),
      t.id
    ),
  ]
)
export const coinCommentReward = pgTable(
  "coin_comment_reward",
  {
    commentId: uuid("comment_id")
      .primaryKey()
      .references(() => comment.id, { onDelete: "restrict" }),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => coinWallet.id, { onDelete: "restrict" }),
    qualifying: boolean("qualifying").notNull().default(false),
    rewardedAmount: integer("rewarded_amount").notNull().default(0),
    reversalAmount: integer("reversal_amount").notNull().default(0),
    revision: bigint("revision", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "coin_comment_reward_state_check",
      sql`${t.rewardedAmount} BETWEEN 0 AND 1 AND ${t.reversalAmount} BETWEEN 0 AND 1 AND ${t.rewardedAmount} + ${t.reversalAmount} <= 1 AND ${t.revision} >= 0`
    ),
  ]
)
// One locked row per reader-session/chapter; E replaces it only after expiry.
export const coinViewReceipt = pgTable(
  "coin_view_receipt",
  {
    sessionHash: text("session_hash").notNull(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapter.id, { onDelete: "restrict" }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "restrict" }),
    eventId: uuid("event_id").notNull().defaultRandom().unique(),
    acceptedAt: instant("accepted_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
    allocations: jsonb("allocations")
      .$type<Array<{ groupId: string; creditedTenths: number }>>()
      .notNull()
      .default([]),
  },
  (t) => [
    primaryKey({ columns: [t.sessionHash, t.chapterId] }),
    check(
      "coin_view_receipt_session_check",
      sql`${t.sessionHash} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "coin_view_receipt_window_check",
      sql`${t.expiresAt} > ${t.acceptedAt}`
    ),
    index("coin_view_receipt_expiry_idx").on(t.expiresAt),
  ]
)
