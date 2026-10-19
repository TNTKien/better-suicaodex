import { createRoute, z } from "@hono/zod-openapi"
import {
  ApiErrorSchema,
  AvatarFrameSummarySchema,
  AvatarFrameAlignmentSchema,
  NullableAvatarFrameSummarySchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  SlugSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { CurrentAccountSchema } from "../account/contract.js"
import { PositiveCoinAmountSchema } from "../coin/contract.js"

const rarity = z.enum(["R", "SR", "SSR"])
const name = z.string().trim().min(1).max(160)
const description = z.string().trim().max(2000)
// Use anyOf for named Id refs: allOf(Id, string|null) would exclude null.
const nullableTopicId = z.union([IdSchema, z.null()])
export const AvatarFrameTopicSchema = z
  .object({
    id: IdSchema,
    name,
    version: z.number().int().positive(),
  })
  .openapi("AvatarFrameTopic")
export const CreateFrameTopicSchema = z.object({ name }).strict()
export const UpdateFrameTopicSchema = z
  .object({ name, expectedVersion: z.number().int().positive() })
  .strict()
export const DeleteFrameTopicSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict()
export const AdminAvatarFrameSchema = z
  .object({
    ...AvatarFrameAlignmentSchema.shape,
    id: IdSchema,
    code: SlugSchema,
    name,
    description,
    topicId: nullableTopicId,
    rarity,
    limited: z.boolean(),
    active: z.boolean(),
    version: z.number().int().positive(),
    frame: NullableAvatarFrameSummarySchema,
    shop: z.object({
      price: PositiveCoinAmountSchema.nullable(),
      stock: z.number().int().nonnegative(),
      version: z.number().int().positive(),
    }),
    frameCount: z.number().int().positive().nullable(),
    byteSize: z.number().int().positive().nullable(),
    previewByteSize: z.number().int().positive().nullable(),
    sha256: z.string().nullable(),
    sourceSha256: z.string().nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("AdminAvatarFrame")
export const AvatarFrameInventorySchema = z
  .object({
    data: z.array(
      z.object({
        frame: AvatarFrameSummarySchema,
        topic: z.object({ id: IdSchema, name }).nullable(),
        rarity,
        limited: z.boolean(),
        active: z.boolean(),
        selected: z.boolean(),
        grantedAt: TimestampSchema,
      })
    ),
    meta: PageMetaSchema,
    selectedFrameId: IdSchema.nullable(),
    enabled: z.boolean(),
  })
  .openapi("AvatarFrameInventory")
export const CreateAvatarFrameSchema = z
  .object({
    ...AvatarFrameAlignmentSchema.partial().shape,
    code: SlugSchema,
    name,
    description: description.default(""),
    topicId: nullableTopicId.default(null),
    rarity,
    limited: z.boolean().default(false),
  })
  .strict()
  .refine((value) => !value.limited || value.rarity === "SSR", {
    message: "Only SSR may be limited",
    path: ["limited"],
  })
export const UpdateAvatarFrameSchema = z
  .object({
    ...AvatarFrameAlignmentSchema.partial().shape,
    name: name.optional(),
    description: description.optional(),
    topicId: nullableTopicId.optional(),
    rarity: rarity.optional(),
    limited: z.boolean().optional(),
    active: z.boolean().optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
    { message: "At least one field is required" }
  )
export const FrameOwnershipInputSchema = z
  .object({
    // Audit requires nonempty text. Omitted reasons use an action description,
    // not a reason invented on behalf of the administrator.
    reason: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .default("Admin avatar frame ownership change"),
  })
  .strict()
export const EquipAvatarFrameSchema = z.object({ frameId: IdSchema }).strict()
export const UpdateAvatarFrameShopSchema = z
  .object({
    expectedVersion: z.number().int().min(1).max(2_147_483_647),
    expectedShopVersion: z.number().int().min(1).max(2_147_483_647),
    price: PositiveCoinAmountSchema.optional(),
    stock: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict()
  .refine((value) => value.price !== undefined || value.stock !== undefined, {
    message: "Price or stock is required",
  })

const errors = {
  400: {
    description: "Request validation failed",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  401: {
    description: "Authentication is required",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  403: {
    description: "Action is not allowed",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  404: {
    description: "Resource not found",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  409: {
    description: "Frame state changed",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  413: {
    description: "Request body exceeds limit",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  429: {
    description: "Image processor is busy",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  503: {
    description: "Media storage is unavailable",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
}
const json = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
})
const frameResult = {
  description: "Frame catalog entry",
  content: {
    "application/json": { schema: z.object({ data: AdminAvatarFrameSchema }) },
  },
}
const inventoryResult = {
  description: "Owned frames, including disabled frames",
  content: { "application/json": { schema: AvatarFrameInventorySchema } },
}
const params = z.object({ id: IdSchema })
const userParams = z.object({ userId: z.string().min(1).max(128) })
const ownershipParams = userParams.extend({ frameId: IdSchema })
const topicResult = {
  description: "Frame topic",
  content: {
    "application/json": { schema: z.object({ data: AvatarFrameTopicSchema }) },
  },
}
export const listFrameTopicsRoute = createRoute({
  method: "get",
  path: "/v1/admin/avatar-frame-topics",
  tags: ["avatar-frames"],
  responses: {
    200: {
      description: "Frame topics",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(
              AvatarFrameTopicSchema.extend({
                frameCount: z.number().int().nonnegative(),
              })
            ),
          }),
        },
      },
    },
    ...errors,
  },
})
export const createFrameTopicRoute = createRoute({
  method: "post",
  path: "/v1/admin/avatar-frame-topics",
  tags: ["avatar-frames"],
  request: { body: json(CreateFrameTopicSchema) },
  responses: { 201: topicResult, ...errors },
})
export const updateFrameTopicRoute = createRoute({
  method: "patch",
  path: "/v1/admin/avatar-frame-topics/{id}",
  tags: ["avatar-frames"],
  request: { params, body: json(UpdateFrameTopicSchema) },
  responses: { 200: topicResult, ...errors },
})
export const deleteFrameTopicRoute = createRoute({
  method: "delete",
  path: "/v1/admin/avatar-frame-topics/{id}",
  tags: ["avatar-frames"],
  request: { params, body: json(DeleteFrameTopicSchema) },
  responses: {
    200: {
      description: "Topic deleted; frames kept uncategorized",
      content: {
        "application/json": { schema: z.object({ deleted: z.literal(true) }) },
      },
    },
    ...errors,
  },
})
export const listAvatarFramesRoute = createRoute({
  method: "get",
  path: "/v1/admin/avatar-frames",
  tags: ["avatar-frames"],
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().min(1).max(160).optional(),
      rarity: rarity.optional(),
      active: z.enum(["true", "false"]).optional(),
      limited: z.enum(["true", "false"]).optional(),
      topicId: z.union([IdSchema, z.literal("none")]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Frame catalog",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(AdminAvatarFrameSchema),
            meta: PageMetaSchema,
          }),
        },
      },
    },
    ...errors,
  },
})
export const createAvatarFrameRoute = createRoute({
  method: "post",
  path: "/v1/admin/avatar-frames",
  tags: ["avatar-frames"],
  request: { body: json(CreateAvatarFrameSchema) },
  responses: { 201: frameResult, ...errors },
})
export const updateAvatarFrameRoute = createRoute({
  method: "patch",
  path: "/v1/admin/avatar-frames/{id}",
  tags: ["avatar-frames"],
  request: { params, body: json(UpdateAvatarFrameSchema) },
  responses: { 200: frameResult, ...errors },
})
export const updateAvatarFrameShopRoute = createRoute({
  method: "patch",
  path: "/v1/admin/avatar-frames/{id}/shop",
  tags: ["shop"],
  request: { params, body: json(UpdateAvatarFrameShopSchema) },
  responses: { 200: frameResult, ...errors },
})
export const uploadAvatarFrameRoute = createRoute({
  method: "post",
  path: "/v1/admin/avatar-frames/{id}/asset",
  tags: ["avatar-frames"],
  request: {
    params,
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z
            .object({
              file: z.file().openapi({ type: "string", format: "binary" }),
              expectedVersion: z.coerce.number().int().positive(),
            })
            .strict(),
        },
      },
    },
  },
  responses: { 200: frameResult, ...errors },
})
export const ownAvatarFramesRoute = createRoute({
  method: "get",
  path: "/v1/me/avatar-frames",
  tags: ["avatar-frames"],
  request: { query: PageQuerySchema },
  responses: { 200: inventoryResult, ...errors },
})
export const userAvatarFramesRoute = createRoute({
  method: "get",
  path: "/v1/admin/users/{userId}/avatar-frames",
  tags: ["avatar-frames"],
  request: { params: userParams, query: PageQuerySchema },
  responses: { 200: inventoryResult, ...errors },
})
export const grantAvatarFrameRoute = createRoute({
  method: "put",
  path: "/v1/admin/users/{userId}/avatar-frames/{frameId}",
  tags: ["avatar-frames"],
  request: { params: ownershipParams, body: json(FrameOwnershipInputSchema) },
  responses: {
    200: {
      description: "Ownership granted; retry is a no-op",
      content: {
        "application/json": { schema: z.object({ changed: z.boolean() }) },
      },
    },
    ...errors,
  },
})
export const revokeAvatarFrameRoute = createRoute({
  method: "delete",
  path: "/v1/admin/users/{userId}/avatar-frames/{frameId}",
  tags: ["avatar-frames"],
  request: { params: ownershipParams, body: json(FrameOwnershipInputSchema) },
  responses: grantAvatarFrameRoute.responses,
})
export const equipAvatarFrameRoute = createRoute({
  method: "put",
  path: "/v1/me/avatar-frame",
  tags: ["avatar-frames"],
  request: { body: json(EquipAvatarFrameSchema) },
  responses: {
    200: {
      description: "Updated account",
      content: { "application/json": { schema: CurrentAccountSchema } },
    },
    ...errors,
  },
})
export const unequipAvatarFrameRoute = createRoute({
  method: "delete",
  path: "/v1/me/avatar-frame",
  tags: ["avatar-frames"],
  responses: {
    200: {
      description: "Updated account",
      content: { "application/json": { schema: CurrentAccountSchema } },
    },
    ...errors,
  },
})
