"use client"

import {
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  DotIcon,
  RefreshCwIcon,
} from "lucide-react"
import Link from "next/link"

import { useAccount } from "@/modules/account/provider"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"

import { useNotifications } from "@workspace/account/notifications"
import {
  notificationPresentation as sharedNotificationPresentation,
  notificationTime,
} from "@workspace/account/notifications-presentation"
import type { Notification } from "./api"

import { cn } from "@workspace/ui/lib/utils"

export function notificationPresentation(item: Notification) {
  return sharedNotificationPresentation(item)
}

function NotificationSkeleton() {
  return (
    <div aria-label="Đang tải thông báo" className="flex flex-col gap-3 p-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex items-center gap-3" key={index}>
          <Skeleton className="size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NotificationPopover() {
  const { apiBaseUrl, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const {
    open,
    setOpen,
    onOpenChange,
    notifications,
    read,
    readAll,
    unreadCount,
    badge,
  } = useNotifications<Notification>(apiBaseUrl, userId)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            aria-label={
              unreadCount > 0
                ? `Thông báo, ${unreadCount} chưa đọc`
                : "Thông báo"
            }
            className="relative shrink-0"
            size="icon-sm"
            title="Thông báo"
            variant="outline"
          />
        }
      >
        <BellIcon aria-hidden="true" />
        {unreadCount > 0 ? (
          <Badge
            aria-label={`${unreadCount} thông báo chưa đọc`}
            className="absolute -top-2 -right-2 min-w-5 px-1"
          >
            {badge}
          </Badge>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
        positionMethod="fixed"
        sideOffset={8}
      >
        <PopoverHeader className="flex-row items-center justify-between gap-3 px-4 py-3">
          <PopoverTitle>Thông báo</PopoverTitle>
          <Button
            disabled={unreadCount === 0 || readAll.isPending}
            onClick={() => readAll.mutate()}
            size="sm"
            type="button"
            variant="ghost"
          >
            {readAll.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CheckCheckIcon data-icon="inline-start" />
            )}
            Đã đọc
          </Button>
        </PopoverHeader>
        <Separator />

        {notifications.isPending ? (
          <NotificationSkeleton />
        ) : notifications.isError ? (
          <Empty className="min-h-48 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOffIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Không thể tải thông báo</EmptyTitle>
              <EmptyDescription>Vui lòng thử lại sau ít phút.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => void notifications.refetch()} size="sm">
                <RefreshCwIcon data-icon="inline-start" />
                Thử lại
              </Button>
            </EmptyContent>
          </Empty>
        ) : notifications.data.data.length === 0 ? (
          <Empty className="min-h-48 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Chưa có thông báo</EmptyTitle>
              <EmptyDescription>
                Thông báo mới sẽ xuất hiện tại đây.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="max-h-[min(28rem,65vh)] gap-0 overflow-y-auto p-2">
            {notifications.data.data.map((item) => {
              const presentation = notificationPresentation(item)
              return (
                <Item
                  className={cn("", !item.readAt && "bg-primary/10")}
                  key={item.id}
                  onClick={() => {
                    setOpen(false)
                    if (!item.readAt) read.mutate(item.id)
                  }}
                  render={<Link href={presentation.href} prefetch={false} />}
                  size="sm"
                  variant={item.readAt ? "default" : "muted"}
                >
                  <ItemMedia variant="icon">
                    {item.readAt ? (
                      <CheckCheckIcon />
                    ) : (
                      <DotIcon className="text-primary" strokeWidth={10} />
                    )}
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="line-clamp-1 w-full">
                      {presentation.title}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1">
                      {presentation.description}
                    </ItemDescription>
                  </ItemContent>
                  <ItemFooter className="justify-end">
                    <time
                      dateTime={item.createdAt}
                      className="truncate text-xs"
                    >
                      {notificationTime(item.createdAt)}
                    </time>
                  </ItemFooter>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </PopoverContent>
    </Popover>
  )
}
