"use client";

import { useMounted } from "@mantine/hooks";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useGetV2MangaTop } from "@/lib/moetruyen/hooks/manga/manga";
import type {
  GetV2MangaTopSortBy,
  GetV2MangaTopTime,
} from "@/lib/moetruyen/model";

import MoeLeaderboardItem from "./moe-leaderboard-item";
import MoeLeaderboardSkeleton from "./moe-leaderboard-skeleton";

const RANKING_SORT_OPTIONS = [
  { value: "views", label: "Lượt xem" },
  { value: "bookmarks", label: "Theo dõi" },
  { value: "comments", label: "Bình luận" },
] as const satisfies readonly {
  value: GetV2MangaTopSortBy;
  label: string;
}[];

const RANKING_TABS = [
  { value: "24h", label: "Ngày" },
  { value: "7d", label: "Tuần" },
  { value: "30d", label: "Tháng" },
  { value: "all_time", label: "Tất cả" },
] as const;

type RankingSortValue = (typeof RANKING_SORT_OPTIONS)[number]["value"];
type RankingTabValue = Extract<
  (typeof RANKING_TABS)[number]["value"],
  GetV2MangaTopTime
>;

function isRankingSortValue(value: string): value is RankingSortValue {
  return RANKING_SORT_OPTIONS.some((option) => option.value === value);
}

function isRankingTabValue(value: string): value is RankingTabValue {
  return RANKING_TABS.some((tab) => tab.value === value);
}

export default function MoeLeaderboard() {
  const isMounted = useMounted();
  const [activeSort, setActiveSort] = useState<RankingSortValue>("views");
  const [activeTab, setActiveTab] = useState<RankingTabValue>("24h");
  const activeTime = activeSort === "views" ? activeTab : "all_time";

  const { data, isLoading, error } = useGetV2MangaTop(
    {
      limit: 10,
      sort_by: activeSort,
      time: activeTime,
    },
    {
      query: {
        enabled: isMounted,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  );

  const rankingItems = data?.status === 200 ? data.data.data : [];

  if (!isMounted) {
    return <MoeLeaderboardSkeleton />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <div>
          <hr className="h-1 w-9 border-none bg-primary" />
          <h1 className="text-2xl font-black uppercase">Bảng xếp hạng</h1>
        </div>
      </div>

      <Tabs
        value={activeSort}
        onValueChange={(value) => {
          if (isRankingSortValue(value)) {
            setActiveSort(value);
          }
        }}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full grid-cols-3">
          {RANKING_SORT_OPTIONS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="px-2"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {RANKING_SORT_OPTIONS.map((option) => (
          <TabsContent
            key={option.value}
            value={option.value}
            className="mt-4 space-y-4"
          >
            {option.value === "views" ? (
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  if (isRankingTabValue(value)) {
                    setActiveTab(value);
                  }
                }}
                className="w-full"
              >
                <TabsList className="grid h-auto w-full grid-cols-4">
                  {RANKING_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="px-2"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : null}

            {!data || isLoading ? (
              <MoeLeaderboardSkeleton hideHeader />
            ) : rankingItems.length === 0 ? null : (
              <div className="grid gap-3">
                {rankingItems.map((manga) => (
                  <MoeLeaderboardItem
                    key={`${option.value}-${activeTime}-${manga.id}`}
                    manga={manga}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
