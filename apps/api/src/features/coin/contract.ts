import { z } from "zod"

export const MAX_COIN = 9_223_372_036_854_775_807n
export const CoinAmountSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .pipe(
    z
      .string()
      .refine(
        (value) => BigInt(value) <= MAX_COIN,
        "Coin amount exceeds BIGINT"
      )
  )
export const PositiveCoinAmountSchema = CoinAmountSchema.refine(
  (value) => value !== "0",
  "Coin amount must be positive"
)
export const CoinOwnerSchema = z
  .object({
    kind: z.enum(["user", "group"]),
    id: z.string().min(1).max(128),
  })
  .strict()
export const CoinOperationSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(240)
      .regex(/^[A-Za-z0-9:._/-]+$/),
    actorUserId: z.string().min(1).max(128).nullable(),
    sourceType: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_.-]*$/),
    sourceId: z.string().min(1).max(240),
    entries: z
      .array(
        z
          .object({
            owner: CoinOwnerSchema,
            mode: z.enum(["credit", "debit", "penalty"]),
            amount: PositiveCoinAmountSchema,
            referenceLedgerId: z.uuid().optional(),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict()
export const CoinEntryResultSchema = z.object({
  id: z.uuid(),
  walletId: z.uuid(),
  owner: CoinOwnerSchema,
  mode: z.enum(["credit", "debit", "penalty"]),
  requestedAmount: PositiveCoinAmountSchema,
  delta: z.string().regex(/^-?(0|[1-9][0-9]*)$/),
  balanceAfter: CoinAmountSchema,
  sequence: PositiveCoinAmountSchema,
})
export const CoinReceiptSchema = z.object({
  operationKey: z.string(),
  transactionGroup: z.uuid(),
  createdAt: z.iso.datetime(),
  entries: z.array(CoinEntryResultSchema),
})
export type CoinOwner = z.infer<typeof CoinOwnerSchema>
export type CoinOperation = z.infer<typeof CoinOperationSchema>
export type CoinReceipt = z.infer<typeof CoinReceiptSchema>

export class CoinError extends Error {
  constructor(
    readonly code:
      | "COIN_DISABLED"
      | "COIN_INVALID_OPERATION"
      | "COIN_INSUFFICIENT_BALANCE"
      | "COIN_AMOUNT_OVERFLOW"
      | "COIN_IDEMPOTENCY_CONFLICT"
      | "COIN_REFERENCE_INVALID",
    readonly status: 400 | 409 | 503,
    message: string
  ) {
    super(message)
    this.name = "CoinError"
  }
}
