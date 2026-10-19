import type { Metadata } from "next"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"

import { CatalogPage } from "../catalog-page"

type Props = { searchParams: Promise<{ page?: string | string[] }> }

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  return {
    title: "Truyện mới",
    description: "Khám phá những bộ truyện tranh vừa được thêm vào SuicaoDex.",
    alternates: {
      canonical: pageHref("/recent", pageNumber((await searchParams).page)),
    },
  }
}

export default function RecentPage({ searchParams }: Props) {
  return (
    <CatalogPage
      path="/recent"
      searchParams={searchParams}
      sort="publishedAt"
      title="Truyện mới"
    />
  )
}
