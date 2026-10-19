import "server-only"

import type { Metadata } from "next"
import { cacheLife } from "next/cache"
import { notFound, permanentRedirect } from "next/navigation"
import { getGroup } from "@workspace/catalog/server"
import { groupPath, isUuid, parsePageNumber } from "@workspace/catalog/routing"
import { pageHref } from "@workspace/catalog/pagination"
import type { components } from "@/src/lib/generated/api"
import { CatalogPage, type CatalogSearchParams } from "@/modules/manga/catalog"

export type GroupPageProps = {
  params: Promise<{ id: string; slug?: string[] }>
  searchParams: CatalogSearchParams
}

async function cachedGroup(id: string) {
  "use cache"
  cacheLife("seconds")
  return getGroup<components["schemas"]["TranslationGroupDetail"]>(id)
}

export async function groupMetadata({
  params,
}: Pick<GroupPageProps, "params">): Promise<Metadata> {
  const { id } = await params
  const group = isUuid(id) ? await cachedGroup(id) : null
  return {
    title: group?.name ?? "Không tìm thấy nhóm dịch",
    ...(group
      ? { alternates: { canonical: groupPath(group.id, group.slug) } }
      : {}),
  }
}

export async function GroupPageContent({
  params,
  searchParams,
}: GroupPageProps) {
  const { id, slug } = await params
  if (!isUuid(id)) notFound()
  const group = await cachedGroup(id)
  if (!group) notFound()
  const path = groupPath(group.id, group.slug)
  if (slug?.length !== 1 || slug[0] !== group.slug || id !== group.id) {
    permanentRedirect(
      pageHref(path, parsePageNumber((await searchParams).page))
    )
  }
  return (
    <CatalogPage
      title={group.name}
      path={path}
      sort="latestChapter"
      group={group}
      searchParams={searchParams}
    />
  )
}
