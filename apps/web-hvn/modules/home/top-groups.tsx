"use client"

import { useState } from "react"
import Link from "next/link"
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
  topGroupsOptions,
  type GroupRanking,
  type GroupRankingWindow,
} from "./ranking"

const periods = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "all-time", label: "Tất cả" },
] as const

function TopGroupsHeading() {
  return (
    <div className="hvn-home-heading-frame">
      <h2
        id="top-groups-heading"
        className="hvn-home-heading"
        data-kind="top-groups"
      >
        Top 5 nhóm
      </h2>
    </div>
  )
}

function RankingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải Top 5 nhóm"
      className="flex flex-col gap-3 p-3"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-none" />
      ))}
    </div>
  )
}

export function TopGroupsResult({
  ranking,
}: {
  ranking: Pick<
    UseQueryResult<GroupRanking>,
    "data" | "isPending" | "isError" | "refetch"
  >
}) {
  if (ranking.isPending) return <RankingSkeleton />
  if (ranking.isError)
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm">
        <p role="alert">Không thể tải bảng xếp hạng nhóm dịch.</p>
        <Button
          className="hvn-button"
          size="sm"
          onClick={() => ranking.refetch()}
        >
          Thử lại
        </Button>
      </div>
    )
  const items = ranking.data?.data ?? []
  if (items.length === 0)
    return (
      <p className="px-3 py-6 text-center text-sm">
        Chưa có dữ liệu trong khoảng thời gian này.
      </p>
    )

  return (
    <ol className="flex flex-col px-3">
      {items.map(({ group, rank, views, chapters }) => (
        <li
          key={group.id}
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
            <Link
              href={`/group/${group.id}/${group.slug}`}
              prefetch={false}
              title={group.name}
              className="line-clamp-2 min-w-0 text-sm font-semibold hover:text-[#3293ed] hover:underline"
            >
              {group.name}
            </Link>
          </div>
          <p className="self-end text-xs text-white/75">
            {views.toLocaleString("vi-VN")} views
          </p>
        </li>
      ))}
    </ol>
  )
}

export function TopGroups({
  apiBaseUrl,
  initialRanking,
}: {
  apiBaseUrl: string
  initialRanking?: GroupRanking
}) {
  const [window, setWindow] = useState<GroupRankingWindow>("day")
  const ranking = useQuery({
    ...topGroupsOptions(apiBaseUrl, window),
    initialData: window === "day" ? initialRanking : undefined,
  })

  return (
    <section aria-labelledby="top-groups-heading" className="min-w-0">
      <TopGroupsHeading />
      <Tabs
        value={window}
        onValueChange={(value) => setWindow(value as GroupRankingWindow)}
        className="gap-0 border border-t-0 border-white/35"
      >
        <TabsList
          aria-label="Khoảng thời gian Top 5 nhóm"
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
            {window === value ? <TopGroupsResult ranking={ranking} /> : null}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

export function TopGroupsSkeleton() {
  return (
    <section aria-labelledby="top-groups-heading" className="min-w-0">
      <TopGroupsHeading />
      <div className="border border-t-0 border-white/35">
        <RankingSkeleton />
      </div>
    </section>
  )
}
