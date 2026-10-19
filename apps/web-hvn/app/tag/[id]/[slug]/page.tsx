import { Suspense } from "react"
import { Spinner } from "@workspace/ui/components/spinner"
import { TagPageContent, type TagPageProps } from "@/modules/manga/tag-page"

export { tagMetadata as generateMetadata } from "@/modules/manga/tag-page"

export default function TagPage(props: TagPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center">
          <Spinner aria-label="Đang tải thể loại" />
        </div>
      }
    >
      <TagPageContent {...props} />
    </Suspense>
  )
}
