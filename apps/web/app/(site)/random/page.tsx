import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ShuffleIcon } from "lucide-react"
import { Suspense } from "react"

import { getRandomManga } from "@/lib/api"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = {
  title: "Truyện ngẫu nhiên",
}

async function RandomManga() {
  const { data } = await getRandomManga()
  const manga = data[0]

  if (manga) redirect(`/manga/${manga.id}/${manga.slug}`)

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShuffleIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Chưa có truyện để chọn</EmptyTitle>
        <EmptyDescription>
          Truyện ngẫu nhiên sẽ xuất hiện khi catalog có nội dung đọc được.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default function RandomPage() {
  return (
    <section className="mx-auto flex max-w-480 flex-col gap-4 px-4 py-6 sm:px-6">
      {/* <h1 className="section-heading text-2xl">Truyện ngẫu nhiên</h1> */}
      <Suspense
        fallback={
          <div className="flex min-h-48 items-center justify-center">
            <Spinner aria-label="Đang chọn truyện ngẫu nhiên" />
          </div>
        }
      >
        <RandomManga />
      </Suspense>
    </section>
  )
}
