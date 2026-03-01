"use client";

import { useConfig } from "@/hooks/use-config";
import { getTopFollowedMangas } from "@/lib/mangadex/manga";
import { useQuery } from "@tanstack/react-query";
import TopFollowedCard from "./top-followed-card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import LeaderBoardCardSkeleton from "../leaderboard-card-skeleon";

export default function TopFollowed() {
  const [config] = useConfig();
  const { data, error, isLoading } = useQuery({
    queryKey: ["follow", config.translatedLanguage, config.r18],
    queryFn: () => getTopFollowedMangas(config.translatedLanguage, config.r18),
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  if (isLoading)
    return (
      <div className="grid grid-cols-1 gap-1.5 rounded-sm">
        {[...Array(4)].map((_, index) => (
          <LeaderBoardCardSkeleton key={index} />
        ))}
      </div>
    );
  if (error || !data) return null;

  return (
    <div className="grid grid-cols-1 gap-1.5 rounded-sm">
      {data.map((manga, index) => (
        <div key={manga.id} className="flex flex-col gap-1.5">
          <div className="flex gap-1.5 justify-between items-center">
            <TopFollowedCard key={manga.id} manga={manga} />
            <span
              className={cn(
                "text-7xl md:text-8xl font-black",
                index === 0 && "text-primary"
              )}
            >
              {index + 1}
            </span>
          </div>

          {index !== data.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}
