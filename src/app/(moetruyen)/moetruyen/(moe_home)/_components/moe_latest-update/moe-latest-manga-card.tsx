"use client";

import Link from "next/link";
import { Clock, MessageSquareText, MessagesSquare, SwatchBook, Users } from "lucide-react";
import { LazyLoadImage } from "react-lazy-load-image-component";

import { Card, CardContent } from "@/components/ui/card";
import type { GetV1Manga200DataItem } from "@/lib/moetruyen/model/getV1Manga200DataItem";
import { formatNumber, formatTimeToNow } from "@/lib/utils";
import { VN } from "country-flag-icons/react/3x2";

interface MoeLatestMangaCardProps {
  manga: GetV1Manga200DataItem;
}

export default function MoeLatestMangaCard({ manga }: MoeLatestMangaCardProps) {
  const coverUrl = manga.coverUrl ?? "/images/no-cover.webp";
  const mangaHref = `/moetruyen/manga/${manga.id}/${manga.slug}`;
  const chapterLabel = manga.latestChapterNumber
    ? `Ch. ${manga.latestChapterNumber}`
    : manga.isOneshot
      ? "Oneshot"
      : `Tổng ${manga.chapterCount} chương`;

  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200 overflow-hidden border-none">
      <Link href={mangaHref} prefetch={false}>
        <div className="relative w-full aspect-5/7 overflow-hidden rounded-t-sm">
          <LazyLoadImage
            wrapperClassName="block! w-full h-full absolute inset-0"
            src={coverUrl}
            alt={manga.title}
            placeholderSrc="/images/place-doro.webp"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "/images/xidoco.webp";
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 flex h-[45%] items-end bg-linear-to-t from-black/85 to-transparent p-2">
            <p className="text-base font-semibold line-clamp-2 wrap-break-word text-white drop-shadow-xs leading-tight">
              {manga.title}
            </p>
          </div>
        </div>
      </Link>

      <CardContent className="flex flex-col gap-1 px-2 py-1.5">
        <Link
          href={mangaHref}
          prefetch={false}
          className="hover:underline flex items-center gap-1"
        >
          <VN className="inline-block select-none shrink-0 size-4" />
          <p className="font-semibold text-sm truncate px-0.5">
            {chapterLabel}
          </p>
        </Link>

        <div className="space-y-1">
          <div className="flex items-center space-x-1 min-w-0">
            <Users size={16} className="shrink-0" />
            <span className="text-xs font-normal truncate px-0.5">
              {manga.groupName ?? "No Group"}
            </span>
          </div>

          <div className="flex items-center space-x-1 min-w-0 justify-between">
            <div className="flex items-center gap-1 text-xs font-light">
              <Clock size={16} className="shrink-0" />
              {!!manga.updatedAt && (
                <span className="px-0.5 line-clamp-1 break-all">
                  {formatTimeToNow(new Date(manga.updatedAt))}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs font-light">
              <span className="px-0.5 line-clamp-1 break-all">
                {formatNumber(manga.commentCount)}
              </span>
              <MessagesSquare size={16} className="shrink-0" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
