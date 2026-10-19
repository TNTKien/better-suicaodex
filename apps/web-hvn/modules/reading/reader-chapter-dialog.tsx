"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type { RefObject } from "react"
import { groupChaptersByVolume } from "@workspace/catalog/chapters"
import { readerChapterLabel } from "@workspace/account/notifications-presentation"
import { loadReaderChapters } from "@workspace/account/reader-navigation"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { components } from "@/src/lib/generated/api"

type ChapterList = components["schemas"]["ChapterList"]

export function ReaderChapterDialog({
  apiBaseUrl,
  chapter,
  open,
  onOpenChange,
  onChoose,
  finalFocus,
}: {
  apiBaseUrl: string
  chapter: components["schemas"]["ChapterDetail"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (id: string) => void
  finalFocus: RefObject<HTMLElement | null>
}) {
  const chapters = useInfiniteQuery({
    queryKey: ["catalog", apiBaseUrl, "reader-chapters", chapter.manga.id],
    enabled: open,
    initialPageParam: 1,
    staleTime: 60_000,
    retry: false,
    queryFn: ({ pageParam, signal }) =>
      loadReaderChapters<ChapterList>(
        apiBaseUrl,
        chapter.manga.id,
        pageParam,
        signal
      ),
    getNextPageParam: ({ meta }) =>
      meta.page < meta.totalPages ? meta.page + 1 : undefined,
  })
  const items = chapters.data?.pages.flatMap(({ data }) => data) ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hvn-reading-dialog sm:max-w-xl"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle className="hvn-login-heading hvn-login-heading-info pr-12">
            Chọn chapter
          </DialogTitle>
          <DialogDescription>{chapter.manga.title}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-3 pb-3">
          {chapters.isError ? (
            <div role="alert" className="flex flex-col gap-2">
              <p>{chapters.error.message}</p>
              <Button
                className="hvn-copy-manga-link self-start"
                onClick={() => void chapters.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : chapters.isPending ? (
            <Spinner
              aria-label="Đang tải danh sách chương"
              className="mx-auto my-4"
            />
          ) : null}
          {groupChaptersByVolume(items).map(
            ({ volume, chapters: volumeChapters }) => (
              <section key={volume ?? "none"} className="flex flex-col gap-2">
                <h3 className="font-bold">
                  {volume ? `Volume ${volume}` : "No Volume"}
                </h3>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {volumeChapters.map((item) => (
                    <Button
                      className="hvn-reader-chapter-choice min-w-0"
                      key={item.id}
                      title={readerChapterLabel(item)}
                      aria-current={item.id === chapter.id ? "page" : undefined}
                      onClick={() => onChoose(item.id)}
                    >
                      {item.number ?? "Oneshot"}
                    </Button>
                  ))}
                </div>
              </section>
            )
          )}
          {!chapters.isPending && !chapters.isError && !items.length ? (
            <p>Truyện chưa có chương nào.</p>
          ) : null}
          {chapters.hasNextPage ? (
            <Button
              className="hvn-copy-manga-link"
              disabled={chapters.isFetchingNextPage}
              onClick={() => void chapters.fetchNextPage()}
            >
              {chapters.isFetchingNextPage ? <Spinner /> : null}Tải thêm
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
