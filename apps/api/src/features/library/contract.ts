import { createRoute, z } from "@hono/zod-openapi"

import { libraryCategory } from "../../db/schema.js"
import {
  ApiErrorSchema,
  IdSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { MangaSummarySchema } from "../catalog/contract.js"

const inputId = z.uuid().toLowerCase()
export const LibraryCategorySchema = z
  .enum(libraryCategory.enumValues)
  .openapi("LibraryCategory")
export const LibrarySortSchema = z
  .enum(["addedAt", "latestChapter"])
  .default("addedAt")
  .openapi("LibrarySort")
export const LibraryItemSchema = z
  .object({
    category: LibraryCategorySchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    manga: MangaSummarySchema,
  })
  .openapi("LibraryItem")

export const PutLibraryItemSchema = z
  .object({ category: LibraryCategorySchema })
  .strict()
  .openapi("PutLibraryItem")

const mangaParams = z.object({
  mangaId: inputId.openapi({ param: { in: "path", name: "mangaId" } }),
})
const error = (description: string) => ({
  content: { "application/json": { schema: ApiErrorSchema } },
  description,
})
const errors = {
  400: error("Invalid input or cursor"),
  401: error("Authentication is required"),
  403: error("The account cannot modify its library"),
  404: error("Manga is not visible"),
}

export const listLibraryRoute = createRoute({
  method: "get",
  path: "/v1/me/library",
  tags: ["library"],
  request: {
    query: z.object({
      category: LibraryCategorySchema.optional(),
      q: z.string().trim().min(1).max(160).optional(),
      sort: LibrarySortSchema,
      cursor: inputId.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(LibraryItemSchema),
            meta: z.object({
              limit: z.number().int(),
              nextCursor: z.union([IdSchema, z.null()]),
            }),
          }),
        },
      },
      description: "Own visible library, filtered and sorted",
    },
    400: errors[400],
    401: errors[401],
  },
})
export const getLibraryItemRoute = createRoute({
  method: "get",
  path: "/v1/me/library/{mangaId}",
  tags: ["library"],
  request: { params: mangaParams },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.union([LibraryItemSchema, z.null()]) }),
        },
      },
      description: "Own library item, or null if not added",
    },
    400: errors[400],
    401: errors[401],
    404: errors[404],
  },
})
export const putLibraryItemRoute = createRoute({
  method: "put",
  path: "/v1/me/library/{mangaId}",
  tags: ["library"],
  request: {
    params: mangaParams,
    body: {
      required: true,
      content: { "application/json": { schema: PutLibraryItemSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ data: LibraryItemSchema }) },
      },
      description: "Library item after the account's category change",
    },
    ...errors,
  },
})
export const deleteLibraryItemRoute = createRoute({
  method: "delete",
  path: "/v1/me/library/{mangaId}",
  tags: ["library"],
  request: { params: mangaParams },
  responses: {
    204: { description: "Own item deleted, or already absent" },
    400: errors[400],
    401: errors[401],
  },
})
export type LibraryItem = z.infer<typeof LibraryItemSchema>
export type LibrarySort = z.infer<typeof LibrarySortSchema>
