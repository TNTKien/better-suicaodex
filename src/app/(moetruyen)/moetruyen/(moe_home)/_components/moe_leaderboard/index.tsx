"use client";

import { useMounted } from "@mantine/hooks";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetV1MangaTop } from "@/lib/moetruyen/hooks/manga/manga";

import MoeLeaderboardItem from "./moe-leaderboard-item";
import MoeLeaderboardSkeleton from "./moe-leaderboard-skeleton";

const RANKING_TABS = [
  { value: "24h", label: "Ngày" },
  { value: "7d", label: "Tuần" },
  { value: "30d", label: "Tháng" },
  { value: "all_time", label: "Tất cả" },
] as const;

type RankingTabValue = (typeof RANKING_TABS)[number]["value"];

function isRankingTabValue(value: string): value is RankingTabValue {
  return RANKING_TABS.some((tab) => tab.value === value);
}

export default function MoeLeaderboard() {
  const isMounted = useMounted();
  const [activeTab, setActiveTab] = useState<RankingTabValue>("24h");

  const { data, isLoading, error } = useGetV1MangaTop(
    {
      limit: 10,
      sort_by: "views",
      time: activeTab,
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
      <div>
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Bảng xếp hạng</h1>
      </div>

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
            <TabsTrigger key={tab.value} value={tab.value} className="px-2">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {RANKING_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {!data || isLoading ? (
              <MoeLeaderboardSkeleton hideHeader />
            ) : rankingItems.length === 0 ? null : (
              <div className="grid gap-3">
                {rankingItems.map((manga) => (
                  <MoeLeaderboardItem
                    key={`${tab.value}-${manga.id}`}
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
