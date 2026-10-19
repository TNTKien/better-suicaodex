"use client"

import Link from "next/link"
import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { BookOpenIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

import { AssetImage } from "@workspace/ui/components/asset-image"
import { cover256, coverSrcSet } from "@workspace/catalog/images"
import type { components } from "@/src/lib/generated/api"
import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import { mangaReadingHistoryOptions } from "@workspace/account/reading-api"
import {
  chapterName,
  useReadingHistory,
} from "@workspace/account/reading-history"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"

type HistoryPage = {
  data: components["schemas"]["MangaReadingHistoryItem"][]
  meta: { limit: number; nextCursor: string | null }
}

export function HistoryClient() {
  const { apiBaseUrl, retry, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const { groups, history, deleteItem, setDeleteItem, remove } =
    useReadingHistory(
      apiBaseUrl,
      userId,
      mangaReadingHistoryOptions<HistoryPage>(apiBaseUrl, userId)
    )

  if (status === "loading" || (userId && history.isPending))
    return <HistoryLoading />

  if (status === "error")
    return (
      <Alert
        variant="destructive"
        className="rounded-none border-[#666666] bg-[#111111]"
      >
        <AlertTitle>Không thể kiểm tra tài khoản</AlertTitle>
        <AlertDescription>Vui lòng thử lại.</AlertDescription>
        <Button
          className="hvn-button mt-3 w-fit"
          onClick={() => void retry()}
          variant="outline"
        >
          <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
          Thử lại
        </Button>
      </Alert>
    )

  if (userId && history.isError && groups.length === 0)
    return (
      <Alert
        variant="destructive"
        className="rounded-none border-[#666666] bg-[#111111]"
      >
        <AlertTitle>Chưa tải được lịch sử đọc</AlertTitle>
        <AlertDescription>Kiểm tra kết nối và thử lại.</AlertDescription>
        <Button
          className="hvn-button mt-3 w-fit"
          onClick={() => void history.refetch()}
          variant="outline"
        >
          <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
          Thử lại
        </Button>
      </Alert>
    )

  return (
    <>
      <Dialog
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteItem(null)
        }}
        open={deleteItem !== null}
      >
        <DialogContent
          showCloseButton={false}
          className="rounded-none border-[#666666] bg-[#111111] p-2"
        >
          <DialogHeader>
            <DialogTitle className="hvn-login-heading hvn-login-heading-info">
              Xóa khỏi lịch sử đọc?
            </DialogTitle>
            <DialogDescription>
              Chapter này sẽ bị xóa khỏi lịch sử và không thể khôi phục.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              disabled={remove.isPending}
              render={<Button variant="outline" />}
            >
              Hủy
            </DialogClose>
            <Button
              disabled={!deleteItem || remove.isPending}
              onClick={() => deleteItem && remove.mutate(deleteItem)}
              variant="destructive"
            >
              {remove.isPending ? <Spinner /> : <Trash2Icon />}
              {remove.isPending ? "Đang xóa…" : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!userId ? (
        <Alert className="rounded-none border-[#666666] bg-[#111111]">
          <AlertTitle>Lịch sử đang lưu trên thiết bị này</AlertTitle>
          <AlertDescription>
            Đăng nhập để đồng bộ lịch sử giữa các thiết bị.
          </AlertDescription>
          <Button
            className="hvn-button mt-3 w-fit"
            nativeButton={false}
            render={<Link href={loginHref("/history")} />}
          >
            Đăng nhập
          </Button>
        </Alert>
      ) : null}

      {groups.length === 0 ? (
        <Empty className="rounded-none border border-white/35">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Chưa có lịch sử đọc</EmptyTitle>
            <EmptyDescription>
              Chapter bạn mở sẽ xuất hiện tại đây.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <Card
              className="flex-row items-start gap-3 rounded-none border border-white/35 bg-[#111111] p-2 shadow-none ring-0"
              key={group.mangaId}
            >
              <Link
                aria-label={`Xem ${group.mangaTitle}`}
                className="relative aspect-3/4 w-24 shrink-0 overflow-hidden border border-white/35 sm:w-40"
                href={
                  group.mangaSlug
                    ? `/manga/${group.mangaId}/${group.mangaSlug}`
                    : `/chapter/${group.chapters[0]!.chapterId}`
                }
                prefetch={false}
              >
                <AssetImage
                  alt={`Bìa truyện ${group.mangaTitle}`}
                  className="absolute inset-0 size-full object-cover"
                  height={group.cover?.height ?? 400}
                  src={cover256(group.cover?.url ?? null)}
                  srcSet={coverSrcSet(group.cover)}
                  sizes="(min-width: 640px) 160px, 96px"
                  width={group.cover?.width ?? 256}
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Link
                  className="w-fit text-lg leading-tight wrap-break-word text-[#00bfff] hover:underline sm:text-2xl"
                  href={
                    group.mangaSlug
                      ? `/manga/${group.mangaId}/${group.mangaSlug}`
                      : `/chapter/${group.chapters[0]!.chapterId}`
                  }
                >
                  {group.mangaTitle}
                </Link>
                <div className="flex flex-col gap-1">
                  {group.chapters.map((item) => (
                    <div
                      className="flex min-w-0 items-center gap-1"
                      key={item.chapterId}
                    >
                      <Link
                        className="grid min-w-0 flex-1 gap-1 border-b border-white/20 px-1 py-2 hover:bg-[#2c2b2c]"
                        href={`/chapter/${item.chapterId}`}
                        prefetch={false}
                      >
                        <span className="truncate text-sm text-[#00bfff] sm:text-base">
                          {chapterName(item)}
                        </span>
                        <span className="text-xs text-[#888888] italic sm:text-sm">
                          {item.readAt ? (
                            <time dateTime={item.readAt}>
                              {formatDistanceToNowStrict(
                                parseISO(item.readAt),
                                {
                                  addSuffix: true,
                                  locale: vi,
                                }
                              )}
                            </time>
                          ) : (
                            "Dữ liệu cũ"
                          )}
                        </span>
                      </Link>
                      <Button
                        aria-label={`Xóa ${chapterName(item)} của ${item.mangaTitle} khỏi lịch sử đọc`}
                        onClick={() => setDeleteItem(item)}
                        className="rounded-none text-[#888888] hover:bg-[#2c2b2c] hover:text-white"
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {userId && history.hasNextPage ? (
        <Button
          className="hvn-button self-center"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
          variant="outline"
        >
          {history.isFetchingNextPage ? <Spinner /> : null}
          {history.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
        </Button>
      ) : null}
    </>
  )
}

export function HistoryLoading() {
  return (
    <div className="flex min-h-48 items-center justify-center">
      <Spinner className="size-6" aria-label="Đang tải lịch sử đọc" />
    </div>
  )
}
