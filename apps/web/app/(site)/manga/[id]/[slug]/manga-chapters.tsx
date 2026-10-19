"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  ChevronRightIcon,
  ListTreeIcon,
  ListXIcon,
} from "lucide-react"

import { ChapterCard } from "@/components/chapter-card"
import { PagePagination } from "@/components/page-pagination"
import type { ChapterList, MangaDetail } from "@/lib/api"
import {
  chapterListHref,
  groupChaptersByVolume,
  type ChapterDirection,
} from "@/lib/catalog"
import { useAccount } from "@/modules/account/provider"
import {
  accountReadingScope,
  useLocalReadingHistory,
} from "@/modules/reading/local-history"
import {
  mangaProgressOptions,
  readChapterIdSet,
} from "@/modules/reading/progress"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { cn } from "@workspace/ui/lib/utils"

function ChapterListControls({
  direction,
  manga,
  page,
  totalPages,
}: {
  direction: ChapterDirection
  manga: MangaDetail
  page: number
  totalPages: number
}) {
  const isFirstPage = page === 1
  const isLastPage = page === totalPages
  const nextDirection = direction === "desc" ? "asc" : "desc"

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link
        aria-label={`Sắp xếp theo thứ tự ${nextDirection === "asc" ? "cũ nhất" : "mới nhất"}`}
        className={buttonVariants({ size: "sm", variant: "secondary" })}
        href={chapterListHref(manga, 1, nextDirection)}
        prefetch={false}
        scroll={false}
      >
        {direction === "desc" ? (
          <ArrowDownAZIcon data-icon="inline-start" />
        ) : (
          <ArrowUpAZIcon data-icon="inline-start" />
        )}
        {direction === "desc" ? "Mới nhất" : "Cũ nhất"}
      </Link>

      {totalPages > 1 ? (
        <Pagination
          aria-label="Chuyển nhanh trang danh sách chương"
          className="mx-0 w-auto"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={isFirstPage}
                aria-label="Đến trang chapter trước"
                className={cn(
                  "gap-0 pl-0!",
                  isFirstPage && "pointer-events-none opacity-50"
                )}
                render={
                  isFirstPage ? undefined : (
                    <Link
                      href={chapterListHref(manga, page - 1, direction)}
                      scroll={false}
                    />
                  )
                }
                tabIndex={isFirstPage ? -1 : undefined}
                text=""
              />
            </PaginationItem>
            <PaginationItem>
              <span
                aria-current="page"
                className="flex h-8 min-w-12 items-center justify-center text-sm font-medium"
              >
                {page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-disabled={isLastPage}
                aria-label="Đến trang chapter sau"
                className={cn(
                  "gap-0 pr-0!",
                  isLastPage && "pointer-events-none opacity-50"
                )}
                render={
                  isLastPage ? undefined : (
                    <Link
                      href={chapterListHref(manga, page + 1, direction)}
                      scroll={false}
                    />
                  )
                }
                tabIndex={isLastPage ? -1 : undefined}
                text=""
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}

export function MangaChapters({
  chapters,
  direction,
  manga,
}: {
  chapters: ChapterList
  direction: ChapterDirection
  manga: MangaDetail
}) {
  const { apiBaseUrl, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const progress = useQuery(mangaProgressOptions(apiBaseUrl, userId, manga.id))
  const local = useLocalReadingHistory(accountReadingScope(userId))
  const guest = useLocalReadingHistory("guest")
  const readChapterIds = readChapterIdSet([
    ...(progress.data ?? []),
    ...local,
    ...guest,
  ])
  const volumeGroups = groupChaptersByVolume(
    chapters.slots.flatMap((slot) =>
      groupChaptersByVolume(slot.releases).map(
        ({ volume, chapters: releases }) => ({
          key: slot.key,
          language: slot.language,
          number: slot.number,
          volume,
          releases,
        })
      )
    )
  )

  return (
    <section
      aria-labelledby="chapters-heading"
      className="flex min-w-0 flex-col gap-2"
    >
      <div>
        <h2 className="sr-only" id="chapters-heading">
          Danh sách chương
        </h2>
      </div>

      {chapters.data.length === 0 ? (
        <Empty className="border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Truyện này chưa có chương nào</EmptyTitle>
            <EmptyDescription>
              Hãy quay lại sau khi nhóm dịch đăng truyện nhé!
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ChapterListControls
            direction={direction}
            manga={manga}
            page={chapters.meta.page}
            totalPages={chapters.meta.totalPages}
          />
          <div className="flex flex-col">
            {volumeGroups.map(({ chapters: volumeChapters, volume }) => {
              const numbers = volumeChapters.flatMap(({ number }) =>
                number ? [number] : []
              )
              const firstNumber =
                direction === "desc" ? numbers.at(-1) : numbers[0]
              const lastNumber =
                direction === "desc" ? numbers[0] : numbers.at(-1)
              const range =
                numbers.length > 1
                  ? `Ch. ${firstNumber} – ${lastNumber}`
                  : numbers[0]
                    ? `Ch. ${numbers[0]}`
                    : null

              return (
                <details
                  className="group/volume"
                  key={volume ?? "no-volume"}
                  open
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm px-1 font-heading font-semibold hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    {volume ? (
                      <ListTreeIcon aria-hidden="true" className="size-5" />
                    ) : (
                      <ListXIcon aria-hidden="true" className="size-5" />
                    )}
                    <span>{volume ? `Volume ${volume}` : "No Volume"}</span>
                    {range ? (
                      <span className="ml-auto text-sm font-medium text-muted-foreground">
                        {range}
                      </span>
                    ) : null}
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 transition-transform group-open/volume:rotate-90 motion-reduce:transition-none"
                    />
                  </summary>
                  <div className="flex flex-col gap-2 pb-3">
                    {volumeChapters.map((slot) =>
                      slot.releases.length === 1 ? (
                        <ChapterCard
                          chapter={slot.releases[0]!}
                          finalChapter={manga.lastChapter}
                          isRead={readChapterIds.has(slot.releases[0]!.id)}
                          key={`${slot.language}:${slot.key}`}
                        />
                      ) : (
                        <details
                          className="group/chapter-slot"
                          key={`${slot.language}:${slot.key}`}
                          open
                        >
                          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-sm px-1 text-sm font-semibold hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                            <span>
                              {slot.number
                                ? `Chapter ${slot.number}`
                                : "Oneshot"}
                            </span>
                            <ChevronRightIcon
                              aria-hidden="true"
                              className="ml-auto size-4 transition-transform group-open/chapter-slot:rotate-90 motion-reduce:transition-none"
                            />
                          </summary>
                          <div className="ml-2 flex flex-col gap-2">
                            {slot.releases.map((chapter) => (
                              <div
                                className="relative pl-4 before:absolute before:inset-y-0 before:left-0 before:border-l-4 before:border-border after:absolute after:top-7 after:left-1 after:w-2.5 after:border-t-4 after:border-border last:before:bottom-auto last:before:h-8"
                                key={chapter.id}
                              >
                                <ChapterCard
                                  chapter={chapter}
                                  finalChapter={manga.lastChapter}
                                  isRead={readChapterIds.has(chapter.id)}
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                      )
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </>
      )}

      <PagePagination
        ariaLabel="Phân trang danh sách chương"
        currentPage={chapters.meta.page}
        getPageHref={(page) => chapterListHref(manga, page, direction)}
        totalPages={chapters.meta.totalPages}
      />
    </section>
  )
}
