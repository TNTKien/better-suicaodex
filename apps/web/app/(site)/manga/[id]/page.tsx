import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"

import { getManga } from "@/lib/api"
import { isUuid, loadMangaSearchParams, mangaDetailHref } from "@/lib/catalog"

type Params = Promise<{ id: string }>
type SearchParams = Promise<{
  direction?: string | string[]
  page?: string | string[]
  tab?: string | string[]
}>

async function CanonicalRedirect({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const query = await loadMangaSearchParams(searchParams)
  if (!isUuid(id)) notFound()

  const manga = await getManga(id)
  if (!manga) notFound()

  return permanentRedirect(mangaDetailHref(manga, query))
}

export default function Page({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={null}>
      <CanonicalRedirect params={params} searchParams={searchParams} />
    </Suspense>
  )
}
