import { z } from "@hono/zod-openapi"

export const IdSchema = z
  .uuid()
  .openapi("Id", { example: "e9aa16d2-66de-4c1f-b85c-e48e4a1a92c2" })

export const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .openapi("Slug", { example: "one-piece" })

export const TimestampSchema = z.iso
  .datetime({ offset: true })
  .openapi("Timestamp", { example: "2026-08-29T00:00:00.000Z" })

export const AvatarFrameAlignmentSchema = z.object({
  displayScale: z.number().int().min(50).max(200),
  offsetX: z.number().int().min(-50).max(50),
  offsetY: z.number().int().min(-50).max(50),
})

export const AvatarFrameSummarySchema = z
  .object({
    ...AvatarFrameAlignmentSchema.shape,
    id: IdSchema,
    name: z.string(),
    assetUrl: z.url(),
    previewUrl: z.url(),
    animated: z.boolean(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .openapi("AvatarFrameSummary")
export type AvatarFrameSummary = z.infer<typeof AvatarFrameSummarySchema>
// A union emits anyOf(ref, null); nullable(ref) can emit allOf and exclude null.
export const NullableAvatarFrameSummarySchema = z.union([
  AvatarFrameSummarySchema,
  z.null(),
])

export const PageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .openapi({ example: 20 }),
  })
  .openapi("PageQuery")

export const SortDirectionSchema = z
  .enum(["asc", "desc"])
  .openapi("SortDirection")

export const PageMetaSchema = z
  .object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .openapi("PageMeta")

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
      message: z.string(),
      requestId: z.string(),
      details: z
        .array(
          z.object({
            path: z.string(),
            message: z.string(),
          })
        )
        .optional(),
    }),
  })
  .openapi("ApiError")

export const HealthSchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("Health")

export const ReadinessSchema = z
  .object({
    status: z.enum(["ready", "degraded", "not_ready"]),
    dependencies: z.object({
      postgres: z.enum(["up", "down"]),
      redis: z.enum(["healthy", "degraded", "disabled"]),
    }),
  })
  .openapi("Readiness")

export function apiError(
  code: string,
  message: string,
  requestId: string,
  details?: Array<{ path: string; message: string }>
) {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {}),
    },
  }
}
