"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bookmark, Eye, MessagesSquare } from "lucide-react";
import { LazyLoadImage } from "react-lazy-load-image-component";

import { Card } from "@/components/ui/card";
import { getMoetruyenThumbnailCoverUrl } from "@/lib/moetruyen/cover-url";
import type { GetV2MangaTop200DataItem } from "@/lib/moetruyen/model";
import { formatNumber } from "@/lib/utils";

const FALLBACK_COVER = "/images/place-doro.webp";
const NO_COVER = "/images/no-cover.webp";

const RANKING_ICON_MAP: Record<
  GetV2MangaTop200DataItem["ranking"]["sortBy"],
  LucideIcon
> = {
  views: Eye,
  bookmarks: Bookmark,
  comments: MessagesSquare,
};

export default function MoeLeaderboardItem({
  manga,
}: {
  manga: GetV2MangaTop200DataItem;
}) {
  const href = `/moetruyen/manga/${manga.id}/${manga.slug}`;
  const coverUrl = getMoetruyenThumbnailCoverUrl(manga.coverUrl ?? NO_COVER, {
    w: 256,
    q: 80,
  });
  const RankingIcon = RANKING_ICON_MAP[manga.ranking.sortBy] ?? Eye;

  return (
    <Card className="overflow-hidden rounded-md border-none shadow-xs transition-colors duration-200 min-h-[121px]">
      <Link
        href={href}
        prefetch={false}
        className="flex items-center gap-3 p-3"
      >
        <div className="flex h-24 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-2xl font-black text-primary">
          {manga.ranking.rank}
        </div>

        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md">
          <LazyLoadImage
            wrapperClassName="block! absolute inset-0 h-full w-full"
            src={coverUrl}
            alt={manga.title}
            placeholderSrc={FALLBACK_COVER}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = NO_COVER;
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-lg font-semibold leading-tight">
            {manga.title}
          </p>

          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {manga.groupName ?? "No Group"}
          </p>

          <div className="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <span className="truncate">
                {formatNumber(manga.ranking.value)}
              </span>
              <RankingIcon className="size-4 shrink-0" />
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
