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
  GetMangaStatusItem,
} from "@/lib/weebdex/model";
import { Marquee } from "@/components/ui/marquee";
import CompletedSkeletonCard from "./completed-skeleton-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useIsMounted } from "usehooks-ts";
import MangaCard from "@/app/(suicaodex)/(manga)/manga/_components/manga-card";

const LIMIT = 40;

export default function CompletedManga() {
  const isMounted = useIsMounted();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaContentRatingItem)
    : undefined;

  const { data, isLoading, error } = useQuery({
    enabled: isMounted(),
    queryKey: ["weebdex", "manga", "completed", config.r18],
    queryFn: async () => {
      const res = await getManga({
        limit: LIMIT,
        status: [GetMangaStatusItem.completed],
        sort: GetMangaSort.updatedAt,
        order: GetMangaOrder.desc,
        contentRating,
      });
      if (res.status !== 200)
        throw new Error("Failed to fetch completed manga");
      return (res as getMangaResponseSuccess).data.data ?? [];
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  if (!isMounted() || isLoading)
    return (
      <div className="flex flex-col gap-4">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Đã hoàn thành</h1>
        </div>
        <div className="grid grid-cols-1 grid-rows-2 gap-3 h-[450px] md:h-[650px] overflow-hidden">
          <div className="flex gap-3">
            {[...Array(8)].map((_, i) => (
              <CompletedSkeletonCard key={i} />
            ))}
          </div>
          <div className="flex gap-3">
            {[...Array(8)].map((_, i) => (
              <CompletedSkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );

  if (error || !data || data.length === 0) return null;

  const firstRow = data.slice(0, Math.ceil(data.length / 2));
  const secondRow = data.slice(Math.ceil(data.length / 2));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex justify-between">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Đã hoàn thành</h1>
        </div>
        <Button
          asChild
          size="icon"
          variant="secondary"
          className="[&_svg]:size-5"
        >
          <Link
            href="/advanced-search?status=completed"
            prefetch={false}
          >
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="relative grid grid-cols-1 grid-rows-2 gap-3 h-[450px] md:h-[650px]">
        <Marquee pauseOnHover className="[--duration:75s] p-0">
          {firstRow.map((manga) => (
            <Link
              key={manga.id}
              href={`/manga/${manga.id}`}
              prefetch={false}
            >
              <MangaCard
                manga_id={manga.id!}
                title={manga.title ?? ""}
                cover={manga.relationships?.cover!}
                className="aspect-5/7"
              />
            </Link>
          ))}
        </Marquee>

        <Marquee reverse pauseOnHover className="[--duration:75s] p-0">
          {secondRow.map((manga) => (
            <Link
              key={manga.id}
              href={`/manga/${manga.id}`}
              prefetch={false}
            >
              <MangaCard
                manga_id={manga.id!}
                title={manga.title ?? ""}
                cover={manga.relationships?.cover!}
                className="aspect-5/7"
              />
            </Link>
          ))}
        </Marquee>

        <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-linear-to-r"></div>
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/5 bg-linear-to-l"></div>
      </div>
    </div>
  );
}
