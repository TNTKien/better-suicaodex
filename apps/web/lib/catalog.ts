export { readerChapterLabel } from "@workspace/account/notifications-presentation"
export { cover256 } from "@workspace/catalog/images"
export { groupChaptersByVolume } from "@workspace/catalog/chapters"
export { isUuid, parsePageNumber } from "@workspace/catalog/routing"

import { positiveIntegerParser } from "@workspace/catalog/manga-routing"
export {
  chapterListHref,
  mangaDetailHref,
  mangaSearchParams,
  mangaTabParser,
  loadMangaSearchParams,
  type ChapterDirection,
  type MangaTab,
} from "@workspace/catalog/manga-routing"

import type { ChapterSummary } from "@/lib/api"
import { createLoader, createSerializer, parseAsString } from "nuqs/server"

type ChapterIdentity = Pick<ChapterSummary, "number" | "title" | "volume">
const groupsSearchParams = {
  q: parseAsString.withDefault(""),
  page: positiveIntegerParser.withDefault(1),
}

export const loadGroupsSearchParams = createLoader(groupsSearchParams)
const serializeGroupsSearchParams = createSerializer(groupsSearchParams)

export function groupsHref(q: string, page: number) {
  return serializeGroupsSearchParams("/groups", { q, page })
}

export function chapterLabel(chapter: ChapterIdentity) {
  const number = chapter.number ? `Chương ${chapter.number}` : "Oneshot"
  const volume = chapter.volume ? `Tập ${chapter.volume} · ` : ""
  return `${volume}${number}${chapter.title ? ` - ${chapter.title}` : ""}`
}

export function mangaStatusLabel(status: string | null) {
  if (!status) return "Chưa rõ trạng thái"
  return (
    {
      cancelled: "Đã hủy",
      completed: "Đã hoàn thành",
      hiatus: "Tạm ngưng",
      ongoing: "Đang phát hành",
    }[status] ?? status
  )
}

export function mangaContentRatingLabel(rating: string) {
  return (
    {
      erotica: "Adult",
      pornographic: "18+",
      safe: "Mọi độ tuổi",
      suggestive: "Gợi ý",
    }[rating] ?? rating
  )
}

export function generateFaviconUrl(site: string, size = 32) {
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(site)}`
}
