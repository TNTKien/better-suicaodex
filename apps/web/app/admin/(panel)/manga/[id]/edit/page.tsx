import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { AdminEditMangaForm } from "@/app/manage/manga/new/new-manga-form"
import { getTags } from "@/lib/api"
import { isUuid } from "@/lib/catalog"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Chỉnh sửa truyện" }
export const instant = false

function Loading() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Chỉnh sửa truyện</h1>
      <Spinner aria-label="Đang tải dữ liệu truyện" className="self-center" />
    </section>
  )
}

export default function AdminEditMangaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminEditMangaContent params={params} />
    </Suspense>
  )
}

async function AdminEditMangaContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { data: tags } = await getTags()

  return <AdminEditMangaForm mangaId={id} tags={tags} />
}
