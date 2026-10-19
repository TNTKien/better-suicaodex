import { Suspense } from "react"
import { ReaderSkeleton } from "@/modules/reading/reader-skeleton"
import { ChapterPageContent } from "@/modules/reading/chapter-page"

export { generateMetadata } from "@/modules/reading/chapter-page"

export default function ChapterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <ChapterPageContent params={params} />
    </Suspense>
  )
}
