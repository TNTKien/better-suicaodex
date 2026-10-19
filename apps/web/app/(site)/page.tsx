import type { Metadata } from "next"
import { io } from "next/cache"
import Link from "next/link"
import { ArrowRightIcon, LibraryBigIcon } from "lucide-react"
import { Suspense, type ComponentProps } from "react"

import { MangaCard, MangaCardSkeleton } from "@/components/manga-card"
import { MangaGrid } from "@/components/manga-grid"
import { JsonLd } from "@/components/json-ld"
import { getWebsiteStructuredData } from "@/lib/structured-data"
import {
  getBrowserApiBaseUrl,
  getGroupRanking,
  getMangaList,
  getMangaRanking,
  getRecentComments,
} from "@/lib/api"
import { FeaturedCarousel } from "./featured-carousel"
import { HomeHistorySkeleton } from "./home-history"
import { HomeRail } from "./home-rail"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { buttonVariants } from "@workspace/ui/components/button"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

const tagSections = [
  { id: "oneshot", title: "Oneshot", tags: ["oneshot"] },
  { id: "drama", title: "Cảm xúc - Bi kịch", tags: ["drama"] },
  { id: "slice-of-life", title: "Đời thường", tags: ["slice-of-life"] },
]

function CatalogHeading({
  href,
  id,
  title,
}: {
  href: ComponentProps<typeof Link>["href"]
  id: string
  title: string
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="section-heading text-2xl" id={id}>
        {title}
      </h2>

      <Link
        aria-label={`Xem thêm ${title.toLocaleLowerCase("vi")}`}
        href={href}
        prefetch={false}
        className={buttonVariants({ variant: "secondary", size: "icon-sm" })}
      >
        <ArrowRightIcon aria-hidden="true" />
      </Link>
    </div>
  )
}

async function MangaCatalog() {
  await io()
  const apiBaseUrl = getBrowserApiBaseUrl()
  const [
    result,
    featuredRanking,
    initialMangaRanking,
    initialGroupRanking,
    recent,
    recentComments,
    tagged,
  ] = await Promise.all([
    getMangaList(),
    getMangaRanking({ metric: "score", window: "week", limit: 5 }),
    getMangaRanking({ metric: "views", window: "day", limit: 10 }),
    getGroupRanking({ window: "day", limit: 10 }),
    getMangaList({ sort: "publishedAt", direction: "desc", limit: 10 }),
    getRecentComments(),
    Promise.all(
      tagSections.map(async (section) => ({
        ...section,
        ...(await getMangaList({ tagSlugs: section.tags, limit: 5 })),
      }))
    ),
  ])
  const featured =
    featuredRanking.data.length > 0
      ? featuredRanking.data.map(({ manga }) => manga)
      : result.data.slice(0, 5)

  if (result.data.length === 0) {
    return (
      <div className="mx-auto grid max-w-480 w-full items-start gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-9 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LibraryBigIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Chưa có truyện để đọc</EmptyTitle>
            <EmptyDescription>
              Danh sách sẽ xuất hiện khi nội dung public đầu tiên sẵn sàng.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        <HomeRail
          apiBaseUrl={apiBaseUrl}
          initialGroupRanking={initialGroupRanking}
          initialMangaRanking={initialMangaRanking}
          comments={recentComments.data}
        />
      </div>
    )
  }

  return (
    <>
      <section className="bg-background">
        <div className="mx-auto max-w-480">
          <FeaturedCarousel manga={featured} />
        </div>
      </section>

      <div className="mx-auto grid max-w-480 w-full items-start gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-9 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section
            aria-labelledby="catalog-heading"
            className="flex min-w-0 scroll-mt-20 flex-col gap-4"
            id="catalog"
          >
            <CatalogHeading
              href="/latest"
              id="catalog-heading"
              title="Mới cập nhật"
            />
            <MangaGrid>
              {result.data.map((manga) => (
                <MangaCard
                  key={manga.id}
                  manga={manga}
                  chapter={manga.latestChapter}
                />
              ))}
            </MangaGrid>
          </section>

          {recent.data.length > 0 ? (
            <section
              aria-labelledby="recent-heading"
              className="flex min-w-0 scroll-mt-20 flex-col gap-4"
              id="recent"
            >
              <CatalogHeading
                href="/recent"
                id="recent-heading"
                title="Truyện mới"
              />
              <MangaGrid>
                {recent.data.map((manga) => (
                  <MangaCard key={manga.id} manga={manga} />
                ))}
              </MangaGrid>
            </section>
          ) : null}

          {tagged.map(({ id, title, tags, data }) => {
            if (data.length === 0) return null

            const tag = data[0]?.tags.find((tag) => tag.slug === tags[0])

            return (
              <section
                key={id}
                aria-labelledby={`${id}-heading`}
                className="flex min-w-0 scroll-mt-20 flex-col gap-4"
                id={id}
              >
                <CatalogHeading
                  href={tag ? `/tag/${tag.id}/${tag.slug}` : "/tags"}
                  id={`${id}-heading`}
                  title={title}
                />
                <MangaGrid>
                  {data.map((manga) => (
                    <MangaCard key={manga.id} manga={manga} />
                  ))}
                </MangaGrid>
              </section>
            )
          })}
        </div>

        <HomeRail
          apiBaseUrl={apiBaseUrl}
          initialGroupRanking={initialGroupRanking}
          initialMangaRanking={initialMangaRanking}
          comments={recentComments.data}
        />
      </div>
    </>
  )
}

function CatalogSkeleton() {
  return (
    <div aria-label="Đang tải danh sách truyện" role="status">
      <section className="bg-background">
        <div className="mx-auto max-w-480">
          <Skeleton className="h-84 w-full rounded-none md:h-104" />
        </div>
      </section>
      <div className="mx-auto grid max-w-480 w-full items-start gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-9 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-52" />
            <MangaGrid>
              {Array.from({ length: 20 }, (_, index) => (
                <MangaCardSkeleton key={index} withChapter />
              ))}
            </MangaGrid>
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-44" />
            <MangaGrid>
              {Array.from({ length: 10 }, (_, index) => (
                <MangaCardSkeleton key={index} />
              ))}
            </MangaGrid>
          </div>
          {tagSections.map(({ id }) => (
            <div key={id} className="flex flex-col gap-4">
              <Skeleton className="h-10 w-44" />
              <MangaGrid>
                {Array.from({ length: 5 }, (_, index) => (
                  <MangaCardSkeleton key={index} />
                ))}
              </MangaGrid>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-32" />
          <HomeHistorySkeleton />
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <>
      <JsonLd data={getWebsiteStructuredData()} />
      <Suspense fallback={<CatalogSkeleton />}>
        <MangaCatalog />
      </Suspense>
    </>
  )
}
