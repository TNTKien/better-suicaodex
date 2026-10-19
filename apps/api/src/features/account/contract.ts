import { createRoute, z } from "@hono/zod-openapi"
import { CoinAmountSchema } from "../coin/contract.js"

import {
  ApiErrorSchema,
  NullableAvatarFrameSummarySchema,
  IdSchema,
  SlugSchema,
  TimestampSchema,
} from "../../shared/contract.js"

const AccountStatusSchema = z.enum(["active", "suspended", "banned"])

export const OwnProfileSchema = z
  .object({
    bio: z.string().nullable(),
    isPublic: z.boolean(),
    status: AccountStatusSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("OwnProfile")

export const CurrentAccountSchema = z
  .object({
    coinBalance: CoinAmountSchema,
    user: z.object({
      id: z.string().min(1),
      name: z.string(),
      email: z.string(),
      emailVerified: z.boolean(),
      image: z.string().nullable(),
      avatarFrame: NullableAvatarFrameSummarySchema,
      role: z.enum(["user", "member", "leader", "admin"]).openapi({
        description: "Display-only role; never use for authorization",
      }),
      createdAt: TimestampSchema,
      updatedAt: TimestampSchema,
    }),
    profile: OwnProfileSchema,
    linkedProviders: z.array(z.string()),
  })
  .openapi("CurrentAccount")

export const PublicProfileSchema = z
  .object({
    name: z.string(),
    image: z.string().nullable(),
    avatarFrame: NullableAvatarFrameSummarySchema,
    verified: z.boolean(),
    bio: z.string().nullable(),
    createdAt: TimestampSchema,
    groups: z.array(
      z.object({
        id: IdSchema,
        slug: SlugSchema,
        name: z.string(),
        isLeader: z.boolean(),
      })
    ),
    commentCount: z.number().int().min(0),
    recentComments: z
      .array(
        z.object({
          id: IdSchema,
          body: z.string(),
          createdAt: TimestampSchema,
          manga: z.object({
            id: IdSchema,
            slug: SlugSchema,
            title: z.string(),
          }),
          chapter: z
            .object({
              id: IdSchema,
              number: z.string().nullable(),
              title: z.string().nullable(),
            })
            .nullable(),
        })
      )
      .max(5),
  })
  .openapi("PublicProfile")

export const UpdateProfileSchema = z
  .object({
    bio: z.string().trim().max(2_000).nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one profile field is required",
    }
  )
  .openapi("UpdateProfile")

const profileParams = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .openapi({ param: { in: "path", name: "id" } }),
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
  description: "The account cannot perform this action",
}
const notFound = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Profile not found",
}
const tooLarge = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "The uploaded image is too large",
}
const busy = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "The image processor is busy",
}
const unavailable = {
  content: { "application/json": { schema: ApiErrorSchema } },
  description: "Profile media storage is unavailable",
}

export const getCurrentAccountRoute = createRoute({
  method: "get",
  path: "/v1/me",
  tags: ["account"],
  responses: {
    200: {
      content: { "application/json": { schema: CurrentAccountSchema } },
      description: "The authenticated account and application profile",
    },
    401: unauthorized,
  },
})

export const updateOwnProfileRoute = createRoute({
  method: "patch",
  path: "/v1/me/profile",
  tags: ["account"],
  request: {
    body: {
      content: { "application/json": { schema: UpdateProfileSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CurrentAccountSchema } },
      description: "The updated authenticated profile",
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
  },
})

export const uploadOwnAvatarRoute = createRoute({
  method: "post",
  path: "/v1/me/avatar",
  tags: ["account"],
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z
            .object({
              avatar: z.file().openapi({ type: "string", format: "binary" }),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CurrentAccountSchema } },
      description: "The account with its updated avatar",
    },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    413: tooLarge,
    429: busy,
    503: unavailable,
  },
})

export const deleteOwnAvatarRoute = createRoute({
  method: "delete",
  path: "/v1/me/avatar",
  tags: ["account"],
  responses: {
    200: {
      content: { "application/json": { schema: CurrentAccountSchema } },
      description: "The account after removing its avatar",
    },
    401: unauthorized,
    403: forbidden,
    503: unavailable,
  },
})

export const getPublicProfileRoute = createRoute({
  method: "get",
  path: "/v1/profiles/{id}",
  tags: ["profiles"],
  request: { params: profileParams },
  responses: {
    200: {
      content: { "application/json": { schema: PublicProfileSchema } },
      description:
        "A public active profile by user ID, with public groups and the five latest visible comments",
    },
    400: badRequest,
    404: notFound,
  },
})

export type CurrentAccount = z.infer<typeof CurrentAccountSchema>
export type PublicProfile = z.infer<typeof PublicProfileSchema>
