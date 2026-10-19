import type { Metadata } from "next"
import { Suspense } from "react"

import { getTags } from "@/lib/api"
import { Spinner } from "@workspace/ui/components/spinner"

import { NewMangaForm } from "./new-manga-form"

export const metadata: Metadata = {
  title: "Thêm truyện mới",
  robots: { index: false, follow: false },
}

export default function NewMangaPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">Thêm truyện mới</h1>
          <Spinner
            aria-label="Đang tải dữ liệu truyện"
            className="self-center"
          />
        </section>
      }
    >
      <NewMangaContent />
    </Suspense>
  )
}

async function NewMangaContent() {
  const { data: tags } = await getTags()

  return <NewMangaForm tags={tags} />
}
