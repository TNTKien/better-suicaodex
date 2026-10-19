"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

import {
  applyNotificationsReadAll,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsKey,
  notificationsOptions,
  type NotificationItem,
  type NotificationPage,
} from "./notifications-api"

export function useNotifications<T extends NotificationItem>(
  apiBaseUrl: string,
  userId: string | null
) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const queryKey = notificationsKey(apiBaseUrl, userId)
  const notifications = useQuery(notificationsOptions<T>(apiBaseUrl, userId))

  const read = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(apiBaseUrl, notificationId),
    onSuccess: ({ data, meta }) => {
      queryClient.setQueryData<NotificationPage<T>>(queryKey, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item.id === data.id ? { ...item, readAt: data.readAt } : item
              ),
              meta: { ...current.meta, unreadCount: meta.unreadCount },
            }
          : current
      )
      void queryClient.invalidateQueries({ queryKey })
    },
  })
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(apiBaseUrl),
    onSuccess: (result) => {
      queryClient.setQueryData<NotificationPage<T>>(queryKey, (current) =>
        current ? applyNotificationsReadAll(current, result) : current
      )
      void queryClient.invalidateQueries({ queryKey })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Không thể đánh dấu thông báo. Vui lòng thử lại.",
      }),
  })
  const unreadCount = notifications.data?.meta.unreadCount ?? 0

  return {
    open: Boolean(userId) && open,
    setOpen,
    onOpenChange: (nextOpen: boolean) => {
      if (nextOpen && !userId) {
        toast.add({
          type: "info",
          title: "Bạn cần đăng nhập để nhận thông báo",
        })
        return
      }
      setOpen(nextOpen)
      if (nextOpen && notifications.isStale) void notifications.refetch()
    },
    notifications,
    read,
    readAll,
    unreadCount,
    badge: unreadCount > 99 ? "99+" : String(unreadCount),
  }
}
