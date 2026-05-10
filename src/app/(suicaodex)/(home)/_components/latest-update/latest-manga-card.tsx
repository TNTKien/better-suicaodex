"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatTimeToNow, generateSlug } from "@/lib/utils";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import { Chapter } from "@/lib/weebdex/model";
import Link from "next/link";
import { GB, VN } from "country-flag-icons/react/3x2";
import { Clock, MessagesSquare, Users } from "lucide-react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface LatestMangaCardProps {
  chapter: Chapter;
}

export default function LatestMangaCard({ chapter }: LatestMangaCardProps) {
  const manga = chapter.relationships?.manga;
  const groups = chapter.relationships?.groups ?? [];

  if (!manga) return null;

  const { title } = parseMangaTitle(manga);
  const slug = generateSlug(title);

  const cover = manga.relationships?.cover;
  const coverUrl = cover?.id
    ? `${siteConfig.weebdex.proxyURL}/covers/${manga.id}/${cover.id}.512.webp`
    : "/images/xidoco.webp";

  const chapterLabel = chapter.chapter
    ? `Ch. ${chapter.chapter}${chapter.title ? ` - ${chapter.title}` : ""}`
    : "Oneshot";

  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200 overflow-hidden border-none">
      <Link href={`/manga/${manga.id}/${slug}`} prefetch={false}>
        <div className="relative w-full aspect-5/7 overflow-hidden rounded-t-sm">
          <LazyLoadImage
            wrapperClassName="block! w-full h-full absolute inset-0"
            src={coverUrl}
            alt={title}
            placeholderSrc="/images/place-doro.webp"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "/images/xidoco.webp";
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-linear-to-t from-black/85 to-transparent flex items-end p-2">
            <p className="text-base font-semibold line-clamp-2 break-all text-white drop-shadow-xs leading-tight">
              {title}
            </p>
          </div>
        </div>
      </Link>

      <CardContent className="flex flex-col gap-1 px-2 py-1.5">
        <Link
          href={`/chapter/${chapter.id}`}
          prefetch={false}
          className="hover:underline flex items-center gap-1"
        >
          {chapter.language === "vi" && (
            <VN className="inline-block select-none shrink-0 size-4" />
          )}
          {chapter.language === "en" && (
            <GB className="inline-block select-none shrink-0 size-4" />
          )}
          <p className="font-semibold text-sm truncate px-0.5">{chapterLabel}</p>
        </Link>

        <div className="space-y-1">
          <div className="flex items-center space-x-1 min-w-0">
            <Users size={16} className="shrink-0" />
            {groups.length === 0 ? (
              <span className="text-xs font-normal truncate">No Group</span>
            ) : (
              <Button
                asChild
                variant="ghost"
                className="whitespace-normal! font-normal text-start text-xs rounded-sm h-auto py-0 px-0.5 hover:text-primary line-clamp-1 break-all shrink! min-w-0"
                size="sm"
              >
                <Link
                  href={`/group/${groups[0].id}/${generateSlug(groups[0].name ?? "")}`}
                  prefetch={false}
                  className="truncate"
                >
                  {groups[0].name}
                </Link>
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-1 min-w-0 justify-between">
            <time
              className="flex items-center gap-1 text-xs font-light"
              dateTime={chapter.updated_at}
            >
              <Clock size={16} className="shrink-0"/>
              <span className="px-0.5 line-clamp-1 break-all">
                {chapter.updated_at
                  ? formatTimeToNow(new Date(chapter.updated_at))
                  : ""}
              </span>
            </time>

            <MessagesSquare size={16} className="shrink-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
