import { createRoute, z } from "@hono/zod-openapi"
import { ApiErrorSchema, TimestampSchema } from "../../shared/contract.js"
import { CoinAmountSchema, PositiveCoinAmountSchema } from "./contract.js"

const WalletSchema = z
  .object({ balance: CoinAmountSchema })
  .openapi("CoinWallet")
const HistorySchema = z
  .object({
    data: z.array(
      z.object({
        id: z.uuid(),
        sequence: PositiveCoinAmountSchema,
        delta: z.string().regex(/^-?(0|[1-9][0-9]*)$/),
        balanceAfter: CoinAmountSchema,
        requestedAmount: PositiveCoinAmountSchema,
        mode: z.enum(["credit", "debit", "penalty"]),
        referenceLedgerId: z.uuid().nullable(),
        sourceType: z.string(),
        sourceId: z.string(),
        actorUserId: z.string().nullable(),
        transactionGroup: z.uuid(),
        createdAt: TimestampSchema,
      })
    ),
    meta: z.object({
      limit: z.number().int(),
      nextCursor: PositiveCoinAmountSchema.nullable(),
    }),
  })
  .openapi("CoinHistory")
export const TransferInputSchema = z
  .object({
    recipientUserId: z.string().min(1).max(128),
    amount: PositiveCoinAmountSchema,
    operationId: z.uuid().toLowerCase(),
  })
  .strict()
  .openapi("CoinTransferInput")
const TransferSchema = z
  .object({
    operationId: z.uuid(),
    transactionGroup: z.uuid(),
    groupId: z.string(),
    recipientUserId: z.string(),
    amount: PositiveCoinAmountSchema,
    balanceAfter: CoinAmountSchema,
    createdAt: TimestampSchema,
  })
  .openapi("CoinTransfer")
const groupParams = z.object({ groupId: z.uuid().toLowerCase() })
export const CoinHistoryQuerySchema = z.object({
  cursor: PositiveCoinAmountSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
const json = <T extends z.ZodType>(schema: T) => ({
  content: { "application/json": { schema } },
})
const errors = {
  400: { ...json(ApiErrorSchema), description: "Invalid input" },
  401: { ...json(ApiErrorSchema), description: "Authentication required" },
  403: {
    ...json(ApiErrorSchema),
    description: "Account, membership or origin denied",
  },
  404: { ...json(ApiErrorSchema), description: "Group not found" },
  409: {
    ...json(ApiErrorSchema),
    description: "Insufficient balance or idempotency conflict",
  },
  503: { ...json(ApiErrorSchema), description: "SuicaoCoin disabled" },
}
const tags = ["coin"]
export const myWalletRoute = createRoute({
  method: "get",
  path: "/v1/me/coin-wallet",
  tags,
  responses: {
    200: {
      ...json(WalletSchema),
      description: "Private personal balance; zero for an uncreated wallet",
    },
    ...errors,
  },
})
export const myCoinHistoryRoute = createRoute({
  method: "get",
  path: "/v1/me/coin-wallet/transactions",
  tags,
  request: { query: CoinHistoryQuerySchema },
  responses: {
    200: {
      ...json(HistorySchema),
      description: "Private ledger, descending sequence",
    },
    ...errors,
  },
})
export const groupWalletRoute = createRoute({
  method: "get",
  path: "/v1/contribution/groups/{groupId}/coin-wallet",
  tags,
  request: { params: groupParams },
  responses: {
    200: {
      ...json(WalletSchema),
      description: "Group balance for its leader/admin",
    },
    ...errors,
  },
})
export const groupCoinHistoryRoute = createRoute({
  method: "get",
  path: "/v1/contribution/groups/{groupId}/coin-wallet/transactions",
  tags,
  request: { params: groupParams, query: CoinHistoryQuerySchema },
  responses: {
    200: {
      ...json(HistorySchema),
      description: "Group ledger for its leader/admin",
    },
    ...errors,
  },
})
export const transferCoinRoute = createRoute({
  method: "post",
  path: "/v1/contribution/groups/{groupId}/coin-wallet/transfers",
  tags,
  request: {
    params: groupParams,
    body: { ...json(TransferInputSchema), required: true },
  },
  responses: {
    200: {
      ...json(TransferSchema),
      description:
        "Committed transfer, or original receipt on retry; no recipient balance disclosed",
    },
    ...errors,
  },
})
export type CoinTransferInput = z.infer<typeof TransferInputSchema>
export type CoinHistoryQuery = z.infer<typeof CoinHistoryQuerySchema>
