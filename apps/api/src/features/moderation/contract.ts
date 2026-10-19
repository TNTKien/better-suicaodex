import { createRoute, z } from "@hono/zod-openapi"
import { isAfter, parseISO } from "date-fns"

import {
  ApiErrorSchema,
  NullableAvatarFrameSummarySchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  SlugSchema,
  SortDirectionSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import {
  MangaManagementDetailSchema,
  MangaUpdateInputSchema,
} from "../groups/manga-contract.js"
import { ChapterManagementDetailSchema } from "../groups/chapter-contract.js"

const reason = z.string().trim().min(1).max(500)
const visibilityInput = z.discriminatedUnion("hidden", [
  z
    .object({
      hidden: z.literal(true),
      expectedVersion: z.number().int().positive(),
      reason,
    })
    .strict(),
  z
    .object({
      hidden: z.literal(false),
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
])
const deleteInput = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict()
const mangaOwnerInput = z
  .object({
    ownerGroupId: IdSchema,
    expectedVersion: z.number().int().positive(),
    addTargetGroupToChapters: z.boolean().default(false),
    transferSystemChapterOwnership: z.boolean().default(false),
  })
  .strict()

const visibilityState = z.object({
  id: IdSchema,
  publicationState: z.enum(["draft", "published", "hidden"]),
  moderationHiddenAt: TimestampSchema.nullable(),
  version: z.number().int().positive(),
})

const moderationFields = z.object({
  moderationHiddenAt: TimestampSchema.nullable(),
  moderationReason: z.string().nullable(),
})

const mangaSummary = visibilityState
  .extend({
    slug: z.string(),
    title: z.string(),
    updatedAt: TimestampSchema,
  })
  .extend(moderationFields.shape)

const chapterSummary = visibilityState
  .extend({
    mangaId: IdSchema,
    volume: z.string().nullable(),
    number: z.string().nullable(),
    title: z.string().nullable(),
    pageCount: z.number().int().nonnegative(),
    stagedPageCount: z.number().int().nonnegative(),
    availablePageCount: z.number().int().nonnegative(),
    isFull: z.boolean(),
    pagesVersion: z.number().int().nonnegative(),
    processingState: z.enum(["idle", "queued", "processing", "failed"]),
    failureReason: z.string().nullable(),
    updatedAt: TimestampSchema,
  })
  .extend(moderationFields.shape)

const errors = {
  400: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Request validation failed",
  },
  401: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Authentication is required",
  },
  403: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Administrator access is required",
  },
  404: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Content was not found",
  },
  409: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Content state changed",
  },
  413: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Request body is too large",
  },
}

const response = {
  200: {
    content: {
      "application/json": { schema: z.object({ data: visibilityState }) },
    },
    description: "Updated moderation visibility",
  },
  ...errors,
}

const params = z.object({ id: IdSchema })
const contentGroupParams = params.extend({ groupId: IdSchema })
const mangaParams = z.object({ mangaId: IdSchema })
const moderationFilter = z.enum(["hidden", "visible"]).optional()

export const AdminCommentSchema = z
  .object({
    id: IdSchema,
    parentId: IdSchema.nullable(),
    body: z.string(),
    status: z.enum(["visible", "hidden"]),
    version: z.number().int().positive(),
    author: z.object({
      id: z.string().min(1),
      name: z.string(),
      image: z.string().nullable(),
      avatarFrame: NullableAvatarFrameSummarySchema,
    }),
    manga: z.object({
      id: IdSchema,
      slug: z.string(),
      title: z.string(),
    }),
    chapter: z
      .object({
        id: IdSchema,
        volume: z.string().nullable(),
        number: z.string().nullable(),
        title: z.string().nullable(),
      })
      .nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    editedAt: TimestampSchema.nullable(),
  })
  .openapi("AdminComment")

export const ForbiddenWordSchema = z
  .object({
    id: IdSchema,
    word: z.string().min(1).max(80),
    createdAt: TimestampSchema,
  })
  .openapi("ForbiddenWord")

const tagGroup = z.enum(["content", "format", "genre", "theme"])
const tagName = z.string().trim().min(1).max(100)

export const AdminTagSchema = z
  .object({
    id: IdSchema,
    slug: SlugSchema,
    name: z.string(),
    group: tagGroup,
    version: z.number().int().positive(),
    moderationHiddenAt: TimestampSchema.nullable(),
    mangaCount: z.number().int().nonnegative(),
  })
  .openapi("AdminTag")

export const AdminUserSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
    avatarFrame: NullableAvatarFrameSummarySchema,
    emailVerified: z.boolean(),
    status: z.enum(["active", "suspended", "banned"]),
    isAdmin: z.boolean(),
    version: z.number().int().positive(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    moderatedAt: TimestampSchema.nullable(),
  })
  .openapi("AdminUserSummary")

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  isPublic: z.boolean(),
  bio: z.string().nullable(),
  moderatedByUserId: z.string().nullable(),
  moderationReason: z.string().nullable(),
  linkedProviders: z.array(z.string()),
}).openapi("AdminUserDetail")

export const AdminUserSessionSchema = z
  .object({
    id: z.string().min(1),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: TimestampSchema,
    expiresAt: TimestampSchema,
  })
  .openapi("AdminUserSession")

export const AuditTargetKindSchema = z.enum([
  "user",
  "manga",
  "volume",
  "chapter",
  "comment",
  "group",
  "person",
  "tag",
  "image_server2",
  "system_notice",
  "avatar_frame",
  "avatar_frame_topic",
  "shop_chest",
])

export const AdminAuditEntrySchema = z
  .object({
    id: IdSchema,
    actor: z
      .object({
        id: z.string().min(1),
        name: z.string(),
        image: z.string().nullable(),
        avatarFrame: NullableAvatarFrameSummarySchema,
      })
      .nullable(),
    actorUserId: z.string().nullable(),
    action: z.string(),
    targetKind: AuditTargetKindSchema,
    targetId: z.string(),
    reason: z.string(),
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()).nullable(),
    createdAt: TimestampSchema,
  })
  .openapi("AdminAuditEntry")

const createTagInput = z
  .object({
    name: tagName,
    slug: SlugSchema.optional(),
    group: tagGroup,
  })
  .strict()

const updateTagInput = createTagInput
  .extend({
    slug: SlugSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict()

const tagVisibilityInput = z
  .object({
    hidden: z.boolean(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()

const commentVisibilityInput = z
  .object({
    hidden: z.boolean(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()
const commentBulkVisibilityInput = z
  .object({
    hidden: z.boolean(),
    items: z
      .array(
        z
          .object({
            id: IdSchema,
            expectedVersion: z.number().int().positive(),
          })
          .strict()
      )
      .min(1)
      .max(100)
      .refine(
        (items) => new Set(items.map(({ id }) => id)).size === items.length,
        { message: "Comment IDs must be unique within a batch" }
      ),
  })
  .strict()

export const listModerationMangaRoute = createRoute({
  method: "get",
  path: "/v1/admin/manga",
  tags: ["moderation"],
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().min(1).max(160).optional(),
      groupId: IdSchema.optional(),
      publicationState: z.enum(["draft", "published", "hidden"]).optional(),
      moderation: moderationFilter,
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(mangaSummary),
            meta: PageMetaSchema,
          }),
        },
      },
      description: "Manga available to moderation",
    },
    ...errors,
  },
})

export const getModerationMangaRoute = createRoute({
  method: "get",
  path: "/v1/admin/manga/{id}",
  tags: ["moderation"],
  request: { params },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: MangaManagementDetailSchema }),
        },
      },
      description: "Manga management detail",
    },
    ...errors,
  },
})

export const updateModerationMangaRoute = createRoute({
  method: "put",
  path: "/v1/admin/manga/{id}",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: MangaUpdateInputSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: MangaManagementDetailSchema }),
        },
      },
      description: "Updated manga metadata",
    },
    ...errors,
  },
})

export const setModerationMangaOwnerRoute = createRoute({
  method: "put",
  path: "/v1/admin/manga/{id}/owner",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: mangaOwnerInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: MangaManagementDetailSchema }),
        },
      },
      description: "Transferred manga ownership",
    },
    ...errors,
  },
})

export const removeModerationMangaGroupRoute = createRoute({
  method: "delete",
  path: "/v1/admin/manga/{id}/groups/{groupId}",
  tags: ["moderation"],
  request: {
    params: contentGroupParams,
    body: {
      required: true,
      content: { "application/json": { schema: deleteInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: MangaManagementDetailSchema }),
        },
      },
      description: "Removed a group from manga management",
    },
    ...errors,
  },
})

export const listModerationChaptersRoute = createRoute({
  method: "get",
  path: "/v1/admin/manga/{mangaId}/chapters",
  tags: ["moderation"],
  request: {
    params: mangaParams,
    query: PageQuerySchema.extend({
      publicationState: z.enum(["draft", "published", "hidden"]).optional(),
      moderation: moderationFilter,
      sort: z.enum(["volume", "chapter", "updatedAt"]).default("updatedAt"),
      direction: SortDirectionSchema.default("desc"),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(chapterSummary),
            meta: PageMetaSchema,
          }),
        },
      },
      description: "Chapters available to moderation",
    },
    ...errors,
  },
})

export const getModerationChapterRoute = createRoute({
  method: "get",
  path: "/v1/admin/chapters/{id}",
  tags: ["moderation"],
  request: { params },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: ChapterManagementDetailSchema,
            groupId: IdSchema,
          }),
        },
      },
      description: "Chapter management detail and editable group context",
    },
    ...errors,
  },
})

export const removeModerationChapterGroupRoute = createRoute({
  method: "delete",
  path: "/v1/admin/chapters/{id}/groups/{groupId}",
  tags: ["moderation"],
  request: {
    params: contentGroupParams,
    body: {
      required: true,
      content: { "application/json": { schema: deleteInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: ChapterManagementDetailSchema }),
        },
      },
      description: "Removed a group from chapter management",
    },
    ...errors,
  },
})

export const setMangaModerationVisibilityRoute = createRoute({
  method: "put",
  path: "/v1/admin/manga/{id}/visibility",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: visibilityInput } },
    },
  },
  responses: response,
})

export const deleteModerationMangaRoute = createRoute({
  method: "delete",
  path: "/v1/admin/manga/{id}",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: deleteInput } },
    },
  },
  responses: {
    204: { description: "Manga soft-deleted" },
    ...errors,
  },
})

export const setChapterModerationVisibilityRoute = createRoute({
  method: "put",
  path: "/v1/admin/chapters/{id}/visibility",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: visibilityInput } },
    },
  },
  responses: response,
})

export const deleteModerationChapterRoute = createRoute({
  method: "delete",
  path: "/v1/admin/chapters/{id}",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: deleteInput } },
    },
  },
  responses: {
    204: { description: "Chapter soft-deleted" },
    ...errors,
  },
})

export const listModerationCommentsRoute = createRoute({
  method: "get",
  path: "/v1/admin/comments",
  tags: ["moderation"],
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().min(1).max(160).optional(),
      status: z.enum(["visible", "hidden"]).optional(),
      mangaId: IdSchema.optional(),
      chapterId: IdSchema.optional(),
      userId: z.string().trim().min(1).max(160).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(AdminCommentSchema),
            meta: PageMetaSchema,
          }),
        },
      },
      description: "Comments available to moderation",
    },
    ...errors,
  },
})

export const setCommentModerationVisibilityRoute = createRoute({
  method: "put",
  path: "/v1/admin/comments/{id}/visibility",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: commentVisibilityInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: AdminCommentSchema }),
        },
      },
      description: "Updated comment moderation visibility",
    },
    ...errors,
  },
})

export const setCommentsModerationVisibilityRoute = createRoute({
  method: "put",
  path: "/v1/admin/comments/visibility",
  tags: ["moderation"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: commentBulkVisibilityInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(AdminCommentSchema) }),
        },
      },
      description: "Updated comment moderation visibility in one transaction",
    },
    ...errors,
  },
})

export const listForbiddenWordsRoute = createRoute({
  method: "get",
  path: "/v1/admin/comments/forbidden-words",
  tags: ["moderation"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(ForbiddenWordSchema) }),
        },
      },
      description: "Listed forbidden comment words",
    },
    ...errors,
  },
})

export const createForbiddenWordsRoute = createRoute({
  method: "post",
  path: "/v1/admin/comments/forbidden-words",
  tags: ["moderation"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              words: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(ForbiddenWordSchema) }),
        },
      },
      description: "Created forbidden comment words",
    },
    ...errors,
  },
})

export const deleteForbiddenWordRoute = createRoute({
  method: "delete",
  path: "/v1/admin/comments/forbidden-words/{id}",
  tags: ["moderation"],
  request: { params },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: ForbiddenWordSchema }),
        },
      },
      description: "Deleted a forbidden comment word",
    },
    ...errors,
  },
})

export const listModerationTagsRoute = createRoute({
  method: "get",
  path: "/v1/admin/tags",
  tags: ["moderation"],
  request: {
    query: z.object({
      q: z.string().trim().min(1).max(160).optional(),
      group: tagGroup.optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(AdminTagSchema) }),
        },
      },
      description: "Tags available to moderation",
    },
    ...errors,
  },
})

export const createModerationTagRoute = createRoute({
  method: "post",
  path: "/v1/admin/tags",
  tags: ["moderation"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTagInput } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: z.object({ data: AdminTagSchema }) },
      },
      description: "Created a tag",
    },
    ...errors,
  },
})

export const updateModerationTagRoute = createRoute({
  method: "put",
  path: "/v1/admin/tags/{id}",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: updateTagInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ data: AdminTagSchema }) },
      },
      description: "Updated a tag",
    },
    ...errors,
  },
})

export const setTagModerationVisibilityRoute = createRoute({
  method: "put",
  path: "/v1/admin/tags/{id}/visibility",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: tagVisibilityInput } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ data: AdminTagSchema }) },
      },
      description: "Updated tag visibility",
    },
    ...errors,
  },
})

const userParams = z.object({ id: z.string().trim().min(1).max(128) })

export const listModerationUsersRoute = createRoute({
  method: "get",
  path: "/v1/admin/users",
  tags: ["moderation"],
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().min(1).max(160).optional(),
      status: z.enum(["active", "suspended", "banned"]).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(AdminUserSummarySchema),
            meta: PageMetaSchema,
          }),
        },
      },
      description: "Users available to moderation",
    },
    ...errors,
  },
})

export const getModerationUserRoute = createRoute({
  method: "get",
  path: "/v1/admin/users/{id}",
  tags: ["moderation"],
  request: { params: userParams },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: AdminUserDetailSchema }),
        },
      },
      description: "User moderation detail",
    },
    ...errors,
  },
})

export const listModerationUserSessionsRoute = createRoute({
  method: "get",
  path: "/v1/admin/users/{id}/sessions",
  tags: ["moderation"],
  request: { params: userParams },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(AdminUserSessionSchema) }),
        },
      },
      description: "Active sessions for a moderated user",
    },
    ...errors,
  },
})

export const setModerationUserStatusRoute = createRoute({
  method: "put",
  path: "/v1/admin/users/{id}/status",
  tags: ["moderation"],
  request: {
    params: userParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              status: z.enum(["active", "suspended", "banned"]),
              expectedVersion: z.number().int().positive(),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: AdminUserDetailSchema }),
        },
      },
      description: "Updated account status",
    },
    ...errors,
  },
})

export const listModerationAuditRoute = createRoute({
  method: "get",
  path: "/v1/admin/audit",
  tags: ["moderation"],
  request: {
    query: z
      .object({
        cursor: IdSchema.optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        targetKind: AuditTargetKindSchema.optional(),
        targetId: z.string().trim().min(1).max(160).optional(),
        actorUserId: z.string().trim().min(1).max(128).optional(),
        action: z.string().trim().min(1).max(160).optional(),
        from: TimestampSchema.optional(),
        to: TimestampSchema.optional(),
      })
      .refine(
        (value) =>
          !value.from ||
          !value.to ||
          !isAfter(parseISO(value.from), parseISO(value.to)),
        { message: "from must not be after to", path: ["from"] }
      ),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(AdminAuditEntrySchema),
            meta: z.object({
              limit: z.number().int().min(1).max(50),
              nextCursor: IdSchema.nullable(),
            }),
          }),
        },
      },
      description: "Read-only moderation audit timeline",
    },
    ...errors,
  },
})
