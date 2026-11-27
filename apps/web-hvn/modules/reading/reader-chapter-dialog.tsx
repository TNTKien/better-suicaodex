"use client"

import { useQuery } from "@tanstack/react-query"
import type { RefObject } from "react"
import { groupChaptersByVolume } from "@workspace/catalog/chapters"
import { readerChapterLabel } from "@workspace/account/notifications-presentation"
import {
  readerChapterIndexOptions,
  useChapterPickerScroll,
} from "@workspace/account/reader-navigation"
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

type ChapterIndexItem = components["schemas"]["ChapterIndexItem"]

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
  const chapters = useQuery({
    ...readerChapterIndexOptions<ChapterIndexItem>(
      apiBaseUrl,
      chapter.manga.id
    ),
    enabled: open,
  })
  const { initialFocus, listRef } = useChapterPickerScroll(
    open,
    chapter.id,
    chapters.isError ? undefined : chapters.data
  )
  const items = chapters.isError ? [] : (chapters.data ?? [])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hvn-reading-dialog sm:max-w-xl"
        finalFocus={finalFocus}
        initialFocus={initialFocus}
      >
        <DialogHeader>
          <DialogTitle className="hvn-login-heading hvn-login-heading-info pr-12">
            Chọn chapter
          </DialogTitle>
          <DialogDescription>{chapter.manga.title}</DialogDescription>
        </DialogHeader>
        <div
          className="relative flex max-h-[60dvh] flex-col gap-4 overflow-y-auto overscroll-contain px-3 pb-3"
          ref={listRef}
        >
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
                      title={readerChapterLabel({ ...item, title: null })}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
