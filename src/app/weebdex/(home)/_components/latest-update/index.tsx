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

const LIMIT = 18;

export default function LatestUpdate() {
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetChapterUpdatesContentRatingItem)
    : undefined;

  const { data, isLoading, error } = useQuery({
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

  if (isLoading)
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
      <hr className="w-9 h-1 bg-primary border-none" />
      <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {data.map((chapter) => (
          <LatestMangaCard key={chapter.id} chapter={chapter} />
        ))}
      </div>
    </div>
  );
}
