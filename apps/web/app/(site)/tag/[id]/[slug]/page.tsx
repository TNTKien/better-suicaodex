import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"

import { getTag } from "@/lib/api"
import { isUuid, parsePageNumber } from "@/lib/catalog"
import { Spinner } from "@workspace/ui/components/spinner"
import { tagPath as canonicalPath } from "@workspace/catalog/routing"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"

import { CatalogPage } from "../../../catalog-page"

type Params = Promise<{ id: string; slug: string }>
type SearchParams = Promise<{ page?: string | string[] }>

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  if (!isUuid(id))
    return { title: "Không tìm thấy thể loại" } satisfies Metadata

  const tag = await getTag(id)
  if (!tag) return { title: "Không tìm thấy thể loại" } satisfies Metadata

  return {
    alternates: {
      canonical: pageHref(
        canonicalPath(tag.id, tag.slug),
        pageNumber((await searchParams).page)
      ),
    },
    description: `Khám phá truyện tranh ${tag.name} và các chương mới cập nhật trên SuicaoDex.`,
    title: tag.name,
  } satisfies Metadata
}

async function TagPageContent({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id, slug } = await params
  if (!isUuid(id)) notFound()

  const tag = await getTag(id)
  if (!tag) notFound()

  const path = canonicalPath(tag.id, tag.slug)
  if (slug !== tag.slug) {
    const page = parsePageNumber((await searchParams).page)
    permanentRedirect(page === 1 ? path : `${path}?page=${page}`)
  }

  return (
    <CatalogPage
      includeTag={[tag.id]}
      path={path}
      searchParams={searchParams}
      sort="latestChapter"
      title={tag.name}
    />
  )
}

export default function TagPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center">
          <Spinner aria-label="Đang tải thể loại" />
        </div>
      }
    >
      <TagPageContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
