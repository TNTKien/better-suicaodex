import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { isUuid } from "@/lib/catalog"
import { Spinner } from "@workspace/ui/components/spinner"

import { NewChapterForm } from "./new-chapter-form"

export const metadata: Metadata = {
  title: "Thêm chương mới",
  robots: { index: false, follow: false },
}

export default function NewChapterPage({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">Thêm chương mới</h1>
          <Spinner
            aria-label="Đang tải biểu mẫu thêm chương"
            className="self-center"
          />
        </section>
      }
    >
      <NewChapterContent params={params} />
    </Suspense>
  )
}

async function NewChapterContent({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  const { mangaId } = await params
  if (!isUuid(mangaId)) notFound()

  return <NewChapterForm mangaId={mangaId} />
}
