"use client";

import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type {
  ChapterHistoryEntry,
  MangaMeta,
} from "@/hooks/use-reading-history-v2";
import { formatTimeToNow, generateSlug } from "@/lib/utils";
import { GB, VN } from "country-flag-icons/react/3x2";
import { BookOpen, Trash2, Users } from "lucide-react";
import Image from "next/image";

const MAX_CHAPTERS_SHOWN = 3;

function FlagIcon({ language }: { language: string | null }) {
  if (language === "vi") return <VN className="size-4 shrink-0" />;
  return <GB className="size-4 shrink-0" />;
}

function chapterLabel(entry: ChapterHistoryEntry): string {
  const num = entry.chapter != null ? `Ch. ${entry.chapter}` : "Oneshot";
  return entry.title ? `${num} - ${entry.title}` : num;
}

interface HistoryMangaCardProps {
  mangaId: string;
  chapters: ChapterHistoryEntry[];
  meta: MangaMeta;
  onRemove: (mangaId: string) => void;
}

export default function HistoryMangaCard({
  mangaId,
  chapters,
  meta,
  onRemove,
}: HistoryMangaCardProps) {
  const { title, coverId } = meta;
  const coverUrl = coverId
    ? `${siteConfig.weebdex.proxyURL}/covers/${mangaId}/${coverId}.256.webp`
    : "/images/place-doro.webp";

  const slug = generateSlug(title);
  const mangaHref = `/manga/${mangaId}/${slug}`;

  const shown = chapters.slice(0, MAX_CHAPTERS_SHOWN);

  return (
    <div className="flex gap-2 rounded-sm border p-2 transition-colors">
      {/* Cover */}
      <NoPrefetchLink href={mangaHref} className="shrink-0">
        <Image
          src={coverUrl}
          alt={title}
          width={80}
          height={112}
          className="w-20 aspect-5/7 object-cover rounded-sm border"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/images/xidoco.webp";
          }}
          unoptimized
        />
      </NoPrefetchLink>

      {/* Right column */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Manga title + remove button */}
        <div className="flex items-center justify-between gap-1">
          <NoPrefetchLink
            href={mangaHref}
            className="text-lg font-semibold leading-snug line-clamp-1 hover:text-primary transition-colors"
          >
            {title}
          </NoPrefetchLink>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 size-5"
            onClick={() => onRemove(mangaId)}
            aria-label="Xóa lịch sử"
          >
            <Trash2 />
          </Button>
        </div>

        {/* Chapter rows */}
        <div className="flex flex-col gap-1">
          {shown.map((entry) => (
            <NoPrefetchLink
              key={entry.chapterId}
              href={`/chapter/${entry.chapterId}`}
              className="group flex flex-col gap-0.5 rounded-sm px-1.5 py-1 hover:bg-secondary transition-colors"
            >
              {/* Row 1: flag + chapter label */}
              <div className="flex items-center gap-1.5 min-w-0">
                <FlagIcon language={entry.language} />
                <span className="text-base font-medium line-clamp-1 group-hover:text-primary transition-colors">
                  {chapterLabel(entry)}
                </span>
              </div>

              {/* Row 2: time + group */}
              <div className="flex items-center gap-2 text-sm font-light text-muted-foreground">
                <BookOpen className="shrink-0 size-4" />
                <span className="line-clamp-1 break-all">
                  {formatTimeToNow(new Date(entry.readAt))}
                </span>
                {entry.groups.length > 0 && (
                  <>
                    <span className="shrink-0">·</span>
                    <Users className="shrink-0 size-4" />
                    <span className="line-clamp-1 break-all">
                      {entry.groups.map((g) => g.name).join(", ")}
                    </span>
                  </>
                )}
              </div>
            </NoPrefetchLink>
          ))}
        </div>
      </div>
    </div>
  );
}
