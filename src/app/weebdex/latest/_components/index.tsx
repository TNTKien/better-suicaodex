"use client";

import { useConfig } from "@/hooks/use-config";
import {
  getChapterUpdates,
  getChapterUpdatesResponseSuccess,
} from "@/lib/weebdex/hooks/chapter/chapter";
import { GetChapterUpdatesContentRatingItem } from "@/lib/weebdex/model";
import { useQuery } from "@tanstack/react-query";
import { useIsMounted } from "usehooks-ts";
import LatestSkeletonCard from "../../(home)/_components/latest-update/latest-skeleton-card";
import LatestMangaCard from "../../(home)/_components/latest-update/latest-manga-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BugIcon } from "lucide-react";
import PaginationControl from "@/components/Custom/pagination-control";

interface LatestProps {
  page: number;
}
const LIMIT = 36;

export default function Latest({ page }: LatestProps) {
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
      page,
    ],
    queryFn: async () => {
      const res = await getChapterUpdates({
        limit: LIMIT,
        tlang: config.translatedLanguage,
        contentRating,
        page,
      });
      if (res.status !== 200)
        throw new Error("Failed to fetch chapter updates");
      return (res as getChapterUpdatesResponseSuccess).data;
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  if (!isMounted() || isLoading)
    return (
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {[...Array(LIMIT)].map((_, i) => (
          <LatestSkeletonCard key={i} />
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
        {(data.data ?? []).map((chapter) => (
          <LatestMangaCard key={chapter.id} chapter={chapter} />
        ))}
      </div>

      <PaginationControl
        currentPage={page}
        totalPages={totalPages}
        createHref={(p) => `/weebdex/latest?page=${p}`}
        className="mt-6"
      />
    </>
  );
}
