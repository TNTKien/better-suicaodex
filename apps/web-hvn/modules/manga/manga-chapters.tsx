"use client"

import Link from "next/link"
import { tz } from "@date-fns/tz"
import { format, parseISO } from "date-fns"
import {
  chapterListHref,
  type ChapterDirection,
} from "@workspace/catalog/manga-routing"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@workspace/ui/components/empty"
import { PagePagination } from "@workspace/ui/components/page-pagination"
import type { components } from "@/src/lib/generated/api"

const vietnamTimeZone = tz("Asia/Ho_Chi_Minh")

export function MangaChapters({
  chapters,
  direction,
  manga,
}: {
  chapters: components["schemas"]["ChapterList"]
  direction: ChapterDirection
  manga: Pick<components["schemas"]["MangaDetail"], "id" | "slug">
}) {
  if (chapters.data.length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Truyện này chưa có chương nào</EmptyTitle>
          <EmptyDescription>
            Hãy quay lại sau khi nhóm dịch đăng truyện nhé!
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <div className="hvn-chapter-list flex min-w-0 flex-col gap-4">
      <ul className="divide-y divide-[#444444] border-b border-[#444444] max-h-96 overflow-auto">
        {chapters.data.map((chapter) => (
          <li key={chapter.id}>
            <Link
              href={`/chapter/${chapter.id}`}
              prefetch={false}
              className="group flex items-start justify-between gap-4 px-1.5 py-3 text-base! leading-6 text-white hover:bg-[#444444] focus-visible:bg-[#444444] sm:text-lg"
            >
              <span className="min-w-0 font-bold wrap-break-word text-[#00bfff] group-hover:text-white group-focus-visible:text-white">
                {chapter.number ? `Chap ${chapter.number}` : "Oneshot"}
                {chapter.title ? `: ${chapter.title}` : ""}
              </span>
              <time
                className="shrink-0 whitespace-nowrap text-sm!"
                dateTime={chapter.publishedAt}
              >
                {format(parseISO(chapter.publishedAt), "dd/MM/yyyy", {
                  in: vietnamTimeZone,
                })}
              </time>
            </Link>
          </li>
        ))}
      </ul>
      <PagePagination
        ariaLabel="Phân trang danh sách chương"
        currentPage={chapters.meta.page}
        getPageHref={(page) => chapterListHref(manga, page, direction)}
        totalPages={chapters.meta.totalPages}
        variant="hvn"
      />
    </div>
  )
}
