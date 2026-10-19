import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { isUuid } from "@/lib/catalog"
import { Spinner } from "@workspace/ui/components/spinner"

import { EditChapterForm } from "../../new/new-chapter-form"

export const metadata: Metadata = {
  title: "Chỉnh sửa chương",
  robots: { index: false, follow: false },
}

export default function EditChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string; mangaId: string }>
}) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">Chỉnh sửa chương</h1>
          <Spinner
            aria-label="Đang tải biểu mẫu chỉnh sửa chương"
            className="self-center"
          />
        </section>
      }
    >
      <EditChapterContent params={params} />
    </Suspense>
  )
}

async function EditChapterContent({
  params,
}: {
  params: Promise<{ chapterId: string; mangaId: string }>
}) {
  const { chapterId, mangaId } = await params
  if (!isUuid(mangaId) || !isUuid(chapterId)) notFound()

  return <EditChapterForm chapterId={chapterId} mangaId={mangaId} />
}
