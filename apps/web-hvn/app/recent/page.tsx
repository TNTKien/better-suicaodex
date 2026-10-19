import type { Metadata } from "next"
import { CatalogPage, type CatalogSearchParams } from "@/modules/manga/catalog"

export const metadata: Metadata = {
  title: "Truyện mới đăng",
  alternates: { canonical: "/recent" },
}

export default function RecentPage({
  searchParams,
}: {
  searchParams: CatalogSearchParams
}) {
  return (
    <CatalogPage
      path="/recent"
      sort="publishedAt"
      title="Truyện mới đăng"
      searchParams={searchParams}
    />
  )
}
