"use client"

import { primaryWebOrigin } from "@workspace/catalog/origins"


import Image from "next/image"
import Link from "next/link"
import { CheckCheck, RefreshCw } from "lucide-react"
import { useNotifications } from "@workspace/account/notifications"
import {
  notificationPresentation as sharedNotificationPresentation,
  notificationTime,
} from "@workspace/account/notifications-presentation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"

import { useAccount } from "@/modules/account/provider"
import type { Notification } from "./api"

export function notificationPresentation(item: Notification) {
  const presentation = sharedNotificationPresentation(item)
  return {
    ...presentation,
    href: new URL(presentation.href, primaryWebOrigin).href,
  }
}

type NotificationState = ReturnType<typeof useNotifications<Notification>>

export function NotificationList({
  state,
}: {
  state: Pick<NotificationState, "notifications" | "read" | "setOpen">
}) {
  const { notifications, read, setOpen } = state
  if (notifications.isPending) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 px-4 py-8"
      >
        <Spinner aria-hidden="true" /> Đang tải thông báo…
      </p>
    )
  }
  if (notifications.isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <p role="alert">Không thể tải thông báo.</p>
        <Button
          size="sm"
          className="hvn-button"
          onClick={() => void notifications.refetch()}
        >
          <RefreshCw aria-hidden="true" /> Thử lại
        </Button>
      </div>
    )
  }
  if (notifications.data.data.length === 0) {
    return <p className="px-4 py-8 text-center">Chưa có thông báo.</p>
  }

  return (
    <ul
      aria-label="Danh sách thông báo"
      className="max-h-[min(28rem,65vh)] overflow-y-auto"
    >
      {notifications.data.data.map((item) => {
        const presentation = notificationPresentation(item)
        return (
          <li
            key={item.id}
            className="hvn-notification-item"
            data-unread={!item.readAt}
          >
            <Link
              href={presentation.href}
              prefetch={false}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-3 focus-visible:-outline-offset-2"
              onClick={() => {
                setOpen(false)
                if (!item.readAt) read.mutate(item.id)
              }}
            >
              <div className="flex items-start gap-2">
                {!item.readAt && (
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-[#e74c3c]"
                    aria-label="Chưa đọc"
                  />
                )}
                <span className="line-clamp-2 min-w-0 font-bold text-[#44b9fa]">
                  {presentation.title}
                </span>
              </div>
              <p className="mt-1 line-clamp-2">{presentation.description}</p>
              <time
                dateTime={item.createdAt}
                className="mt-1 block text-right text-xs text-[#bdbdbd]"
              >
                {notificationTime(item.createdAt)}
              </time>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function NotificationPopover() {
  const { apiBaseUrl, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const state = useNotifications<Notification>(apiBaseUrl, userId)
  const { open, onOpenChange, unreadCount, badge, readAll } = state

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            className="relative hover:bg-transparent!"
            title="Thông báo"
            aria-label={
              unreadCount > 0
                ? `Thông báo, ${unreadCount} chưa đọc`
                : "Thông báo"
            }
          />
        }
      >
        <Image src="/brand/globe-icon.webp" alt="" width={18} height={18} />
        {unreadCount > 0 && (
          <Badge
            aria-label={`${unreadCount} thông báo chưa đọc`}
            className="absolute -top-2 -right-2 h-4 min-w-4 border-0 bg-[#e74c3c] px-1 text-[10px] text-white"
          >
            {badge}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        positionMethod="fixed"
        sideOffset={8}
        className="hvn-notification-panel w-[min(24rem,calc(100vw-1rem))] gap-0 rounded-none p-0.5 ring-0"
      >
        <PopoverHeader className="hvn-notification-heading flex-row items-center justify-between gap-2 px-3 py-2">
          <PopoverTitle className="text-base font-bold">Thông báo</PopoverTitle>
          <Button
            size="xs"
            className="hvn-button"
            disabled={unreadCount === 0 || readAll.isPending}
            onClick={() => readAll.mutate()}
            aria-label="Đánh dấu tất cả thông báo đã đọc"
          >
            {readAll.isPending ? (
              <Spinner aria-hidden="true" />
            ) : (
              <CheckCheck aria-hidden="true" />
            )}
            Đã đọc tất cả
          </Button>
        </PopoverHeader>
        <NotificationList state={state} />
      </PopoverContent>
    </Popover>
  )
}
