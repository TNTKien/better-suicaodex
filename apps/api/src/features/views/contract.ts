import { createRoute, z } from "@hono/zod-openapi"

import { ApiErrorSchema, IdSchema } from "../../shared/contract.js"

const chapterParams = z.object({
  id: IdSchema.openapi({ param: { in: "path", name: "id" } }),
})

export const ChapterViewSessionSchema = z
  .object({
    token: z.string().min(1).max(512),
    requiredPages: z.number().int().positive(),
    requiredSeconds: z.number().int().positive(),
  })
  .openapi("ChapterViewSession")

export const CompleteChapterViewSchema = z
  .object({
    token: z.string().min(1).max(512),
    seenPages: z.number().int().min(0).max(100_000),
  })
  .strict()
  .openapi("CompleteChapterViewInput")

export const ChapterViewResultSchema = z
  .object({
    counted: z.boolean(),
    alreadyCounted: z.boolean(),
    trackingAvailable: z.boolean(),
    viewCount: z.number().int().nonnegative(),
    seenPages: z.number().int().nonnegative(),
    seenSeconds: z.number().int().nonnegative(),
    requiredPages: z.number().int().positive(),
    retryAfterSeconds: z.number().int().nonnegative(),
  })
  .openapi("ChapterViewResult")

export const startChapterViewRoute = createRoute({
  method: "post",
  path: "/v1/chapters/{id}/view-session",
  tags: ["reader"],
  request: { params: chapterParams },
  responses: {
    200: {
      content: { "application/json": { schema: ChapterViewSessionSchema } },
      description: "A server-timed anonymous chapter view session",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Request validation failed",
    },
    404: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Chapter not found",
    },
    503: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "View tracking is not configured",
    },
  },
})

export const completeChapterViewRoute = createRoute({
  method: "post",
  path: "/v1/chapters/{id}/view",
  tags: ["reader"],
  request: {
    params: chapterParams,
    body: {
      required: true,
      content: { "application/json": { schema: CompleteChapterViewSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChapterViewResultSchema } },
      description: "Chapter view tracking result",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Request validation failed",
    },
    403: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "View session is invalid or expired",
    },
    404: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Chapter not found",
    },
    503: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "View tracking is not configured",
    },
  },
})

export type ChapterViewSession = z.infer<typeof ChapterViewSessionSchema>
export type ChapterViewResult = z.infer<typeof ChapterViewResultSchema>
