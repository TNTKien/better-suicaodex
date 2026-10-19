import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { isUuid } from "@/lib/catalog"
import { AdminImageServer2 } from "@/modules/image-server2/admin"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Chapter · TikTok Server 2" }
export const instant = false

export default function ImageServer2ChaptersPage({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Chapter · TikTok Server 2</h1>
      <Suspense fallback={<Spinner aria-label="Đang tải danh sách chapter" />}>
        <ChaptersContent params={params} />
      </Suspense>
    </section>
  )
}

async function ChaptersContent({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  const { mangaId } = await params
  if (!isUuid(mangaId)) notFound()
  return <AdminImageServer2 key={mangaId} mangaId={mangaId} />
}
