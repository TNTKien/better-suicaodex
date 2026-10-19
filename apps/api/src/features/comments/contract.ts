import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  NullableAvatarFrameSummarySchema,
  IdSchema,
  TimestampSchema,
} from "../../shared/contract.js"

export const CommentBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(4_000)
  .refine(
    (body) => !/<(?:!--|\/?[a-z][^>]*>)/i.test(body),
    "HTML is not allowed"
  )
  .refine(
    (body) => !/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/i.test(body),
    "Markdown images are not allowed"
  )
  .openapi({ example: "Cảm ơn nhóm dịch!" })

const CommentChapterSchema = z
  .object({
    id: IdSchema,
    number: z.string().nullable(),
    title: z.string().nullable(),
  })
  .nullable()

export const ChapterCommentSchema = z
  .object({
    id: IdSchema,
    parentId: IdSchema.nullable(),
    body: z.string().nullable(),
    deleted: z.boolean(),
    hidden: z.boolean(),
    version: z.number().int().positive(),
    author: z.object({
      id: z.string().min(1),
      name: z.string(),
      image: z.string().nullable(),
      avatarFrame: NullableAvatarFrameSummarySchema,
    }),
    chapter: CommentChapterSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    editedAt: TimestampSchema.nullable(),
    replies: z.array(
      z.object({
        id: IdSchema,
        parentId: IdSchema,
        body: z.string().nullable(),
        deleted: z.boolean(),
        hidden: z.boolean(),
        version: z.number().int().positive(),
        author: z.object({
          id: z.string().min(1),
          name: z.string(),
          image: z.string().nullable(),
          avatarFrame: NullableAvatarFrameSummarySchema,
        }),
        chapter: CommentChapterSchema,
        createdAt: TimestampSchema,
        updatedAt: TimestampSchema,
        editedAt: TimestampSchema.nullable(),
      })
    ),
  })
  .openapi("ChapterComment")

export const ChapterCommentListSchema = z
  .object({
    data: z.array(ChapterCommentSchema),
    meta: z.object({
      limit: z.number().int().min(1).max(50),
      total: z.number().int().min(0),
      nextCursor: IdSchema.nullable(),
    }),
  })
  .openapi("ChapterCommentList")

export const RecentCommentSchema = z
  .object({
    id: IdSchema,
    body: z.string(),
    author: z.object({
      id: z.string().min(1),
      name: z.string(),
      image: z.string().nullable(),
      avatarFrame: NullableAvatarFrameSummarySchema,
    }),
    manga: z.object({
      id: IdSchema,
      slug: z.string().min(1),
      title: z.string(),
    }),
    chapter: CommentChapterSchema,
    createdAt: TimestampSchema,
  })
  .openapi("RecentComment")

export const RecentCommentListSchema = z
  .object({ data: z.array(RecentCommentSchema) })
  .openapi("RecentCommentList")

const chapterParams = z.object({
  id: z.uuid().openapi({ param: { in: "path", name: "id" } }),
})
const mangaParams = z.object({
  id: z.uuid().openapi({ param: { in: "path", name: "id" } }),
})
const commentParams = z.object({
  id: z.uuid().openapi({ param: { in: "path", name: "id" } }),
})
const badRequest = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Request validation failed",
}
const unauthorized = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Authentication is required",
}
const forbidden = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "The action is not allowed",
}
const notFound = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Resource not found",
}
const conflict = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Comment state changed",
}
const throttled = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Comment cooldown or duplicate content window",
}

export const listRecentCommentsRoute = createRoute({
  method: "get",
  path: "/v1/comments/recent",
  tags: ["comments"],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(10).default(10),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: RecentCommentListSchema } },
      description: "Latest visible comments across manga and chapters",
    },
    400: badRequest,
  },
})

export const listChapterCommentsRoute = createRoute({
  method: "get",
  path: "/v1/chapters/{id}/comments",
  tags: ["comments"],
  request: {
    params: chapterParams,
    query: z.object({
      cursor: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChapterCommentListSchema } },
      description: "Visible comments for a readable chapter",
    },
    400: badRequest,
    404: notFound,
  },
})

export const createChapterCommentRoute = createRoute({
  method: "post",
  path: "/v1/chapters/{id}/comments",
  tags: ["comments"],
  request: {
    params: chapterParams,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            body: CommentBodySchema,
            parentId: IdSchema.optional(),
            operationId: z
              .uuid()
              .optional()
              .describe("Reuse the same ID when retrying comment creation"),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ChapterCommentSchema } },
      description: "Created chapter comment",
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
    429: throttled,
  },
})

export const listMangaCommentsRoute = createRoute({
  method: "get",
  path: "/v1/manga/{id}/comments",
  tags: ["comments"],
  request: {
    params: mangaParams,
    query: z.object({
      cursor: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChapterCommentListSchema } },
      description: "Visible manga and readable chapter comments",
    },
    400: badRequest,
    404: notFound,
  },
})

export const createMangaCommentRoute = createRoute({
  method: "post",
  path: "/v1/manga/{id}/comments",
  tags: ["comments"],
  request: {
    params: mangaParams,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            body: CommentBodySchema,
            parentId: IdSchema.optional(),
            operationId: z
              .uuid()
              .optional()
              .describe("Reuse the same ID when retrying comment creation"),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ChapterCommentSchema } },
      description: "Created manga comment",
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
    429: throttled,
  },
})

export const updateCommentRoute = createRoute({
  method: "patch",
  path: "/v1/comments/{id}",
  tags: ["comments"],
  request: {
    params: commentParams,
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              body: CommentBodySchema,
              expectedVersion: z.number().int().positive(),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChapterCommentSchema } },
      description: "Updated comment",
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
})

export const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/v1/comments/{id}",
  tags: ["comments"],
  request: {
    params: commentParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({ expectedVersion: z.number().int().positive() })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChapterCommentSchema } },
      description: "Soft-deleted comment",
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
})

export type ChapterComment = z.infer<typeof ChapterCommentSchema>
