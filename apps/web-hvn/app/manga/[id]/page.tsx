import { Suspense } from "react"
import { MangaRedirect, type MangaPageProps } from "@/modules/manga/manga-page"
import { MangaDetailSkeleton } from "@/modules/manga/manga-detail-skeleton"

export default function MangaRedirectPage(
  props: Omit<MangaPageProps, "params"> & { params: Promise<{ id: string }> }
) {
  return (
    <Suspense fallback={<MangaDetailSkeleton />}>
      <MangaRedirect {...props} />
    </Suspense>
  )
}
