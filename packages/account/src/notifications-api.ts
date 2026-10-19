import { queryOptions } from "@tanstack/react-query"

export type WithNullableReadAt<T> = T extends { readAt?: unknown }
  ? Omit<T, "readAt"> & { readAt: string | null }
  : never

export type NotificationItem = { id: string; readAt: string | null }
export type NotificationPage<T extends NotificationItem> = {
  data: T[]
  meta: { limit: number; nextCursor: string | null; unreadCount: number }
}
export type NotificationReadResult = {
  data: { id: string; readAt: string }
  meta: { unreadCount: number }
}
export type NotificationsReadAllResult = {
  data: { updated: number; cutoff: string }
  meta: { unreadCount: number }
}

export function applyNotificationsReadAll<T extends NotificationItem>(
  current: NotificationPage<T>,
  result: NotificationsReadAllResult
): NotificationPage<T> {
  return {
    ...current,
    data:
      result.meta.unreadCount === 0
        ? current.data.map((item) =>
            item.readAt ? item : { ...item, readAt: result.data.cutoff }
          )
        : current.data,
    meta: { ...current.meta, unreadCount: result.meta.unreadCount },
  }
}

export class NotificationApiError extends Error {
  constructor(readonly status: number) {
    super("Notification API request failed")
  }
}

async function notificationRequest<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new NotificationApiError(response.status)
  return response.json() as Promise<T>
}

export const notificationsKey = (apiBaseUrl: string, userId: string | null) =>
  ["notifications", apiBaseUrl, userId] as const

export function notificationsOptions<T extends NotificationItem>(
  apiBaseUrl: string,
  userId: string | null
) {
  return queryOptions({
    queryKey: notificationsKey(apiBaseUrl, userId),
    enabled: userId !== null,
    gcTime: 0,
    staleTime: 60_000,
    retry: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible"
        ? 5 * 60_000
        : false,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) =>
      notificationRequest<NotificationPage<T>>(
        apiBaseUrl,
        "/v1/me/notifications?limit=20",
        {},
        signal
      ),
  })
}

export function markNotificationRead(
  apiBaseUrl: string,
  notificationId: string
) {
  return notificationRequest<NotificationReadResult>(
    apiBaseUrl,
    `/v1/me/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" }
  )
}

export function markAllNotificationsRead(apiBaseUrl: string) {
  return notificationRequest<NotificationsReadAllResult>(
    apiBaseUrl,
    "/v1/me/notifications/read-all",
    { method: "POST" }
  )
}
