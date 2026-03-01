"use client";

import { useConfig } from "@/hooks/use-config";
import {
  getManga,
  getMangaResponseSuccess,
} from "@/lib/weebdex/hooks/manga/manga";
import {
  GetMangaContentRatingItem,
  GetMangaOrder,
  GetMangaSort,
} from "@/lib/weebdex/model";
import { useQuery } from "@tanstack/react-query";
import { useIsMounted } from "usehooks-ts";
import Link from "next/link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BugIcon } from "lucide-react";
import PaginationControl from "@/components/Custom/pagination-control";
import RecentlySkeletonCard from "@/app/(suicaodex)/(home)/_components/recently-manga/recently-skeleton-card";
import MangaCard from "../../manga/_components/manga-card";

interface RecentProps {
  page: number;
}
const LIMIT = 36;

export default function Recent({ page }: RecentProps) {
  const isMounted = useIsMounted();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaContentRatingItem)
    : undefined;

  const { data, isLoading, error } = useQuery({
    enabled: isMounted(),
    queryKey: [
      "weebdex",
      "manga",
      "recent",
      config.r18,
      config.translatedLanguage,
      page,
    ],
    queryFn: async () => {
      const res = await getManga({
        limit: LIMIT,
        sort: GetMangaSort.createdAt,
        order: GetMangaOrder.desc,
        availableTranslatedLang: config.translatedLanguage,
        contentRating,
        page,
      });
      if (res.status !== 200) throw new Error("Failed to fetch recent manga");
      return (res as getMangaResponseSuccess).data;
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  if (!isMounted() || isLoading)
    return (
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {[...Array(LIMIT)].map((_, i) => (
          <RecentlySkeletonCard key={i} />
        ))}
      </div>
    );

  if (error || !data)
    return (
      <Empty className="bg-muted/30 h-full mt-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BugIcon />
          </EmptyMedia>
          <EmptyTitle>Lỗi mất rồi 🤪</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Có lỗi xảy ra, thử F5 xem sao nhé
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const totalPages = Math.ceil((data.total ?? 0) / LIMIT);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {(data.data ?? []).map((manga) => (
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

      <PaginationControl
        currentPage={page}
        totalPages={totalPages}
        createHref={(p) => `/weebdex/recent?page=${p}`}
        className="mt-4"
      />
    </>
  );
}
