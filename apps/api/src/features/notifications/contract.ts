import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  IdSchema,
  SlugSchema,
  TimestampSchema,
} from "../../shared/contract.js"

const inputId = z.uuid().toLowerCase()
const notificationParams = z.object({
  notificationId: inputId.openapi({
    param: { in: "path", name: "notificationId" },
  }),
})

export const MangaNewChapterNotificationSchema = z
  .object({
    id: IdSchema,
    type: z.literal("manga_new_chapter"),
    createdAt: TimestampSchema,
    readAt: TimestampSchema.nullable(),
    manga: z.object({
      id: IdSchema,
      slug: SlugSchema,
      title: z.string(),
    }),
    chapter: z.object({
      id: IdSchema,
      volume: z.string().nullable(),
      number: z.string().nullable(),
      title: z.string().nullable(),
    }),
  })
  .openapi("MangaNewChapterNotification")

export const GroupNotificationSchema = z
  .object({
    id: IdSchema,
    type: z.enum([
      "group_join_requested",
      "group_join_approved",
      "group_join_rejected",
      "group_member_removed",
      "group_member_left",
      "group_approved",
      "group_rejected",
      "content_group_added",
      "group_leader_assigned",
    ]),
    createdAt: TimestampSchema,
    readAt: TimestampSchema.nullable(),
    group: z.object({ id: IdSchema, name: z.string() }),
    actor: z.object({ id: z.string(), name: z.string() }).nullable(),
  })
  .openapi("GroupNotification")

export const SystemNoticeNotificationSchema = z
  .object({
    id: IdSchema,
    type: z.literal("system_notice"),
    createdAt: TimestampSchema,
    readAt: TimestampSchema.nullable(),
    notice: z.object({ id: IdSchema, title: z.string() }),
  })
  .openapi("SystemNoticeNotification")

export const NotificationSchema = z.union([
  MangaNewChapterNotificationSchema,
  GroupNotificationSchema,
  SystemNoticeNotificationSchema,
])

const unreadMeta = z.object({ unreadCount: z.number().int().min(0) })
const error = (description: string) => ({
  content: { "application/json": { schema: ApiErrorSchema } },
  description,
})
const errors = {
  400: error("Invalid input or cursor"),
  401: error("Authentication is required"),
  403: error("The account cannot modify notifications"),
  404: error("Notification is not visible"),
}

export const listNotificationsRoute = createRoute({
  method: "get",
  path: "/v1/me/notifications",
  tags: ["notifications"],
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
            data: z.array(NotificationSchema),
            meta: unreadMeta.extend({
              limit: z.number().int().min(1).max(50),
              nextCursor: IdSchema.nullable(),
            }),
          }),
        },
      },
      description: "Own visible notifications, newest first",
    },
    400: errors[400],
    401: errors[401],
  },
})

export const readNotificationRoute = createRoute({
  method: "post",
  path: "/v1/me/notifications/{notificationId}/read",
  tags: ["notifications"],
  request: { params: notificationParams },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({ id: IdSchema, readAt: TimestampSchema }),
            meta: unreadMeta,
          }),
        },
      },
      description: "Notification marked as read, idempotently",
    },
    400: errors[400],
    401: errors[401],
    403: errors[403],
    404: errors[404],
  },
})

export const readAllNotificationsRoute = createRoute({
  method: "post",
  path: "/v1/me/notifications/read-all",
  tags: ["notifications"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              updated: z.number().int().min(0),
              cutoff: TimestampSchema,
            }),
            meta: unreadMeta,
          }),
        },
      },
      description:
        "All own visible notifications through the cutoff marked read",
    },
    401: errors[401],
    403: errors[403],
  },
})

export type MangaNewChapterNotification = z.infer<
  typeof MangaNewChapterNotificationSchema
>
export type GroupNotification = z.infer<typeof GroupNotificationSchema>
export type SystemNoticeNotification = z.infer<
  typeof SystemNoticeNotificationSchema
>
export type Notification = z.infer<typeof NotificationSchema>
