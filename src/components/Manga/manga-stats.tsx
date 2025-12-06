"use client";

import { MangaStats } from "@/types/types";
import { FC } from "react";
import { Bookmark, MessageSquare, Star } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import { RatingChart } from "./rating-chart";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useConfig } from "@/hooks/use-config";
import { cn, formatNumber } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface MangaStatsProps {
  stats: MangaStats;
  size: "sm" | "lg";
}

export const MangaStatsComponent: FC<MangaStatsProps> = ({ stats, size }) => {
  const [config] = useConfig();
  const isMobile = useIsMobile();
  //TODO: fetch
  return (
    <div className="flex flex-wrap gap-2 lowercase!">
      {isMobile ? (
        <Popover>
          <PopoverTrigger asChild>
            <span className="flex items-center gap-1 text-sm cursor-pointer text-[hsl(var(--primary))] drop-shadow-md">
              <Star size={16} />
              <span>{stats.rating.bayesian.toFixed(2)}</span>
            </span>
          </PopoverTrigger>
          <PopoverContent
            className={cn("w-80 py-2 px-0", `theme-${config.theme}`)}
          >
            <RatingChart stats={stats} />
          </PopoverContent>
        </Popover>
      ) : (
        <HoverCard openDelay={0}>
          <HoverCardTrigger asChild>
            <span
              className={cn(
                "flex items-center gap-1 cursor-pointer text-[hsl(var(--primary))] drop-shadow-md",
                size === "sm" ? "text-sm" : "text-base"
              )}
            >
              <Star size={size === "sm" ? 16 : 18} />
              <span>{stats.rating.bayesian.toFixed(2)}</span>
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-80 py-2 px-0 rounded-md">
            <RatingChart stats={stats} />
          </HoverCardContent>
        </HoverCard>
      )}

      <span
        className={cn(
          "flex items-center gap-1 drop-shadow-md",
          size === "sm" ? "text-sm" : "text-base"
        )}
      >
        <Bookmark size={size === "sm" ? 16 : 18} />
        <span>{formatNumber(stats.follows)}</span>
      </span>
      {!!stats.comments && (
        <span
          className={cn(
            "flex items-center gap-1 drop-shadow-md",
            size === "sm" ? "text-sm" : "text-base"
          )}
        >
          <MessageSquare size={size === "sm" ? 16 : 18} />
          <span>{formatNumber(stats.comments)}</span>
        </span>
      )}
    </div>
  );
};
