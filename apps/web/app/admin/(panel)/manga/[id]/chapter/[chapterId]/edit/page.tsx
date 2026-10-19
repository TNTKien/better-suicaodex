import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { AdminEditChapterForm } from "@/app/manage/manga/[mangaId]/chapters/new/new-chapter-form"
import { isUuid } from "@/lib/catalog"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Chỉnh sửa chương" }
export const instant = false

export default function AdminEditChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">Chỉnh sửa chương</h1>
          <Spinner aria-label="Đang tải chương" className="self-center" />
        </section>
      }
    >
      <AdminEditChapterContent params={params} />
    </Suspense>
  )
}

async function AdminEditChapterContent({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params
  if (!isUuid(id) || !isUuid(chapterId)) notFound()
  return <AdminEditChapterForm chapterId={chapterId} mangaId={id} />
}
