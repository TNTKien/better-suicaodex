"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { formatVietnamDateTimeInline } from "@/lib/date"
import type { FrameIdentity } from "@/modules/avatar-frames/account-api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { coinLabel } from "./admin-api"
import { gachaHistoryChestName, gachaHistoryOptions } from "./gacha-api"

export function GachaHistoryDialog({
  apiBaseUrl,
  identity,
  onClose,
}: {
  apiBaseUrl: string
  identity: FrameIdentity
  onClose: () => void
}) {
  const history = useInfiniteQuery(gachaHistoryOptions(apiBaseUrl, identity))
  const rows = history.data?.pages.flatMap((page) => page.data) ?? []
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="p-6 pr-12">
          <DialogTitle>Lịch sử mở hộp</DialogTitle>
          <DialogDescription>Các lượt mở mới nhất trước.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">
          {history.isError && (
            <Alert variant="destructive">
              <AlertTitle>
                {history.isFetchNextPageError
                  ? "Chưa tải được các lượt cũ hơn"
                  : "Chưa tải được lịch sử mở hộp"}
              </AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  disabled={history.isFetching}
                  onClick={() => {
                    if (history.isFetchNextPageError)
                      void history.fetchNextPage()
                    else void history.refetch()
                  }}
                >
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <Table aria-label="Lịch sử mở hộp" aria-busy={history.isFetching}>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Loại hộp</TableHead>
                <TableHead>Kết quả</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.isPending
                ? Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}>
                      {[0, 1, 2].map((cell) => (
                        <TableCell key={cell}>
                          <Skeleton className="h-5 w-32 motion-reduce:animate-none" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((roll) => (
                    <TableRow key={roll.operationId}>
                      <TableCell>
                        <time dateTime={roll.createdAt}>
                          {formatVietnamDateTimeInline(roll.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell className="min-w-40 whitespace-normal">
                        {gachaHistoryChestName(roll.chest)}
                      </TableCell>
                      <TableCell className="min-w-48 whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline">{roll.frame.rarity}</Badge>
                            <span>{roll.frame.name}</span>
                          </div>
                          {roll.duplicate && (
                            <p className="text-xs text-muted-foreground">
                              Khung trùng — hoàn {coinLabel(roll.refund)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              {!history.isPending && !history.isError && !rows.length && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Bạn chưa mở hộp nào</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {history.hasNextPage && !history.isFetchNextPageError && (
            <Button
              variant="outline"
              className="self-center"
              disabled={history.isFetching}
              aria-busy={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
            </Button>
          )}
        </div>
        <DialogFooter className="border-t p-4 sm:px-6">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
