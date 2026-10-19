import "server-only"

import type { Metadata } from "next"
import { navigation } from "next/cache"
import { Suspense } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import { getManga } from "@workspace/catalog/next-server"
import { getMangaChapters } from "@workspace/catalog/server"
import { isUuid } from "@workspace/catalog/routing"
import {
  loadMangaSearchParams,
  mangaDetailHref,
} from "@workspace/catalog/manga-routing"
import type { components } from "@/src/lib/generated/api"
import { MangaDetailView } from "./manga-detail-view"
import { MangaChapters } from "./manga-chapters"
import { Skeleton } from "@workspace/ui/components/skeleton"

type MangaDetail = components["schemas"]["MangaDetail"]
type SearchParams = Promise<{
  direction?: string | string[]
  page?: string | string[]
  tab?: string | string[]
}>
export type MangaPageProps = {
  params: Promise<{ id: string; slug: string }>
  searchParams: SearchParams
}

export async function mangaMetadata({
  params,
}: Pick<MangaPageProps, "params">): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: "Không tìm thấy truyện" }
  const manga = await getManga<MangaDetail>(id)
  if (!manga) return { title: "Không tìm thấy truyện" }
  return {
    title: manga.title,
    description: manga.description ?? `Đọc ${manga.title} trên SuicaoDex.`,
    alternates: { canonical: mangaDetailHref(manga) },
  }
}

export async function MangaPageContent({
  params,
  searchParams,
}: MangaPageProps) {
  const { id, slug } = await params
  if (!isUuid(id)) notFound()
  const manga = await getManga<MangaDetail>(id)
  if (!manga) notFound()
  if (slug !== manga.slug) {
    const query = await loadMangaSearchParams(searchParams)
    permanentRedirect(mangaDetailHref(manga, query))
  }
  return (
    <MangaDetailView
      manga={manga}
      chapters={
        <Suspense
          fallback={
            <div role="status" aria-label="Đang tải danh sách chương">
              <Skeleton className="h-48 w-full rounded-none" />
            </div>
          }
        >
          <MangaChaptersContent manga={manga} searchParams={searchParams} />
        </Suspense>
      }
    />
  )
}

export async function MangaChaptersContent({
  manga,
  searchParams,
}: {
  manga: Pick<MangaDetail, "id" | "slug">
  searchParams: SearchParams
}) {
  await navigation()
  const { page, direction } = await loadMangaSearchParams(searchParams)
  const chapters = await getMangaChapters<components["schemas"]["ChapterList"]>(
    manga.id,
    page,
    direction
  )
  if (!chapters || page > Math.max(1, chapters.meta.totalPages)) notFound()
  return <MangaChapters chapters={chapters} direction={direction} manga={manga} />
}

export async function MangaRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const { id } = await params
  const query = await loadMangaSearchParams(searchParams)
  if (!isUuid(id)) notFound()
  const manga = await getManga<MangaDetail>(id)
  if (!manga) notFound()
  return permanentRedirect(mangaDetailHref(manga, query))
}
