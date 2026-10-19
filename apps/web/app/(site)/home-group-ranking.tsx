"use client"

import { useState } from "react"
import Link from "next/link"
import { BookOpenTextIcon, EyeIcon, RefreshCwIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import {
  groupRankingOptions,
  type GroupRanking,
  type GroupRankingWindow,
} from "@/modules/groups/ranking"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

const periods = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "all-time", label: "Tất cả" },
] as const

const countNumber = new Intl.NumberFormat("vi-VN")

function RankingResult({
  ranking,
}: {
  ranking: ReturnType<typeof useQuery<GroupRanking>>
}) {
  if (ranking.isPending)
    return (
      <div
        aria-label="Đang tải bảng xếp hạng nhóm dịch"
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

  if (ranking.data.data.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu trong khoảng thời gian này.
      </p>
    )

  return (
    <ItemGroup className="gap-1">
      {ranking.data.data.map((item) => (
        <Item
          className="flex-nowrap"
          key={item.group.id}
          render={
            <Link
              href={`/group/${item.group.id}/${item.group.slug}`}
              prefetch={false}
            />
          }
          role="listitem"
          size="sm"
        >
          <ItemMedia>
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
            <Avatar className="size-10 after:rounded-md">
              <AvatarImage
                alt=""
                className="rounded-md"
                referrerPolicy="no-referrer"
                src={item.group.avatarUrl ?? "/images/kokkoro-avt.webp"}
              />
              <AvatarFallback className="rounded-md font-heading text-xs font-bold">
                {item.group.name.slice(0, 2).toLocaleUpperCase("vi")}
              </AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="font-heading font-semibold group-hover/item:text-primary">
              {item.group.name}
            </ItemTitle>
            <ItemDescription className="flex items-center gap-3 text-xs">
              <span
                aria-label={`${countNumber.format(item.views)} lượt xem`}
                className="inline-flex items-center gap-1"
              >
                <EyeIcon aria-hidden="true" className="size-3.5" />
                {countNumber.format(item.views)}
              </span>
              <span
                aria-label={`${countNumber.format(item.chapters)} chương`}
                className="inline-flex items-center gap-1"
              >
                <BookOpenTextIcon aria-hidden="true" className="size-3.5" />
                {countNumber.format(item.chapters)}
              </span>
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}

export function HomeGroupRanking({
  apiBaseUrl,
  initialRanking,
}: {
  apiBaseUrl: string
  initialRanking: GroupRanking
}) {
  const [window, setWindow] = useState<GroupRankingWindow>("day")
  const ranking = useQuery({
    ...groupRankingOptions(apiBaseUrl, window),
    initialData: window === "day" ? initialRanking : undefined,
  })

  return (
    <Tabs
      value={window}
      onValueChange={(value) => setWindow(value as GroupRankingWindow)}
    >
      <TabsList
        aria-label="Khoảng thời gian BXH nhóm dịch"
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
          {window === period.value ? <RankingResult ranking={ranking} /> : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
