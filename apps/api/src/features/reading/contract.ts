import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  IdSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import {
  ChapterSummarySchema,
  MangaSummarySchema,
} from "../catalog/contract.js"

const inputId = z.uuid().toLowerCase()
const chapterParams = z.object({
  chapterId: inputId.openapi({ param: { in: "path", name: "chapterId" } }),
})

export const ReadingProgressSchema = z
  .object({
    chapterId: IdSchema,
    mangaId: IdSchema,
    readAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("ReadingProgress")

export const ProgressInputSchema = z
  .object({
    readAt: TimestampSchema.optional(),
  })
  .strict()
  .openapi("ProgressInput")

export const MergeHistoryInputSchema = z
  .object({
    entries: z
      .array(
        z.object({ ...ProgressInputSchema.shape, chapterId: inputId }).strict()
      )
      .min(1)
      .max(100)
      .refine(
        (entries) =>
          new Set(entries.map(({ chapterId }) => chapterId)).size ===
          entries.length,
        { message: "Chapter IDs must be unique within a batch" }
      ),
  })
  .strict()
  .openapi("MergeHistoryInput")

export const MergeHistoryResultSchema = z
  .object({
    merged: z.array(ReadingProgressSchema),
    ignored: z.array(
      z.object({
        chapterId: IdSchema,
        reason: z.enum([
          "stale",
          "legacy_existing",
          "not_found",
          "future_read_at",
        ]),
        acknowledged: z.boolean(),
      })
    ),
  })
  .openapi("MergeHistoryResult")

const historyChapter = z
  .object({
    progress: ReadingProgressSchema,
    chapter: ChapterSummarySchema.pick({
      id: true,
      volume: true,
      number: true,
      title: true,
      language: true,
    }),
  })
  .openapi("ReadingHistoryChapter")

const historyManga = MangaSummarySchema.pick({
  id: true,
  slug: true,
  title: true,
  cover: true,
})

const historyItem = z
  .object({
    ...historyChapter.shape,
    manga: historyManga,
  })
  .openapi("ReadingHistoryItem")

const mangaHistoryItem = z
  .object({
    manga: historyManga,
    chapters: z.array(historyChapter).min(1).max(3),
  })
  .openapi("MangaReadingHistoryItem")

const error = (description: string) => ({
  content: { "application/json": { schema: ApiErrorSchema } },
  description,
})
const errors = {
  400: error("Invalid input, timestamp or cursor"),
  401: error("Authentication is required"),
  404: error("Content is not visible or readable"),
}

export const getProgressRoute = createRoute({
  method: "get",
  path: "/v1/me/reading-progress/{chapterId}",
  tags: ["reading"],
  request: { params: chapterParams },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.union([ReadingProgressSchema, z.null()]),
          }),
        },
      },
      description: "Own chapter progress, or null if unread",
    },
    ...errors,
  },
})

export const listProgressRoute = createRoute({
  method: "get",
  path: "/v1/me/reading-progress",
  tags: ["reading"],
  request: { query: z.object({ mangaId: inputId }) },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(ReadingProgressSchema) }),
        },
      },
      description: "Own read-map for readable chapters of a manga",
    },
    ...errors,
  },
})

export const putProgressRoute = createRoute({
  method: "put",
  path: "/v1/me/reading-progress/{chapterId}",
  tags: ["reading"],
  request: {
    params: chapterParams,
    body: {
      required: true,
      content: { "application/json": { schema: ProgressInputSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: ReadingProgressSchema }),
        },
      },
      description: "Canonical progress after conflict resolution",
    },
    ...errors,
    403: error("The account cannot write progress"),
  },
})

export const deleteProgressRoute = createRoute({
  method: "delete",
  path: "/v1/me/reading-progress/{chapterId}",
  tags: ["reading"],
  request: { params: chapterParams },
  responses: {
    204: { description: "Own progress deleted, or already absent" },
    400: errors[400],
    401: errors[401],
  },
})

export const listHistoryRoute = createRoute({
  method: "get",
  path: "/v1/me/reading-history",
  tags: ["reading"],
  request: {
    query: z.object({
      cursor: inputId.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(historyItem),
            meta: z.object({
              limit: z.number().int(),
              nextCursor: IdSchema.nullable(),
            }),
          }),
        },
      },
      description: "Own visible reading history, newest first",
    },
    400: errors[400],
    401: errors[401],
  },
})

export const listMangaHistoryRoute = createRoute({
  method: "get",
  path: "/v1/me/reading-history/manga",
  tags: ["reading"],
  request: {
    query: z.object({
      cursor: inputId.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(mangaHistoryItem),
            meta: z.object({
              limit: z.number().int(),
              nextCursor: IdSchema.nullable(),
            }),
          }),
        },
      },
      description:
        "Own visible reading history grouped by manga, with three newest chapters",
    },
    400: errors[400],
    401: errors[401],
  },
})

export const mergeHistoryRoute = createRoute({
  method: "post",
  path: "/v1/me/reading-history/merge",
  tags: ["reading"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: MergeHistoryInputSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: MergeHistoryResultSchema } },
      description:
        "Atomic batch with per-entry acknowledgement; entries without readAt are insert-only",
    },
    400: errors[400],
    401: errors[401],
    403: error("The account cannot merge history"),
  },
})

export type ReadingProgress = z.infer<typeof ReadingProgressSchema>
export type MergeHistoryResult = z.infer<typeof MergeHistoryResultSchema>
export type MangaReadingHistoryItem = z.infer<typeof mangaHistoryItem>
