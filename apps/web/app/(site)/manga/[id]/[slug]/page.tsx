import type { Metadata } from "next"
import { navigation } from "next/cache"
import { notFound, permanentRedirect } from "next/navigation"
import { SproutIcon } from "lucide-react"
import { Suspense } from "react"

import { MangaCard } from "@/components/manga-card"
import { MangaGrid } from "@/components/manga-grid"
import { JsonLd } from "@/components/json-ld"
import { siteConfig } from "@/config/site"
import {
  getManga,
  getMangaChapters,
  getMangaRecommendations,
  type MangaDetail,
} from "@/lib/api"
import { isUuid, loadMangaSearchParams, mangaDetailHref } from "@/lib/catalog"
import { getMangaOgImageUrl } from "@/lib/og-image"
import { getMangaStructuredData } from "@/lib/structured-data"
import { MangaLibraryAction } from "@/modules/library/manga-library-action"
import { MangaReadActions } from "@/modules/reading/manga-read-actions"
import { CommentSection } from "@/modules/comments/comment-section"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { MangaChapters } from "./manga-chapters"
import { MangaDetailView } from "./manga-detail-view"

type Params = Promise<{ id: string; slug: string }>
type SearchParams = Promise<{
  direction?: string | string[]
  page?: string | string[]
  tab?: string | string[]
}>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  if (!isUuid(id)) return { title: "Không tìm thấy truyện" } satisfies Metadata

  const manga = await getManga(id)
  if (!manga) return { title: "Không tìm thấy truyện" } satisfies Metadata

  const description =
    manga.description ?? `Đọc ${manga.title} trên ${siteConfig.name}.`
  const canonical = mangaDetailHref(manga)
  const image = {
    url: getMangaOgImageUrl(manga.id),
    width: 1200,
    height: 630,
    alt: `Ảnh giới thiệu ${manga.title} trên ${siteConfig.name}`,
  }

  return {
    alternates: { canonical },
    description,
    title: manga.title,
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: siteConfig.name,
      title: manga.title,
      description,
      url: canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: manga.title,
      description,
      images: [image],
    },
  } satisfies Metadata
}

async function MangaRecommendationsContent({ id }: { id: string }) {
  await navigation()
  const recommendations = await getMangaRecommendations(id)
  if (!recommendations) notFound()
  const hasRecommendations =
    recommendations.byAuthor.length > 0 || recommendations.similar.length > 0

  return (
    <>
      {hasRecommendations ? (
        <div className="flex flex-col gap-7">
          {recommendations.byAuthor.length > 0 ? (
            <section
              aria-labelledby="same-author-heading"
              className="flex flex-col gap-3"
            >
              <h2
                className="font-heading text-lg font-semibold"
                id="same-author-heading"
              >
                Cùng tác giả
              </h2>
              <MangaGrid hideIncompleteRow={false}>
                {recommendations.byAuthor.map((item) => (
                  <MangaCard key={item.id} manga={item} />
                ))}
              </MangaGrid>
            </section>
          ) : null}

          {recommendations.similar.length > 0 ? (
            <section
              aria-labelledby="similar-manga-heading"
              className="flex flex-col gap-3"
            >
              <h2
                className="font-heading text-lg font-semibold"
                id="similar-manga-heading"
              >
                Truyện tương tự
              </h2>
              <MangaGrid hideIncompleteRow={false}>
                {recommendations.similar.map((item) => (
                  <MangaCard key={item.id} manga={item} />
                ))}
              </MangaGrid>
            </section>
          ) : null}
        </div>
      ) : (
        <Empty className="border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SproutIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Chưa có truyện gợi ý</EmptyTitle>
            <EmptyDescription>
              Chưa có truyện đủ metadata tương đồng để gợi ý.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  )
}

async function MangaChaptersContent({
  manga,
  searchParams,
}: {
  manga: MangaDetail
  searchParams: SearchParams
}) {
  await navigation()
  const { direction, page } = await loadMangaSearchParams(searchParams)
  const chapters = await getMangaChapters(manga.id, page, direction)
  if (!chapters || page > Math.max(1, chapters.meta.totalPages)) notFound()
  return <MangaChapters chapters={chapters} direction={direction} manga={manga} />
}

async function MangaPageContent({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id, slug } = await params
  if (!isUuid(id)) notFound()
  const manga = await getManga(id)
  if (!manga) notFound()
  if (slug !== manga.slug) {
    const query = await loadMangaSearchParams(searchParams)
    permanentRedirect(mangaDetailHref(manga, query))
  }

  return (
    <>
      <JsonLd data={getMangaStructuredData(manga)} />
      <MangaDetailView
        actions={
          <>
            <MangaLibraryAction
              mangaId={manga.id}
              returnTo={`/manga/${manga.id}/${manga.slug}`}
            />
            <MangaReadActions
              hasChapters={manga.chapterCounts.releases > 0}
              finalChapter={manga.lastChapter}
              mangaId={manga.id}
            />
          </>
        }
        chapters={
          <Suspense
            fallback={<SectionSkeleton label="Đang tải danh sách chương" />}
          >
            <MangaChaptersContent manga={manga} searchParams={searchParams} />
          </Suspense>
        }
        comments={<CommentSection scope="manga" targetId={manga.id} />}
        manga={manga}
        recommendations={
          <Suspense fallback={<SectionSkeleton label="Đang tải truyện gợi ý" />}>
            <MangaRecommendationsContent id={manga.id} />
          </Suspense>
        }
      />
    </>
  )
}

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="relative isolate overflow-hidden">
      {/* <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-192 overflow-hidden bg-background sm:h-208 md:h-224 lg:h-192"
      >
        <Skeleton className="h-56 w-full rounded-none opacity-70 sm:h-64 md:h-72" />
        <div className="absolute inset-x-0 top-56 bottom-0 bg-linear-to-b from-background via-background/90 to-background backdrop-blur-2xl sm:top-64 md:top-72 md:from-background/80" />
      </div> */}

      <div className="relative mx-auto grid max-w-480 grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-5 px-4 pt-6 pb-8 [grid-template-areas:'cover_title'_'actions_actions'_'info_info'] sm:grid-cols-[10rem_minmax(0,1fr)] sm:px-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-6 md:gap-y-3 md:pt-8 md:[grid-template-areas:'cover_title'_'cover_actions'_'cover_info']">
        <Skeleton className="aspect-5/7 w-full self-start [grid-area:cover]" />

        <div className="flex min-w-0 flex-col justify-between gap-4 [grid-area:title] md:min-h-64">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-4/5 sm:h-12 md:h-16" />
            <Skeleton className="h-5 w-2/5" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-1/3" />
            <div className="flex gap-4 md:hidden">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 [grid-area:actions]">
          <Skeleton className="h-8 w-full md:h-10 md:w-52" />
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
            <Skeleton className="h-8 md:h-10 md:w-36" />
            <Skeleton className="h-8 md:h-10 md:w-40" />
          </div>
        </div>

        <div className="flex flex-col gap-2 [grid-area:info]">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-4 w-24 rounded-sm" />
            <Skeleton className="h-4 w-16 rounded-sm" />
            <Skeleton className="h-4 w-20 rounded-sm" />
            <Skeleton className="h-4 w-18 rounded-sm" />
          </div>
          <div className="hidden gap-4 md:flex">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-480 flex-col gap-7 px-4 pb-7 sm:px-6 sm:pb-9">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="hidden flex-col gap-5 lg:flex">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-20 w-full" />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Skeleton className="h-10 w-full sm:w-132" />
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
            <Skeleton className="h-11 w-full" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton className="h-14 w-full rounded-none" key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <MangaPageContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
