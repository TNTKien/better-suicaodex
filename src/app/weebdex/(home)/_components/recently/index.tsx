"use client";

import { useConfig } from "@/hooks/use-config";
import { useQuery } from "@tanstack/react-query";
import {
  getManga,
  getMangaResponseSuccess,
} from "@/lib/weebdex/hooks/manga/manga";
import {
  GetMangaContentRatingItem,
  GetMangaOrder,
  GetMangaSort,
} from "@/lib/weebdex/model";
import MangaCard from "@/app/weebdex/manga/_components/manga-card";
import RecentlySkeletonCard from "./recently-skeleton-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const LIMIT = 18;

export default function Recently() {
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaContentRatingItem)
    : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["weebdex", "manga", "recently", config.r18, config.translatedLanguage],
    queryFn: async () => {
      const res = await getManga({
        limit: LIMIT,
        sort: GetMangaSort.createdAt,
        order: GetMangaOrder.desc,
        availableTranslatedLang: config.translatedLanguage,
        contentRating,
      });
      if (res.status !== 200) throw new Error("Failed to fetch recent manga");
      return (res as getMangaResponseSuccess).data.data ?? [];
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  if (isLoading)
    return (
      <div className="flex flex-col">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Truyện mới</h1>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {[...Array(LIMIT)].map((_, i) => (
            <RecentlySkeletonCard key={i} />
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
          <h1 className="text-2xl font-black uppercase">Truyện mới</h1>
        </div>

        <Button
          asChild
          size="icon"
          variant="secondary"
          className="[&_svg]:size-5"
        >
          <Link href="/weebdex/recently" prefetch={false}>
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {data.map((manga) => (
          <Link
            key={manga.id}
            href={`/weebdex/manga/${manga.id}`}
            prefetch={false}
          >
            <MangaCard
              manga_id={manga.id!}
              title={manga.title ?? ""}
              cover={manga.relationships?.cover!}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
