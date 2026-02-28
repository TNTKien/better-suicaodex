"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getChapterUpdates,
  getChapterUpdatesResponseSuccess,
} from "@/lib/weebdex/hooks/chapter/chapter";
import { useConfig } from "@/hooks/use-config";
import { GetChapterUpdatesContentRatingItem } from "@/lib/weebdex/model";
import LatestMangaCard from "./latest-manga-card";
import LatestSkeletonCard from "./latest-skeleton-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useIsMounted } from "usehooks-ts";

const LIMIT = 36;

export default function LatestUpdate() {
  const isMounted = useIsMounted();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetChapterUpdatesContentRatingItem)
    : undefined;

  const { data, isLoading, error } = useQuery({
    enabled: isMounted(),
    queryKey: [
      "weebdex",
      "chapter",
      "updates",
      config.r18,
      config.translatedLanguage,
    ],
    queryFn: async () => {
      const res = await getChapterUpdates({
        limit: LIMIT,
        tlang: config.translatedLanguage,
        contentRating,
      });
      if (res.status !== 200)
        throw new Error("Failed to fetch chapter updates");
      return (res as getChapterUpdatesResponseSuccess).data.data ?? [];
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });

  if (!isMounted() || isLoading)
    return (
      <div className="flex flex-col">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {[...Array(LIMIT)].map((_, i) => (
            <LatestSkeletonCard key={i} />
          ))}
        </div>
      </div>
    );

  if (error || !data) return null;

  return (
    <div className="flex flex-col">
      <div className="flex justify-between">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
        </div>

        <Button
          asChild
          size="icon"
          variant="secondary"
          className="[&_svg]:size-5"
        >
          <Link href={`/weebdex/latest`} prefetch={false}>
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {data.map((chapter) => (
          <LatestMangaCard key={chapter.id} chapter={chapter} />
        ))}
      </div>
    </div>
  );
}
