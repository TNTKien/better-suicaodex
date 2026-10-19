import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ArrowLeftIcon } from "lucide-react"

import { isUuid } from "@/lib/catalog"
import { buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { AdminChapterList } from "./chapter-list"

export const metadata: Metadata = { title: "Danh sách chương" }
export const instant = false

export default function AdminMangaChaptersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Link
          aria-label="Quay lại quản lý truyện"
          className={buttonVariants({ size: "icon-sm", variant: "secondary" })}
          href="/admin/mangas"
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Link>
        <h1 className="section-heading text-2xl">Danh sách chương</h1>
      </div>
      <Suspense
        fallback={
          <Spinner
            aria-label="Đang tải danh sách chương"
            className="self-center"
          />
        }
      >
        <AdminMangaChaptersContent params={params} />
      </Suspense>
    </section>
  )
}

async function AdminMangaChaptersContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  return <AdminChapterList mangaId={id} />
}
