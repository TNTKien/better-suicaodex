"use client"

import Link from "next/link"
import {
  Clock3Icon,
  EyeIcon,
  EyeOffIcon,
  MessagesSquareIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

import type { ChapterSummary } from "@/lib/api"
import { formatVietnamDate } from "@/lib/date"
import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function statistic(value: number) {
  return value === 0 ? "N/A" : compactNumber.format(value)
}

export function ChapterCard({
  chapter,
  finalChapter,
  isRead,
  onNavigate,
}: {
  chapter: ChapterSummary
  finalChapter: string | null
  isRead: boolean
  onNavigate?: () => void
}) {
  const label = chapter.number
    ? `Ch. ${chapter.number}${chapter.title ? ` - ${chapter.title}` : ""}`
    : "Oneshot"

  return (
    <Card
      className={cn(
        "group/chapter relative min-h-14 rounded-none py-0 shadow-xs hover:bg-accent/15",
        !isRead && "border-l-2 border-l-primary"
      )}
      data-read={isRead}
    >
      <Link
        aria-label={`Đọc ${label}`}
        className="absolute inset-0 rounded-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        href={`/chapter/${chapter.id}`}
        onNavigate={onNavigate}
        prefetch={false}
      />

      <div className="pointer-events-none relative flex min-h-14 min-w-0 flex-col justify-between px-1.5 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-auto items-center space-x-2">
            {isRead ? (
              <EyeOffIcon
                aria-label="Đã đọc"
                className="size-4 shrink-0 text-muted-foreground"
              />
            ) : (
              <EyeIcon aria-label="Chưa đọc" className="size-4 shrink-0" />
            )}
            <svg
              aria-label="Tiếng Việt"
              className="h-auto w-4 shrink-0"
              focusable="false"
              role="img"
              viewBox="0 0 30 20"
            >
              <path fill="#da251d" d="M0 0h30v20H0z" />
              <path
                fill="#ff0"
                d="m15 4 1.347 4.146h4.359l-3.527 2.562 1.348 4.146L15 12.292l-3.527 2.562 1.348-4.146-3.527-2.562h4.359z"
              />
            </svg>
            <span className="line-clamp-1 text-sm font-semibold break-all md:text-base">
              {label}
            </span>
            {finalChapter && chapter.number === finalChapter ? (
              <Badge className="max-h-4 shrink-0 rounded px-1 py-0 text-[0.625rem] font-bold">
                END
              </Badge>
            ) : null}
          </div>

          <div className="flex w-40 shrink-0 items-center justify-end gap-2 sm:w-48 md:w-52">
            <span className="flex min-w-0 flex-auto items-center gap-1">
              <Clock3Icon aria-hidden="true" className="size-4 shrink-0" />
              <time
                className="line-clamp-1 text-sm font-light break-all"
                dateTime={chapter.publishedAt}
              >
                {formatVietnamDate(chapter.publishedAt)}
              </time>
            </span>
            <span
              aria-label={`${chapter.statistics.views.toLocaleString("vi-VN")} lượt xem`}
              className="flex w-14 shrink-0 items-center gap-1 text-sm font-light"
              title="Lượt xem"
            >
              <EyeIcon aria-hidden="true" className="size-4 shrink-0" />
              {statistic(chapter.statistics.views)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-auto items-center space-x-1">
            <UsersIcon aria-hidden="true" className="size-4 shrink-0" />
            <div className="flex min-w-0 items-center space-x-1 overflow-hidden">
              {chapter.groups.length > 0 ? (
                chapter.groups.map((group) => (
                  <Link
                    className="pointer-events-auto relative line-clamp-1 px-1 text-sm font-normal break-all hover:text-primary hover:underline"
                    href={`/group/${group.id}/${group.slug}`}
                    key={group.id}
                    prefetch={false}
                  >
                    {group.name}
                  </Link>
                ))
              ) : (
                <span className="line-clamp-1 px-1 text-sm font-normal">
                  Chưa có nhóm dịch
                </span>
              )}
            </div>
          </div>

          <div className="flex w-40 shrink-0 items-center justify-end gap-2 sm:w-48 md:w-52">
            <span className="flex min-w-0 flex-auto items-center gap-1">
              <UserIcon aria-hidden="true" className="size-4 shrink-0" />
              {chapter.uploader.id ? (
                <Link
                  className="pointer-events-auto relative line-clamp-1 text-sm font-light break-all hover:text-primary hover:underline"
                  href={`/profile/${chapter.uploader.id}`}
                  prefetch={false}
                >
                  {chapter.uploader.name}
                </Link>
              ) : (
                <span className="line-clamp-1 text-sm font-light break-all">
                  {chapter.uploader.name}
                </span>
              )}
            </span>
            <span
              aria-label={`${chapter.statistics.comments.toLocaleString("vi-VN")} bình luận`}
              className="flex w-14 shrink-0 items-center gap-1 text-sm font-light"
              title="Bình luận"
            >
              <MessagesSquareIcon
                aria-hidden="true"
                className="size-4 shrink-0"
              />
              {statistic(chapter.statistics.comments)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
