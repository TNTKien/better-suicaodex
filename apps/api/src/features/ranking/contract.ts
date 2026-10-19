import { createRoute, z } from "@hono/zod-openapi"

import {
  MangaSummarySchema,
  TranslationGroupSummarySchema,
} from "../catalog/contract.js"

export const RankingMetricSchema = z
  .enum(["score", "views", "follows", "comments"])
  .default("score")
export const RankingWindowSchema = z
  .enum(["day", "week", "month", "all-time"])
  .default("all-time")

const MangaRankingQuerySchema = z.object({
  metric: RankingMetricSchema,
  window: RankingWindowSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

const GroupRankingQuerySchema = z.object({
  window: RankingWindowSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const MangaRankingSchema = z
  .object({
    data: z.array(
      z.object({
        rank: z.number().int().positive(),
        manga: MangaSummarySchema,
        views: z.number().int().nonnegative(),
        follows: z.number().int().nonnegative(),
        comments: z.number().int().nonnegative(),
        score: z.number().min(0).max(10).nullable(),
      })
    ),
    meta: z.object({
      metric: RankingMetricSchema.removeDefault(),
      window: RankingWindowSchema.removeDefault(),
      limit: z.number().int().positive(),
      bucketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      calculatedAt: z.iso.datetime({ offset: true }),
      insufficientData: z.boolean(),
      activeSignals: z.object({
        views: z.boolean(),
        follows: z.boolean(),
        comments: z.boolean(),
      }),
    }),
  })
  .openapi("MangaRanking")

export const GroupRankingSchema = z
  .object({
    data: z.array(
      z.object({
        rank: z.number().int().positive(),
        group: TranslationGroupSummarySchema,
        views: z.number().int().nonnegative(),
        chapters: z.number().int().nonnegative(),
        releases: z.number().int().nonnegative(),
        score: z.number().min(0).max(10),
      })
    ),
    meta: z.object({
      window: RankingWindowSchema.removeDefault(),
      limit: z.number().int().positive(),
      bucketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      calculatedAt: z.iso.datetime({ offset: true }),
    }),
  })
  .openapi("GroupRanking")

export const listMangaRankingRoute = createRoute({
  method: "get",
  path: "/v1/rankings/manga",
  tags: ["ranking"],
  request: { query: MangaRankingQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: MangaRankingSchema } },
      description: "Ranked public manga for one metric and time window",
    },
  },
})

export const listGroupRankingRoute = createRoute({
  method: "get",
  path: "/v1/rankings/groups",
  tags: ["ranking"],
  request: { query: GroupRankingQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: GroupRankingSchema } },
      description: "Ranked public translation groups for one time window",
    },
  },
})

export type MangaRanking = z.infer<typeof MangaRankingSchema>
export type GroupRanking = z.infer<typeof GroupRankingSchema>
export type RankingMetric = z.infer<typeof RankingMetricSchema>
export type RankingWindow = z.infer<typeof RankingWindowSchema>
