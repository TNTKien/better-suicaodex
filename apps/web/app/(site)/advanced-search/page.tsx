import type { Metadata } from "next"
import { io } from "next/cache"
import { Suspense } from "react"

import { getBrowserApiBaseUrl, getTags } from "@/lib/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { AdvancedSearch } from "./advanced-search"

export const metadata: Metadata = {
  title: "Tìm kiếm nâng cao",
  description:
    "Tìm truyện tranh theo tên, thể loại, tác giả và nhóm dịch trên SuicaoDex.",
  alternates: { canonical: "/advanced-search" },
  robots: { index: false, follow: true },
}

async function AdvancedSearchContent() {
  await io()
  const { data: tags } = await getTags()
  return <AdvancedSearch apiBaseUrl={getBrowserApiBaseUrl()} tags={tags} />
}

export default function AdvancedSearchPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex min-h-72 w-full max-w-480 flex-col gap-6 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">Tìm kiếm nâng cao</h1>
          <div className="flex flex-1 items-center justify-center">
            <Spinner aria-label="Đang tải tìm kiếm nâng cao" />
          </div>
        </section>
      }
    >
      <AdvancedSearchContent />
    </Suspense>
  )
}
