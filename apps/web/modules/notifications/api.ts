import {
  notificationsOptions as sharedNotificationsOptions,
  type NotificationPage as SharedNotificationPage,
  type WithNullableReadAt,
} from "@workspace/account/notifications-api"

import type { components } from "@/src/lib/generated/api"

export {
  applyNotificationsReadAll,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationApiError,
  notificationsKey,
  type NotificationReadResult,
  type NotificationsReadAllResult,
} from "@workspace/account/notifications-api"

export type Notification = WithNullableReadAt<
  | components["schemas"]["MangaNewChapterNotification"]
  | components["schemas"]["GroupNotification"]
  | components["schemas"]["SystemNoticeNotification"]
>
export type NotificationPage = SharedNotificationPage<Notification>

export function notificationsOptions(
  apiBaseUrl: string,
  userId: string | null
) {
  return sharedNotificationsOptions<Notification>(apiBaseUrl, userId)
}
