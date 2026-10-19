import { createRoute, z } from "@hono/zod-openapi"
import {
  ApiErrorSchema,
  AvatarFrameSummarySchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  SlugSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { CoinAmountSchema, PositiveCoinAmountSchema } from "../coin/contract.js"
import { CoinHistoryQuerySchema } from "../coin/api-contract.js"

export const ShopCatalogQuerySchema = PageQuerySchema.extend({
  q: z.string().trim().min(1).max(160).optional(),
  rarity: z.enum(["R", "SR", "SSR"]).optional(),
  topicId: z.union([IdSchema, z.literal("none")]).optional(),
}).strict()
export const ShopPurchaseInputSchema = z
  .object({
    operationId: IdSchema.transform((value) => value.toLowerCase()),
    frameId: IdSchema.transform((value) => value.toLowerCase()),
    expectedFrameVersion: z.number().int().min(1).max(2_147_483_647),
    expectedPrice: PositiveCoinAmountSchema,
  })
  .strict()
  .openapi("ShopPurchaseInput")
export const ShopPurchaseReceiptSchema = z
  .object({
    id: IdSchema,
    operationId: IdSchema,
    frame: z.object({
      id: IdSchema,
      code: SlugSchema,
      name: z.string(),
      rarity: z.enum(["R", "SR", "SSR"]),
    }),
    price: PositiveCoinAmountSchema,
    transactionGroup: IdSchema,
    ledgerId: IdSchema,
    sequence: PositiveCoinAmountSchema,
    balanceAfter: CoinAmountSchema,
    createdAt: TimestampSchema,
  })
  .openapi("ShopPurchaseReceipt")
export type ShopPurchaseInput = z.infer<typeof ShopPurchaseInputSchema>
export type ShopPurchaseReceipt = z.infer<typeof ShopPurchaseReceiptSchema>
export const ShopPurchaseHistoryQuerySchema = CoinHistoryQuerySchema.strict()
export const ShopPurchaseHistorySchema = z
  .object({
    data: z.array(ShopPurchaseReceiptSchema),
    meta: z.object({
      limit: z.number().int().min(1).max(100),
      nextCursor: PositiveCoinAmountSchema.nullable(),
    }),
  })
  .openapi("ShopPurchaseHistory")
export const ShopAvatarFrameSchema = z
  .object({
    frame: AvatarFrameSummarySchema,
    code: SlugSchema,
    description: z.string(),
    topic: z.object({ id: IdSchema, name: z.string() }).nullable(),
    rarity: z.enum(["R", "SR", "SSR"]),
    price: PositiveCoinAmountSchema,
    stock: z.number().int().nonnegative(),
    frameVersion: z.number().int().positive(),
    availability: z.enum(["in_stock", "sold_out"]),
  })
  .openapi("ShopAvatarFrame")
const privateFrame = ShopAvatarFrameSchema.extend({
  owned: z.boolean(),
  canPurchase: z.boolean(),
  purchaseBlockReason: z
    .enum([
      "shop_disabled",
      "coin_disabled",
      "avatar_frames_disabled",
      "already_owned",
      "sold_out",
      "insufficient_coin",
    ])
    .nullable(),
}).openapi("PersonalShopAvatarFrame")
const publicCatalog = z.object({
  data: z.array(ShopAvatarFrameSchema),
  meta: PageMetaSchema,
  purchaseEnabled: z.boolean(),
})
const response = <T extends z.ZodType>(
  schema: T,
  description = "Shop catalog"
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
export const shopCatalogRoute = createRoute({
  method: "get",
  path: "/v1/shop/avatar-frames",
  tags: ["shop"],
  request: { query: ShopCatalogQuerySchema },
  responses: { 200: response(publicCatalog), ...errors },
})
export const shopFrameRoute = createRoute({
  method: "get",
  path: "/v1/shop/avatar-frames/{frameId}",
  tags: ["shop"],
  request: { params: z.object({ frameId: IdSchema }) },
  responses: {
    200: response(
      z.object({ data: ShopAvatarFrameSchema, purchaseEnabled: z.boolean() })
    ),
    ...errors,
  },
})
export const shopTopicsRoute = createRoute({
  method: "get",
  path: "/v1/shop/avatar-frame-topics",
  tags: ["shop"],
  responses: {
    200: response(
      z.object({
        data: z.array(
          z.object({
            id: IdSchema,
            name: z.string(),
            frameCount: z.number().int().nonnegative(),
          })
        ),
      })
    ),
    ...errors,
  },
})
export const personalShopCatalogRoute = createRoute({
  method: "get",
  path: "/v1/me/shop/avatar-frames",
  tags: ["shop"],
  request: { query: ShopCatalogQuerySchema },
  responses: {
    200: response(
      publicCatalog.extend({
        data: z.array(privateFrame),
        balance: CoinAmountSchema,
      })
    ),
    ...errors,
  },
})
export const purchaseAvatarFrameRoute = createRoute({
  method: "post",
  path: "/v1/me/shop/purchases",
  tags: ["shop"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ShopPurchaseInputSchema } },
    },
  },
  responses: {
    200: response(
      z.object({ data: ShopPurchaseReceiptSchema }),
      "Committed purchase or original receipt on retry; refetch wallet/inventory for current state"
    ),
    ...errors,
    409: response(
      ApiErrorSchema,
      "Quote, ownership, stock, balance or operation ID conflict"
    ),
    413: response(ApiErrorSchema, "Request body exceeds 16 KiB"),
  },
})
export const personalShopPurchaseRoute = createRoute({
  method: "get",
  path: "/v1/me/shop/purchases/{operationId}",
  tags: ["shop"],
  request: {
    params: z.object({
      operationId: IdSchema.transform((value) => value.toLowerCase()),
    }),
  },
  responses: {
    200: response(
      z.object({ data: ShopPurchaseReceiptSchema }),
      "Private immutable purchase receipt; missing or another actor's receipt returns 404"
    ),
    ...errors,
  },
})
export const personalShopHistoryRoute = createRoute({
  method: "get",
  path: "/v1/me/shop/purchases",
  tags: ["shop"],
  request: { query: ShopPurchaseHistoryQuerySchema },
  responses: {
    200: response(
      ShopPurchaseHistorySchema,
      "Private purchase history, descending personal debit sequence; available with features disabled"
    ),
    ...errors,
  },
})
