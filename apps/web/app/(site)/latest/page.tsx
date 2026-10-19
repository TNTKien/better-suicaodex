import type { Metadata } from "next"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"

import { CatalogPage } from "../catalog-page"

type Props = { searchParams: Promise<{ page?: string | string[] }> }

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  return {
    title: "Mới cập nhật",
    description: "Đọc các chương truyện tranh mới cập nhật trên SuicaoDex.",
    alternates: {
      canonical: pageHref("/latest", pageNumber((await searchParams).page)),
    },
  }
}

export default function LatestPage({ searchParams }: Props) {
  return (
    <CatalogPage
      path="/latest"
      searchParams={searchParams}
      sort="latestChapter"
      title="Mới cập nhật"
      withChapter
    />
  )
}
