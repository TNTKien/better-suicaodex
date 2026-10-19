import "server-only"

import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { getTag } from "@workspace/catalog/server"
import { isUuid, parsePageNumber, tagPath } from "@workspace/catalog/routing"
import { pageHref } from "@workspace/catalog/pagination"
import type { components } from "@/src/lib/generated/api"
import { CatalogPage, type CatalogSearchParams } from "./catalog"

type TagSummary = components["schemas"]["TagSummary"]
export type TagPageProps = {
  params: Promise<{ id: string; slug: string }>
  searchParams: CatalogSearchParams
}

export async function tagMetadata({
  params,
}: Pick<TagPageProps, "params">): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: "Không tìm thấy thể loại" }
  const tag = await getTag<TagSummary>(id)
  if (!tag) return { title: "Không tìm thấy thể loại" }
  return {
    title: tag.name,
    alternates: { canonical: tagPath(tag.id, tag.slug) },
  }
}

export async function TagPageContent({ params, searchParams }: TagPageProps) {
  const { id, slug } = await params
  if (!isUuid(id)) notFound()
  const tag = await getTag<TagSummary>(id)
  if (!tag) notFound()
  const path = tagPath(tag.id, tag.slug)
  if (slug !== tag.slug) {
    permanentRedirect(
      pageHref(path, parsePageNumber((await searchParams).page))
    )
  }
  return (
    <CatalogPage
      tag={tag}
      title={tag.name}
      path={path}
      sort="latestChapter"
      searchParams={searchParams}
    />
  )
}

export async function TagRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: CatalogSearchParams
}) {
  const { id } = await params
  const canonicalId = isUuid(id) ? id : null
  const tag = canonicalId ? await getTag<TagSummary>(canonicalId) : null
  if (!tag) notFound()
  return permanentRedirect(
    pageHref(
      tagPath(tag.id, tag.slug),
      parsePageNumber((await searchParams).page)
    )
  )
}
