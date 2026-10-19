import "server-only"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getChapter,
  getManga,
} from "@workspace/catalog/server"
import { isUuid } from "@workspace/catalog/routing"
import { readerChapterLabel } from "@workspace/account/notifications-presentation"
import type { components } from "@/src/lib/generated/api"
import { Reader } from "@/modules/reading/reader"

type Params = Promise<{ id: string }>
type ChapterDetail = components["schemas"]["ChapterDetail"]

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: "Không tìm thấy chương" }
  const chapter = await getChapter<ChapterDetail>(id)
  if (!chapter) return { title: "Không tìm thấy chương" }
  const label = readerChapterLabel(chapter)
  return {
    title: `${chapter.manga.title} - ${label}`,
    description: `Đọc ${label} của ${chapter.manga.title}.`,
    alternates: { canonical: `/chapter/${chapter.id}` },
  }
}

export async function ChapterPageContent({ params }: { params: Params }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const chapter = await getChapter<ChapterDetail>(id)
  if (!chapter) notFound()
  const manga = await getManga<components["schemas"]["MangaDetail"]>(
    chapter.manga.id
  )
  if (!manga) notFound()
  return (
    <Reader chapter={chapter} statistics={manga.statistics} key={chapter.id} />
  )
}
