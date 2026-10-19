import { Suspense } from "react"
import { MangaDetailSkeleton } from "@/modules/manga/manga-detail-skeleton"
import {
  MangaPageContent,
  type MangaPageProps,
} from "@/modules/manga/manga-page"

export { mangaMetadata as generateMetadata } from "@/modules/manga/manga-page"

export default function MangaPage(props: MangaPageProps) {
  return (
    <Suspense fallback={<MangaDetailSkeleton />}>
      <MangaPageContent {...props} />
    </Suspense>
  )
}
