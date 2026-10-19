import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  NullableAvatarFrameSummarySchema,
  IdSchema,
  PageQuerySchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { CoverSchema } from "../catalog/contract.js"
import { resolveGroupLinks } from "../catalog/routes.js"

export const GroupPermissionsSchema = z
  .object({
    canAddManga: z.boolean(),
    canEditManga: z.boolean(),
    canDeleteManga: z.boolean(),
    canAddChapter: z.boolean(),
    canEditChapter: z.boolean(),
    canDeleteChapter: z.boolean(),
  })
  .strict()
  .openapi("GroupPermissions")
export type GroupPermissions = z.infer<typeof GroupPermissionsSchema>

const compactText = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max))
const link = z.string().trim().max(220).optional()
export const GroupInputSchema = z
  .object({
    name: compactText(80).pipe(z.string().min(1)),
    description: compactText(1000).default(""),
    links: z
      .object({ website: link, discord: link, twitter: link, facebook: link })
      .strict()
      .default({})
      .superRefine((links, context) => {
        for (const [key, value] of Object.entries(links)) {
          if (value && resolveGroupLinks({ [key]: value }).length !== 1)
            context.addIssue({
              code: "custom",
              path: [key],
              message: "Invalid community link",
            })
        }
      })
      .transform((links) =>
        Object.fromEntries(
          resolveGroupLinks(links as Record<string, string>).map(
            ({ key, url }) => [key, url]
          )
        )
      ),
  })
  .strict()
  .openapi("GroupInput")
export type GroupInput = z.infer<typeof GroupInputSchema>

export const GroupManagementSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    slug: z.string(),
    avatarUrl: z.url().nullable(),
    bannerUrl: z.url().nullable(),
    description: z.string().nullable(),
    links: z.record(z.string(), z.string()),
    inactive: z.boolean(),
    approvalStatus: z.enum(["pending", "approved", "rejected"]),
    publicationState: z.enum(["draft", "published", "hidden"]),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("GroupManagement")
export const AdminGroupManagementSchema = GroupManagementSchema.extend({
  creator: z.object({ id: z.string(), name: z.string() }).nullable(),
}).openapi("AdminGroupManagement")
export const GroupMembershipSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    avatarFrame: NullableAvatarFrameSummarySchema,
    role: z.enum(["leader", "member"]),
    status: z.enum(["pending", "approved", "rejected"]),
    permissions: GroupPermissionsSchema,
    createdAt: TimestampSchema,
  })
  .openapi("GroupMembership")
export const MyGroupSchema = z
  .object({
    isAdmin: z.boolean(),
    data: z
      .object({
        group: GroupManagementSchema,
        membership: GroupMembershipSchema,
      })
      .nullable(),
  })
  .openapi("MyGroup")
export type GroupManagement = z.infer<typeof GroupManagementSchema>
export type GroupMembership = z.infer<typeof GroupMembershipSchema>
export type MyGroup = z.infer<typeof MyGroupSchema>

const groupParams = z.object({ groupId: z.uuid().toLowerCase() })
const userId = z.string().trim().min(1).max(128)
const memberParams = groupParams.extend({ userId })
const reviewInput = z.object({ action: z.enum(["approve", "reject"]) }).strict()
const json = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
})
const ok = <T extends z.ZodType>(schema: T) => ({
  description: "Success",
  content: { "application/json": { schema } },
})
const errors = {
  400: ok(ApiErrorSchema),
  401: ok(ApiErrorSchema),
  403: ok(ApiErrorSchema),
  404: ok(ApiErrorSchema),
  409: ok(ApiErrorSchema),
  413: ok(ApiErrorSchema),
  429: ok(ApiErrorSchema),
}
const groupResponse = {
  200: ok(z.object({ data: GroupManagementSchema })),
  ...errors,
}
const mutationResponse = {
  204: { description: "Mutation committed" },
  ...errors,
}
const tags = ["contribution-groups"]
const root = "/v1/contribution/groups"
const detail = `${root}/{groupId}`

export const myGroupRoute = createRoute({
  method: "get",
  path: "/v1/me/groups",
  tags,
  responses: { 200: ok(MyGroupSchema), ...errors },
})
export const createGroupRoute = createRoute({
  method: "post",
  path: root,
  tags,
  request: { body: json(GroupInputSchema) },
  responses: groupResponse,
})
export const getGroupRoute = createRoute({
  method: "get",
  path: detail,
  tags,
  request: { params: groupParams },
  responses: groupResponse,
})
export const updateGroupRoute = createRoute({
  method: "put",
  path: detail,
  tags,
  request: { params: groupParams, body: json(GroupInputSchema) },
  responses: groupResponse,
})

const groupMediaForm = {
  required: true as const,
  content: {
    "multipart/form-data": {
      schema: z
        .object({
          image: z.file().openapi({ type: "string", format: "binary" }),
        })
        .strict(),
    },
  },
}

export const uploadGroupAvatarRoute = createRoute({
  method: "post",
  path: `${detail}/avatar`,
  tags,
  request: { params: groupParams, body: groupMediaForm },
  responses: groupResponse,
})
export const deleteGroupAvatarRoute = createRoute({
  method: "delete",
  path: `${detail}/avatar`,
  tags,
  request: { params: groupParams },
  responses: groupResponse,
})
export const uploadGroupBannerRoute = createRoute({
  method: "post",
  path: `${detail}/banner`,
  tags,
  request: { params: groupParams, body: groupMediaForm },
  responses: groupResponse,
})
export const deleteGroupBannerRoute = createRoute({
  method: "delete",
  path: `${detail}/banner`,
  tags,
  request: { params: groupParams },
  responses: groupResponse,
})
export const joinGroupRoute = createRoute({
  method: "post",
  path: `${detail}/requests`,
  tags,
  request: { params: groupParams },
  responses: mutationResponse,
})
export const cancelGroupRequestRoute = createRoute({
  method: "delete",
  path: `${detail}/requests/me`,
  tags,
  request: { params: groupParams },
  responses: mutationResponse,
})
export const leaveGroupRoute = createRoute({
  method: "delete",
  path: `${detail}/membership`,
  tags,
  request: { params: groupParams },
  responses: mutationResponse,
})
export const groupMembersRoute = createRoute({
  method: "get",
  path: `${detail}/members`,
  tags,
  request: {
    params: groupParams,
    query: PageQuerySchema.extend({
      status: z.enum(["pending", "approved", "rejected"]).default("approved"),
    }),
  },
  responses: {
    200: ok(
      z.object({
        data: z.array(GroupMembershipSchema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          hasMore: z.boolean(),
        }),
      })
    ),
    ...errors,
  },
})
export const reviewMemberRoute = createRoute({
  method: "put",
  path: `${detail}/requests/{userId}`,
  tags,
  request: { params: memberParams, body: json(reviewInput) },
  responses: mutationResponse,
})
export const memberPermissionsRoute = createRoute({
  method: "put",
  path: `${detail}/members/{userId}/permissions`,
  tags,
  request: { params: memberParams, body: json(GroupPermissionsSchema) },
  responses: mutationResponse,
})
export const kickMemberRoute = createRoute({
  method: "delete",
  path: `${detail}/members/{userId}`,
  tags,
  request: { params: memberParams },
  responses: mutationResponse,
})
export const transferLeaderRoute = createRoute({
  method: "post",
  path: `${detail}/leader`,
  tags,
  request: { params: groupParams, body: json(z.object({ userId }).strict()) },
  responses: mutationResponse,
})
export const addGroupMemberRoute = createRoute({
  method: "post",
  path: `${detail}/members`,
  tags,
  request: {
    params: groupParams,
    body: json(z.object({ userId }).strict()),
  },
  responses: mutationResponse,
})
export const adminGroupsRoute = createRoute({
  method: "get",
  path: "/v1/admin/groups",
  tags,
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().max(100).optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    }),
  },
  responses: {
    200: ok(
      z.object({
        data: z.array(AdminGroupManagementSchema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          hasMore: z.boolean(),
        }),
      })
    ),
    ...errors,
  },
})
export const adminCreateGroupRoute = createRoute({
  method: "post",
  path: "/v1/admin/groups",
  tags,
  request: {
    body: json(GroupInputSchema.extend({ leaderUserId: userId })),
  },
  responses: groupResponse,
})
export const reviewGroupRoute = createRoute({
  method: "put",
  path: "/v1/admin/groups/{groupId}/review",
  tags,
  request: { params: groupParams, body: json(reviewInput) },
  responses: mutationResponse,
})
export const groupActivityRoute = createRoute({
  method: "put",
  path: "/v1/admin/groups/{groupId}/activity",
  tags,
  request: {
    params: groupParams,
    body: json(z.object({ inactive: z.boolean() }).strict()),
  },
  responses: mutationResponse,
})
export const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/v1/admin/groups/{groupId}",
  tags,
  request: { params: groupParams },
  responses: mutationResponse,
})

export const uploadMangaCoverRoute = createRoute({
  method: "post",
  path: `${detail}/manga/{mangaId}/cover`,
  tags: ["contribution-manga"],
  request: {
    params: groupParams.extend({ mangaId: IdSchema }),
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z
            .object({
              cover: z.file().openapi({ type: "string", format: "binary" }),
              expectedVersion: z.coerce.number().int().positive(),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: ok(
      z.object({
        data: CoverSchema.extend({ version: z.number().int().positive() }),
      })
    ),
    ...errors,
    503: ok(ApiErrorSchema),
  },
})

const CoverUploadSessionSchema = z.object({
  id: IdSchema,
  previewUrl: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  expiresAt: TimestampSchema,
})
const coverUploadParams = groupParams.extend({ sessionId: IdSchema })
const publicCoverPreviewParams = z.object({
  file: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i
    ),
})
const coverUploadForm = z
  .object({
    cover: z.file().openapi({ type: "string", format: "binary" }),
    mangaId: IdSchema.optional(),
    expectedVersion: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.mangaId) !== Boolean(value.expectedVersion))
      context.addIssue({
        code: "custom",
        message: "mangaId and expectedVersion must be provided together",
      })
  })

export const stageMangaCoverRoute = createRoute({
  method: "post",
  path: `${detail}/manga/cover-uploads`,
  tags: ["contribution-manga"],
  request: {
    params: groupParams,
    body: {
      required: true,
      content: { "multipart/form-data": { schema: coverUploadForm } },
    },
  },
  responses: {
    201: ok(z.object({ data: CoverUploadSessionSchema })),
    ...errors,
    503: ok(ApiErrorSchema),
  },
})

export const previewMangaCoverUploadRoute = createRoute({
  method: "get",
  path: "/uploads/covers/tmp/{file}",
  tags: ["contribution-manga"],
  request: { params: publicCoverPreviewParams },
  responses: {
    200: {
      description: "Private staged cover preview",
      content: {
        "image/webp": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    ...errors,
    503: ok(ApiErrorSchema),
  },
})

export const commitMangaCoverRoute = createRoute({
  method: "post",
  path: `${detail}/manga/{mangaId}/cover-uploads/{sessionId}`,
  tags: ["contribution-manga"],
  request: {
    params: groupParams.extend({ mangaId: IdSchema, sessionId: IdSchema }),
    body: json(z.object({ expectedVersion: z.number().int().positive() })),
  },
  responses: {
    200: ok(
      z.object({
        data: CoverSchema.extend({ version: z.number().int().positive() }),
      })
    ),
    ...errors,
    503: ok(ApiErrorSchema),
  },
})

export const cancelMangaCoverUploadRoute = createRoute({
  method: "delete",
  path: `${detail}/manga/cover-uploads/{sessionId}`,
  tags: ["contribution-manga"],
  request: { params: coverUploadParams },
  responses: {
    204: { description: "Upload session cancelled" },
    ...errors,
    503: ok(ApiErrorSchema),
  },
})
