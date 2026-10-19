import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { getTags } from "@/lib/api"
import { isUuid } from "@/lib/catalog"
import { Spinner } from "@workspace/ui/components/spinner"

import { EditMangaForm } from "../../new/new-manga-form"

export const metadata: Metadata = {
  title: "Chỉnh sửa truyện",
  robots: { index: false, follow: false },
}

export default function EditMangaPage({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">Chỉnh sửa truyện</h1>
          <Spinner
            aria-label="Đang tải dữ liệu truyện"
            className="self-center"
          />
        </section>
      }
    >
      <EditMangaContent params={params} />
    </Suspense>
  )
}

async function EditMangaContent({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  const { mangaId } = await params
  if (!isUuid(mangaId)) notFound()
  const { data: tags } = await getTags()

  return <EditMangaForm mangaId={mangaId} tags={tags} />
}
