import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"

import { getTag } from "@/lib/api"
import { isUuid, parsePageNumber } from "@/lib/catalog"
import { tagPath } from "@workspace/catalog/routing"

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ page?: string | string[] }>

async function CanonicalRedirect({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const canonicalId = isUuid(id) ? id : null
  const tag = canonicalId ? await getTag(canonicalId) : null
  if (!tag) notFound()

  const path = tagPath(tag.id, tag.slug)
  const page = parsePageNumber((await searchParams).page)
  return permanentRedirect(page === 1 ? path : `${path}?page=${page}`)
}

export default function TagRedirectPage({
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
