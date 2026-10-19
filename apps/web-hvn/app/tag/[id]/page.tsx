import { Suspense } from "react"
import { TagRedirect } from "@/modules/manga/tag-page"
import type { CatalogSearchParams } from "@/modules/manga/catalog"

export default function TagRedirectPage(props: {
  params: Promise<{ id: string }>
  searchParams: CatalogSearchParams
}) {
  return (
    <Suspense fallback={null}>
      <TagRedirect {...props} />
    </Suspense>
  )
}
