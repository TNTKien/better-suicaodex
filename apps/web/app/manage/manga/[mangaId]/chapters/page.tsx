import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ArrowLeftIcon } from "lucide-react"

import { isUuid } from "@/lib/catalog"
import { buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { ChapterList } from "./chapter-list"

export const metadata: Metadata = {
  title: "Danh sách chương",
  robots: { index: false, follow: false },
}

export default function MangaChaptersPage({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Link
          aria-label="Quay lại truyện của nhóm"
          className={buttonVariants({ size: "icon-sm", variant: "secondary" })}
          href="/manage/group/mangas"
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
        <MangaChaptersContent params={params} />
      </Suspense>
    </section>
  )
}

async function MangaChaptersContent({
  params,
}: {
  params: Promise<{ mangaId: string }>
}) {
  const { mangaId } = await params
  if (!isUuid(mangaId)) notFound()

  return <ChapterList mangaId={mangaId} />
}
