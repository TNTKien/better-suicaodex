import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { SiteHeader } from "@/components/site-header"
import { JsonLd } from "@/components/json-ld"
import { siteConfig } from "@/config/site"
import { getBrowserApiBaseUrl, getChapter } from "@/lib/api"
import { chapterLabel, isUuid } from "@/lib/catalog"
import { getChapterOgImageUrl } from "@/lib/og-image"
import { getChapterStructuredData } from "@/lib/structured-data"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ReaderClient } from "./reader-client"

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  if (!isUuid(id)) return { title: "Không tìm thấy chương" } satisfies Metadata
  const chapter = await getChapter(id)

  if (!chapter) return { title: "Không tìm thấy chương" } satisfies Metadata

  const canonical = `/chapter/${chapter.id}`
  const title = `${chapter.manga.title} - ${chapterLabel(chapter)}`
  const description = `Đọc ${chapterLabel(chapter)} của ${chapter.manga.title}.`
  const image = {
    url: getChapterOgImageUrl(chapter.id),
    width: 1200,
    height: 630,
    alt: title,
  }

  return {
    alternates: { canonical },
    description,
    title,
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: siteConfig.name,
      title,
      description,
      url: canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  } satisfies Metadata
}

async function Reader({ params }: { params: Params }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const chapter = await getChapter(id)

  if (!chapter) notFound()

  return (
    <>
      <JsonLd data={getChapterStructuredData(chapter)} />
      <ReaderClient
        apiBaseUrl={getBrowserApiBaseUrl()}
        chapter={chapter}
        header={<SiteHeader showSidebarTrigger={false} />}
        key={chapter.id}
      />
    </>
  )
}

function ReaderSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 overflow-hidden p-4 lg:gap-6 lg:p-0">
      <Skeleton className="hidden h-[80dvh] w-[calc((100vw-3rem)/3)] shrink-0 rounded-none bg-neutral-800 opacity-40 lg:block" />
      <Skeleton className="h-[80dvh] w-full max-w-4xl shrink-0 rounded-none bg-neutral-800 lg:w-[calc((100vw-3rem)/3)]" />
      <Skeleton className="hidden h-[80dvh] w-[calc((100vw-3rem)/3)] shrink-0 rounded-none bg-neutral-800 opacity-40 lg:block" />
    </div>
  )
}

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <Reader params={params} />
    </Suspense>
  )
}
