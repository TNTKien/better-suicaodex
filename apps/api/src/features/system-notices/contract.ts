import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  TimestampSchema,
} from "../../shared/contract.js"

const inputId = z.uuid().toLowerCase()
const params = z.object({
  id: inputId.openapi({ param: { in: "path", name: "id" } }),
})
const input = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(10_000),
})
const error = (description: string) => ({
  content: { "application/json": { schema: ApiErrorSchema } },
  description,
})
const adminErrors = {
  400: error("Invalid input"),
  401: error("Authentication is required"),
  403: error("Administrator access is required"),
  404: error("System notice was not found"),
  413: error("Request body is too large"),
}

export const SystemNoticeSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    content: z.string(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("SystemNotice")

export const listSystemNoticesRoute = createRoute({
  method: "get",
  path: "/v1/system-notices",
  tags: ["system-notices"],
  request: {
    query: z.object({
      cursor: inputId.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(SystemNoticeSchema),
            meta: z.object({
              limit: z.number().int().min(1).max(50),
              nextCursor: IdSchema.nullable(),
            }),
          }),
        },
      },
      description: "Published system notices, newest first",
    },
    400: error("Invalid cursor"),
  },
})

export const listAdminSystemNoticesRoute = createRoute({
  method: "get",
  path: "/v1/admin/system-notices",
  tags: ["moderation"],
  request: {
    query: PageQuerySchema.extend({
      q: z.string().trim().min(1).max(160).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(SystemNoticeSchema),
            meta: PageMetaSchema,
          }),
        },
      },
      description: "System notices available to moderation",
    },
    ...adminErrors,
  },
})

export const createSystemNoticeRoute = createRoute({
  method: "post",
  path: "/v1/admin/system-notices",
  tags: ["moderation"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: input } },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: z.object({ data: SystemNoticeSchema }) },
      },
      description: "Created a system notice",
    },
    ...adminErrors,
  },
})

export const updateSystemNoticeRoute = createRoute({
  method: "put",
  path: "/v1/admin/system-notices/{id}",
  tags: ["moderation"],
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: input } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ data: SystemNoticeSchema }) },
      },
      description: "Updated a system notice",
    },
    ...adminErrors,
  },
})

export const deleteSystemNoticeRoute = createRoute({
  method: "delete",
  path: "/v1/admin/system-notices/{id}",
  tags: ["moderation"],
  request: { params },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ id: IdSchema }) }),
        },
      },
      description: "Deleted a system notice",
    },
    ...adminErrors,
  },
})

export type SystemNotice = z.infer<typeof SystemNoticeSchema>
