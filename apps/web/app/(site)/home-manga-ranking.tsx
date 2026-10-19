"use client"

import { PrefetchLink } from "@workspace/ui/components/prefetch-link"

import { useState } from "react"
import {
  BookmarkIcon,
  EyeIcon,
  MessagesSquareIcon,
  RefreshCwIcon,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { AssetImage } from "@/components/asset-image"
import { cover256 } from "@/lib/catalog"
import {
  mangaRankingOptions,
  type MangaRanking,
  type MangaRankingMetric,
  type MangaRankingWindow,
} from "@/modules/manga/ranking"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

const metrics = [
  { value: "views", label: "Lượt xem", icon: EyeIcon },
  { value: "follows", label: "Theo dõi", icon: BookmarkIcon },
  { value: "comments", label: "Bình luận", icon: MessagesSquareIcon },
] as const

const periods = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "all-time", label: "Tất cả" },
] as const

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function RankingResult({
  metric,
  ranking,
}: {
  metric: MangaRankingMetric
  ranking: ReturnType<typeof useQuery<MangaRanking>>
}) {
  if (ranking.isPending)
    return (
      <div
        aria-label="Đang tải bảng xếp hạng truyện"
        className="flex min-h-28 items-center justify-center"
        role="status"
      >
        <Spinner />
      </div>
    )

  if (ranking.isError)
    return (
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <p>Không thể tải bảng xếp hạng.</p>
        <Button size="sm" variant="outline" onClick={() => ranking.refetch()}>
          <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
          Thử lại
        </Button>
      </div>
    )

  const items = ranking.data.data.filter((item) => item[metric] > 0)
  if (items.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu trong khoảng thời gian này.
      </p>
    )

  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.manga.id}>
          <PrefetchLink
            className="group flex min-w-0 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
            href={`/manga/${item.manga.id}/${item.manga.slug}`}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold",
                item.rank === 1
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : item.rank <= 3
                    ? "bg-secondary text-secondary-foreground ring-1 ring-border"
                    : "text-muted-foreground"
              )}
            >
              {item.rank}
            </span>
            <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              <AssetImage
                alt={`Bìa truyện ${item.manga.title}`}
                className="absolute inset-0 size-full object-cover"
                height={item.manga.cover?.height ?? 400}
                src={cover256(item.manga.cover?.url ?? null)}
                width={item.manga.cover?.width ?? 256}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-heading text-sm leading-tight font-semibold group-hover:text-primary">
                {item.manga.title}
              </span>
              <span className="mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {metrics.map(
                  ({ icon: StatisticIcon, label: statisticLabel, value }) => (
                    <span
                      aria-label={`${compactNumber.format(item[value])} ${statisticLabel.toLocaleLowerCase("vi")}`}
                      className={cn(
                        "inline-flex items-center gap-1",
                        value === metric && "font-semibold text-foreground"
                      )}
                      key={value}
                    >
                      <StatisticIcon aria-hidden="true" className="size-3.5" />
                      {compactNumber.format(item[value])}
                    </span>
                  )
                )}
              </span>
            </span>
          </PrefetchLink>
        </li>
      ))}
    </ol>
  )
}

export function HomeMangaRanking({
  apiBaseUrl,
  initialRanking,
}: {
  apiBaseUrl: string
  initialRanking: MangaRanking
}) {
  const [metric, setMetric] = useState<MangaRankingMetric>("views")
  const [window, setWindow] = useState<MangaRankingWindow>("day")
  const ranking = useQuery({
    ...mangaRankingOptions(apiBaseUrl, metric, window),
    initialData:
      metric === "views" && window === "day" ? initialRanking : undefined,
  })

  return (
    <Tabs
      value={metric}
      onValueChange={(value) => setMetric(value as MangaRankingMetric)}
    >
      <TabsList
        aria-label="Chỉ số BXH truyện"
        className="grid w-full grid-cols-3"
      >
        {metrics.map(({ label, value }) => (
          <TabsTrigger className="text-xs" key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {metrics.map(({ value }) => (
        <TabsContent key={value} value={value}>
          {metric === value ? (
            <Tabs
              value={window}
              onValueChange={(value) => setWindow(value as MangaRankingWindow)}
            >
              <TabsList
                aria-label="Khoảng thời gian BXH truyện"
                className="grid w-full grid-cols-4"
              >
                {periods.map((period) => (
                  <TabsTrigger
                    className="text-xs"
                    key={period.value}
                    value={period.value}
                  >
                    {period.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {periods.map((period) => (
                <TabsContent key={period.value} value={period.value}>
                  {window === period.value ? (
                    <RankingResult metric={metric} ranking={ranking} />
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
