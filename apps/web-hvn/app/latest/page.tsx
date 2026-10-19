import type { Metadata } from "next"
import { CatalogPage, type CatalogSearchParams } from "@/modules/manga/catalog"

export const metadata: Metadata = {
  title: "Mới cập nhật",
  alternates: { canonical: "/latest" },
}

export default function LatestPage({
  searchParams,
}: {
  searchParams: CatalogSearchParams
}) {
  return (
    <CatalogPage
      path="/latest"
      sort="latestChapter"
      title="Mới cập nhật"
      searchParams={searchParams}
    />
  )
}
