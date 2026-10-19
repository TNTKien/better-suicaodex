"use client"

import { PrefetchLink } from "@workspace/ui/components/prefetch-link"

import { useState } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import {
  topViewOptions,
  type MangaRanking,
  type MangaRankingWindow,
} from "./ranking"

const periods = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "all-time", label: "Tất cả" },
] as const

function TopViewHeading() {
  return (
    <div className="hvn-home-heading-frame">
      <h2
        id="top-view-heading"
        className="hvn-home-heading"
        data-kind="top-view"
      >
        Top view
      </h2>
    </div>
  )
}

function RankingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải Top view"
      className="flex flex-col gap-3 p-3"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-none" />
      ))}
    </div>
  )
}

export function TopViewResult({
  ranking,
}: {
  ranking: Pick<
    UseQueryResult<MangaRanking>,
    "data" | "isPending" | "isError" | "refetch"
  >
}) {
  if (ranking.isPending) return <RankingSkeleton />
  if (ranking.isError)
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm">
        <p role="alert">Không thể tải bảng xếp hạng.</p>
        <Button
          className="hvn-button"
          size="sm"
          onClick={() => ranking.refetch()}
        >
          Thử lại
        </Button>
      </div>
    )
  const items = ranking.data?.data.filter((item) => item.views > 0) ?? []
  if (items.length === 0)
    return (
      <p className="px-3 py-6 text-center text-sm">
        Chưa có dữ liệu trong khoảng thời gian này.
      </p>
    )

  return (
    <ol className="flex flex-col px-3">
      {items.map(({ manga, rank, views }) => (
        <li
          key={manga.id}
          className="flex flex-col gap-1 border-b border-white/35 py-2.5 last:border-b-0"
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full bg-[#dddddd] text-sm font-semibold text-black",
                rank === 1 && "bg-[#ff0000]",
                rank === 2 && "bg-[#ff9800]",
                rank === 3 && "bg-[#8bc34a]"
              )}
            >
              {rank}
            </span>
            <PrefetchLink
              href={`/manga/${manga.id}/${manga.slug}`}
              title={manga.title}
              className="line-clamp-2 min-w-0 text-sm font-semibold hover:text-[#3293ed] hover:underline"
            >
              {manga.title}
            </PrefetchLink>
          </div>
          <p className="self-end text-xs text-white/75">
            {views.toLocaleString("vi-VN")} views
          </p>
        </li>
      ))}
    </ol>
  )
}

export function TopView({
  apiBaseUrl,
  initialRanking,
}: {
  apiBaseUrl: string
  initialRanking?: MangaRanking
}) {
  const [window, setWindow] = useState<MangaRankingWindow>("day")
  const ranking = useQuery({
    ...topViewOptions(apiBaseUrl, window),
    initialData: window === "day" ? initialRanking : undefined,
  })

  return (
    <section aria-labelledby="top-view-heading" className="min-w-0">
      <TopViewHeading />
      <Tabs
        value={window}
        onValueChange={(value) => setWindow(value as MangaRankingWindow)}
        className="gap-0 border border-t-0 border-white/35"
      >
        <TabsList
          aria-label="Khoảng thời gian Top view"
          className="hvn-ranking-periods grid w-full grid-cols-4 rounded-none"
        >
          {periods.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="hvn-ranking-period rounded-none text-xs"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {periods.map(({ value }) => (
          <TabsContent key={value} value={value}>
            {window === value ? <TopViewResult ranking={ranking} /> : null}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

export function TopViewSkeleton() {
  return (
    <section aria-labelledby="top-view-heading" className="min-w-0">
      <TopViewHeading />
      <div className="border border-t-0 border-white/35">
        <RankingSkeleton />
      </div>
    </section>
  )
}
