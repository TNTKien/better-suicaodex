"use client"

import { tz } from "@date-fns/tz"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import {
  BellIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  RefreshCwIcon,
} from "lucide-react"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useMemo, useRef, useState } from "react"
import { Streamdown } from "streamdown"

import { basicMarkdownElements } from "@/lib/markdown"
import { useAccount } from "@/modules/account/provider"
import {
  applyNotificationsReadAll,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationApiError,
  notificationsKey,
  notificationsOptions,
  type NotificationPage,
} from "@/modules/notifications/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { systemNoticeOptions, type SystemNotice } from "./api"

const vietnamTimeZone = tz("Asia/Ho_Chi_Minh")

function noticeTime(value: string) {
  return format(parseISO(value), "dd/MM/yyyy HH:mm", {
    in: vietnamTimeZone,
  })
}

function NoticeLoading() {
  return (
    <div aria-label="Đang tải thông báo" className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="rounded-xl border bg-card p-4" key={index}>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

export function SystemNoticeList() {
  const { apiBaseUrl, status, user } = useAccount()
  const queryClient = useQueryClient()
  const [targetNotice, setTargetNotice] = useQueryState("notice", parseAsString)
  const [openNotices, setOpenNotices] = useState(() => new Set<string>())
  const attemptedReads = useRef(new Set<string>())
  const scrolledTarget = useRef<string | null>(null)
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const targetNoticeId =
    targetNotice &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      targetNotice
    )
      ? targetNotice
      : null
  const notificationKey = notificationsKey(apiBaseUrl, userId)
  const notices = useInfiniteQuery(systemNoticeOptions(apiBaseUrl))
  const notifications = useQuery(notificationsOptions(apiBaseUrl, userId))
  const items = useMemo(
    () => notices.data?.pages.flatMap((page) => page.data) ?? [],
    [notices.data?.pages]
  )
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = notices

  const read = useMutation({
    mutationFn: (noticeId: string) =>
      markNotificationRead(apiBaseUrl, noticeId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationKey }),
    onError: (error) => {
      if (error instanceof NotificationApiError && error.status === 404) return
      toast.add({
        type: "error",
        title: "Không thể đánh dấu thông báo. Vui lòng thử lại.",
      })
    },
  })
  const markRead = read.mutate
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(apiBaseUrl),
    onSuccess: (result) => {
      queryClient.setQueryData<NotificationPage>(notificationKey, (current) =>
        current ? applyNotificationsReadAll(current, result) : current
      )
      void queryClient.invalidateQueries({ queryKey: notificationKey })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Không thể đánh dấu thông báo. Vui lòng thử lại.",
      }),
  })

  const hasUnreadSystemNotice = Boolean(
    notifications.data?.data.some(
      (item) => item.type === "system_notice" && !item.readAt
    )
  )

  useEffect(() => {
    if (!targetNoticeId || scrolledTarget.current === targetNoticeId) return
    const target = items.find((item) => item.id === targetNoticeId)
    if (!target) {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
      return
    }
    if (userId && !attemptedReads.current.has(target.id)) {
      attemptedReads.current.add(target.id)
      markRead(target.id)
    }
    scrolledTarget.current = targetNoticeId
    requestAnimationFrame(() =>
      document
        .getElementById(`system-notice-${targetNoticeId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    )
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    items,
    markRead,
    targetNoticeId,
    userId,
  ])

  const markOpenedNotice = (notice: SystemNotice) => {
    if (!userId || attemptedReads.current.has(notice.id)) return
    attemptedReads.current.add(notice.id)
    markRead(notice.id)
  }

  if (notices.isPending) return <NoticeLoading />

  if (notices.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>Không thể tải thông báo</AlertTitle>
        <AlertDescription>Kiểm tra kết nối và thử lại.</AlertDescription>
        <Button
          className="mt-3"
          onClick={() => void notices.refetch()}
          variant="outline"
        >
          <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
          Thử lại
        </Button>
      </Alert>
    )

  if (items.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Chưa có thông báo</EmptyTitle>
          <EmptyDescription>
            Thông báo mới từ hệ thống sẽ xuất hiện tại đây.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  return (
    <div className="flex flex-col gap-4">
      {userId ? (
        <Button
          className="self-end"
          disabled={!hasUnreadSystemNotice || readAll.isPending}
          onClick={() => readAll.mutate()}
          size="sm"
          variant="outline"
        >
          {readAll.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CheckCheckIcon aria-hidden="true" data-icon="inline-start" />
          )}
          Đánh dấu tất cả đã đọc
        </Button>
      ) : null}

      <div className="flex flex-col gap-3">
        {items.map((notice) => {
          const open =
            targetNoticeId === notice.id || openNotices.has(notice.id)
          return (
            <Collapsible
              className="group/notice overflow-hidden rounded-md border bg-card shadow-xs"
              id={`system-notice-${notice.id}`}
              key={notice.id}
              onOpenChange={(nextOpen) => {
                if (targetNoticeId === notice.id && !nextOpen) {
                  scrolledTarget.current = null
                  void setTargetNotice(null)
                }
                setOpenNotices((current) => {
                  const next = new Set(current)
                  if (nextOpen) next.add(notice.id)
                  else next.delete(notice.id)
                  return next
                })
                if (nextOpen) markOpenedNotice(notice)
              }}
              open={open}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors bg-secondary hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5">
                <span className="min-w-0 flex-1 font-heading font-semibold text-lg line-clamp-1">
                  {notice.title}
                </span>
                <time
                  className="shrink-0 text-xs text-muted-foreground sm:text-sm"
                  dateTime={notice.createdAt}
                >
                  {noticeTime(notice.createdAt)}
                </time>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform group-data-open/notice:rotate-180 motion-reduce:transition-none"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Streamdown
                  allowedElements={basicMarkdownElements}
                  className="border-t px-4 py-4 leading-7 text-foreground sm:px-5"
                  controls={false}
                  mode="static"
                  skipHtml
                >
                  {notice.content}
                </Streamdown>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>

      {notices.hasNextPage ? (
        <Button
          className="self-center"
          disabled={notices.isFetchingNextPage}
          onClick={() => void notices.fetchNextPage()}
          variant="outline"
        >
          {notices.isFetchingNextPage ? <Spinner /> : null}
          {notices.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
        </Button>
      ) : null}
    </div>
  )
}

export function SystemNoticeListLoading() {
  return <NoticeLoading />
}
