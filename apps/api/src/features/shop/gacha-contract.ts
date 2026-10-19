import { createRoute, z } from "@hono/zod-openapi"
import {
  ApiErrorSchema,
  AvatarFrameSummarySchema,
  IdSchema,
  PageMetaSchema,
  SlugSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { CoinAmountSchema, PositiveCoinAmountSchema } from "../coin/contract.js"
import { CoinHistoryQuerySchema } from "../coin/api-contract.js"
import {
  ChestPoolQuerySchema,
  ChestQuerySchema,
  UpdateChestSchema,
} from "./gacha-chests.js"
import { GachaRollInputSchema } from "./gacha-rolls.js"
import { NORMAL_GACHA_RULE as rule } from "./gacha-policy.js"

const rarity = z.enum(["R", "SR", "SSR"])
const revision = z.number().int().min(1).max(2_147_483_647)
const digest = z.string().regex(/^[0-9a-f]{64}$/)
const count = z.number().int().nonnegative()
const counters = z.object({
  sinceSr: z
    .number()
    .int()
    .min(0)
    .max(rule.srPity - 1),
  sinceSsr: z
    .number()
    .int()
    .min(0)
    .max(rule.ssrPity - 1),
})
export const GachaRuleSchema = z
  .object({
    version: z.literal(rule.version),
    price: z.literal(rule.price),
    rateDenominator: z.literal(rule.rateDenominator),
    rates: z.object({
      R: z.literal(rule.rates.R),
      SR: z.literal(rule.rates.SR),
      SSR: z.literal(rule.rates.SSR),
    }),
    duplicateRefund: z.object({
      R: z.literal(rule.duplicateRefund.R),
      SR: z.literal(rule.duplicateRefund.SR),
      SSR: z.literal(rule.duplicateRefund.SSR),
    }),
    srPity: z.literal(rule.srPity),
    ssrPity: z.literal(rule.ssrPity),
  })
  .openapi("GachaRule")
export const ShopChestSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    kind: z.enum(["common", "topic"]),
    topic: z.object({ id: IdSchema.nullable(), name: z.string() }).nullable(),
    version: revision,
    saleEnabled: z.boolean(),
    retiredAt: TimestampSchema.nullable(),
    price: PositiveCoinAmountSchema,
    pool: z.object({ R: count, SR: count, SSR: count, total: count, digest }),
    ready: z.boolean(),
    blockReason: z.enum(["retired", "pool_unavailable"]).nullable(),
  })
  .openapi("ShopChest")
export const ShopChestCatalogSchema = z
  .object({
    data: z.array(ShopChestSchema),
    meta: PageMetaSchema,
    rule: GachaRuleSchema,
    rollEnabled: z.boolean(),
  })
  .openapi("ShopChestCatalog")
export const ShopChestDetailSchema = z
  .object({
    data: ShopChestSchema,
    rule: GachaRuleSchema,
    rollEnabled: z.boolean(),
  })
  .openapi("ShopChestDetail")
export const ShopChestPoolSchema = z
  .object({
    data: z.array(
      z.object({
        frame: AvatarFrameSummarySchema,
        code: SlugSchema,
        rarity,
        topic: z.object({ id: IdSchema, name: z.string() }).nullable(),
      })
    ),
    meta: PageMetaSchema,
    poolDigest: digest,
  })
  .openapi("ShopChestPool")
export const PersonalShopChestSchema = ShopChestDetailSchema.extend({
  balance: CoinAmountSchema,
  pity: counters.extend({ rollCount: CoinAmountSchema }),
  canRoll: z.boolean(),
  rollBlockReason: z
    .enum([
      "shop_disabled",
      "coin_disabled",
      "avatar_frames_disabled",
      "gacha_disabled",
      "chest_closed",
      "pool_unavailable",
      "sequence_limit",
      "insufficient_coin",
    ])
    .nullable(),
}).openapi("PersonalShopChest")
export const GachaReceiptSchema = z
  .object({
    id: IdSchema,
    operationId: IdSchema,
    chest: z.object({
      id: IdSchema,
      kind: z.enum(["common", "topic"]),
      name: z.string(),
      topicId: IdSchema.nullable(),
      version: revision,
    }),
    frame: z.object({
      id: IdSchema,
      code: SlugSchema,
      name: z.string(),
      rarity,
    }),
    ruleVersion: revision,
    poolDigest: digest,
    price: PositiveCoinAmountSchema,
    duplicate: z.boolean(),
    refund: CoinAmountSchema,
    pity: z.object({
      rollSequence: PositiveCoinAmountSchema,
      before: counters,
      after: counters,
    }),
    transactionGroup: IdSchema,
    debitLedgerId: IdSchema,
    refundLedgerId: IdSchema.nullable(),
    sequence: PositiveCoinAmountSchema,
    balanceAfter: CoinAmountSchema,
    createdAt: TimestampSchema,
  })
  .openapi("GachaReceipt")
export const GachaHistoryQuerySchema = CoinHistoryQuerySchema.strict()
export const GachaHistorySchema = z
  .object({
    data: z.array(GachaReceiptSchema),
    meta: z.object({
      limit: z.number().int().min(1).max(100),
      nextCursor: PositiveCoinAmountSchema.nullable(),
    }),
  })
  .openapi("GachaHistory")
const response = <T extends z.ZodType>(
  schema: T,
  description = "Gacha response"
) => ({
  description,
  content: { "application/json": { schema } },
})
const errors = {
  400: response(ApiErrorSchema),
  401: response(ApiErrorSchema),
  403: response(ApiErrorSchema),
  404: response(ApiErrorSchema),
  429: response(ApiErrorSchema, "Rate limit exceeded"),
  503: response(ApiErrorSchema),
}
const chestParams = z.object({
  chestId: IdSchema.transform((value) => value.toLowerCase()),
})
export const shopChestsRoute = createRoute({
  method: "get",
  path: "/v1/shop/chests",
  tags: ["shop"],
  request: { query: ChestQuerySchema },
  responses: { 200: response(ShopChestCatalogSchema), ...errors },
})
export const shopChestRoute = createRoute({
  method: "get",
  path: "/v1/shop/chests/{chestId}",
  tags: ["shop"],
  request: { params: chestParams },
  responses: { 200: response(ShopChestDetailSchema), ...errors },
})
export const shopChestPoolRoute = createRoute({
  method: "get",
  path: "/v1/shop/chests/{chestId}/pool",
  tags: ["shop"],
  request: { params: chestParams, query: ChestPoolQuerySchema },
  responses: { 200: response(ShopChestPoolSchema), ...errors },
})
export const personalShopChestRoute = createRoute({
  method: "get",
  path: "/v1/me/shop/chests/{chestId}",
  tags: ["shop"],
  request: { params: chestParams },
  responses: { 200: response(PersonalShopChestSchema), ...errors },
})
export const rollShopGachaRoute = createRoute({
  method: "post",
  path: "/v1/me/shop/gacha-rolls",
  tags: ["shop"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: GachaRollInputSchema.openapi("GachaRollInput"),
        },
      },
    },
  },
  responses: {
    200: response(
      z.object({ data: GachaReceiptSchema }),
      "Committed roll or original receipt on retry; refetch wallet/inventory/pity for current state"
    ),
    ...errors,
    409: response(
      ApiErrorSchema,
      "Quote, pool, balance or operation ID conflict; closed chest"
    ),
    413: response(ApiErrorSchema, "Request body exceeds 16 KiB"),
  },
})
export const personalGachaRollRoute = createRoute({
  method: "get",
  path: "/v1/me/shop/gacha-rolls/{operationId}",
  tags: ["shop"],
  request: {
    params: z.object({
      operationId: IdSchema.transform((value) => value.toLowerCase()),
    }),
  },
  responses: {
    200: response(
      z.object({ data: GachaReceiptSchema }),
      "Actor-only immutable receipt; missing or another actor's receipt returns 404, even with features disabled"
    ),
    ...errors,
  },
})
export const personalGachaHistoryRoute = createRoute({
  method: "get",
  path: "/v1/me/shop/gacha-rolls",
  tags: ["shop"],
  request: { query: GachaHistoryQuerySchema },
  responses: {
    200: response(
      GachaHistorySchema,
      "Private history by descending personal debit ledger sequence, available with features disabled"
    ),
    ...errors,
  },
})
export const adminShopChestsRoute = createRoute({
  method: "get",
  path: "/v1/admin/shop/chests",
  tags: ["shop", "admin"],
  request: { query: ChestQuerySchema },
  responses: {
    200: response(
      ShopChestCatalogSchema,
      "Administrator catalog, including retired chests"
    ),
    ...errors,
  },
})
export const updateShopChestRoute = createRoute({
  method: "patch",
  path: "/v1/admin/shop/chests/{chestId}",
  tags: ["shop", "admin"],
  request: {
    params: chestParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateChestSchema.openapi("UpdateShopChestInput"),
        },
      },
    },
  },
  responses: {
    200: response(z.object({ data: ShopChestSchema })),
    ...errors,
    409: response(
      ApiErrorSchema,
      "Chest revision conflict or incomplete R/SR/SSR pool"
    ),
    413: response(ApiErrorSchema, "Request body exceeds 16 KiB"),
  },
})
