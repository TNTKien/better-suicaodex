import { io } from "next/cache"
import { notFound } from "next/navigation"
import { BookOpenIcon } from "lucide-react"
import { Suspense } from "react"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"

import { MangaCard } from "@/components/manga-card"
import { MangaGrid } from "@/components/manga-grid"
import { PagePagination } from "@/components/page-pagination"
import { getMangaList } from "@/lib/api"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"

type CatalogSearchParams = Promise<{
  page?: string | string[]
}>

type CatalogPageProps = {
  group?: string[]
  hasChapter?: "true" | "false" | "all"
  artist?: string[]
  author?: string[]
  includeTag?: string[]
  path: string
  searchParams: CatalogSearchParams
  sort: "latestChapter" | "publishedAt"
  title: string
  withChapter?: boolean
}

export async function CatalogResults({
  group,
  hasChapter,
  artist,
  author,
  path,
  includeTag,
  searchParams,
  sort,
  title,
  withChapter = false,
}: CatalogPageProps) {
  const page = pageNumber((await searchParams).page)
  if (withChapter) await io()
  const result = await getMangaList({
    group,
    hasChapter,
    artist,
    author,
    direction: "desc",
    includeTag,
    limit: 36,
    page,
    sort,
  })

  if (page > Math.max(1, result.meta.totalPages)) notFound()
  if (result.data.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Không có truyện nào</EmptyTitle>
          <EmptyDescription>Mục này hiện chưa có nội dung.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <MangaGrid className="2xl:[--manga-columns:6]" hideIncompleteRow={false}>
        {result.data.map((manga) => (
          <MangaCard
            key={manga.id}
            manga={manga}
            chapter={withChapter ? manga.latestChapter : undefined}
          />
        ))}
      </MangaGrid>

      <PagePagination
        ariaLabel={`Phân trang ${title.toLocaleLowerCase("vi")}`}
        currentPage={page}
        getPageHref={(targetPage) => pageHref(path, targetPage)}
        totalPages={result.meta.totalPages}
      />
    </div>
  )
}

export function CatalogPage(props: CatalogPageProps) {
  return (
    <section className="mx-auto max-w-480 w-full flex flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">{props.title}</h1>
      <Suspense
        fallback={
          <div className="flex min-h-48 items-center justify-center">
            <Spinner
              aria-label={`Đang tải ${props.title.toLocaleLowerCase("vi")}`}
            />
          </div>
        }
      >
        <CatalogResults {...props} />
      </Suspense>
    </section>
  )
}
