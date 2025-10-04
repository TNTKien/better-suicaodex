"use client";

import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import MangaCover from "@/components/Manga/manga-cover";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatTimeToNow, getCoverImageUrl } from "@/lib/utils";
import { Chapter, Manga } from "@/types/types";
import { GB, VN } from "country-flag-icons/react/3x2";
import {
  ChevronsDown,
  ChevronsUp,
  Clock,
  ExternalLink,
  MessageSquare,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface LatestMangaCardProps {
  manga: Partial<Pick<Manga, "id" | "cover" | "title">>;
  chapters: Chapter[];
  type?: "compact" | "cover";
}

export default function LatestMangaCard({
  manga,
  chapters,
  type = "compact",
}: LatestMangaCardProps) {
  const isMobile = useIsMobile();
  const maxCount = isMobile ? 2 : 3;
  const [expanded, setExpanded] = useState(false);
  const src = getCoverImageUrl(manga.id || "", manga.cover || "", "512");
  const [loaded, setLoaded] = useState(false);

  if (type === "cover") {
    return (
      <Card className="relative rounded-sm shadow-none transition-colors duration-200 w-full h-full border-none bg-background">
        <NoPrefetchLink href={`/manga/${manga.id}`}>
          <CardContent className="relative p-0 rounded-sm">
            <LazyLoadImage
              wrapperClassName={cn(
                "!block rounded-sm object-cover w-full h-full",
                !loaded && "aspect-[5/7]"
              )}
              placeholderSrc="/images/place-doro.webp"
              className={cn(
                "h-auto w-full rounded-sm block object-cover aspect-[5/7]"
              )}
              src={src}
              alt={`Ảnh bìa ${manga.title}`}
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                e.currentTarget.src = "/images/xidoco.webp";
              }}
            />
          </CardContent>
        </NoPrefetchLink>

        <CardFooter className="p-0 pt-1 w-full flex flex-col gap-0 items-start">
          <SingleCard key={chapters[0].id} chapter={chapters[0]} hideIcons />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="rounded-sm shadow-sm transition-colors duration-200">
      <CardHeader className="p-1 md:hidden">
        <NoPrefetchLink
          href={`/manga/${manga.id}`}
          className="line-clamp-1 font-bold text-lg break-all border-b"
        >
          {manga.title}
        </NoPrefetchLink>
      </CardHeader>
      <CardContent className="flex gap-1.5 p-1 md:p-1.5">
        <NoPrefetchLink href={`/manga/${manga.id}`}>
          <MangaCover
            id={manga.id || ""}
            cover={manga.cover || ""}
            alt={manga.title || ""}
            placeholder="/images/place-doro.webp"
            wrapper="w-20 md:w-[140px] h-auto border"
            className="!w-20 !h-28 md:!w-[140px] md:!h-[200px] !object-cover"
            quality="256"
            // quality={isMobile ? "256" : "512"}
          />
        </NoPrefetchLink>
        <div className="flex flex-col w-full">
          <NoPrefetchLink
            href={`/manga/${manga.id}`}
            className="hidden md:flex line-clamp-1 font-bold text-lg break-all border-b md:pb-1 px-1.5"
          >
            {manga.title}
          </NoPrefetchLink>

          <div className="flex flex-col overflow-hidden">
            {chapters.slice(0, maxCount).map((chapter) => (
              <SingleCard key={chapter.id} chapter={chapter} />
            ))}
            <div
              className={cn(
                "flex flex-col transition-all duration-300 ease-in-out",
                expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              {chapters.slice(maxCount).map((chapter) => (
                <SingleCard key={chapter.id} chapter={chapter} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      {chapters.length > maxCount && (
        <CardFooter className="w-full pt-0 pb-1.5 justify-center">
          <Button
            size="sm"
            className="h-4 px-1 bg-transparent shadow-none hover:bg-transparent text-primary"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? (
              <>
                <ChevronsUp />
                thu gọn
                <ChevronsUp />
              </>
            ) : (
              <>
                <ChevronsDown />
                xem thêm
                <ChevronsDown />
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
interface SingleCardProps {
  chapter: Chapter;
  hideIcons?: boolean;
}

const SingleCard = ({ chapter, hideIcons = false }: SingleCardProps) => {
  const router = useRouter();
  return (
    <NoPrefetchLink
      key={chapter.id}
      suppressHydrationWarning
      href={
        chapter.externalUrl ? chapter.externalUrl : `/chapter/${chapter.id}`
      }
      target={chapter.externalUrl ? "_blank" : "_self"}
      className="w-full"
    >
      <Card className="w-full flex flex-col justify-between rounded-[0.125rem] px-1.5 py-1.5 shadow-none relative min-h-14 hover:bg-accent border-none">
        <div className="flex justify-between">
          <div className="flex items-center space-x-1">
            {chapter.language === "vi" && <VN className="size-4 shrink-0" />}

            {chapter.language === "en" && <GB className="size-4 shrink-0" />}
            {chapter.externalUrl && <ExternalLink size={16} />}
            <p className="font-semibold text-sm md:text-base line-clamp-1">
              {chapter.chapter
                ? `Ch. ${chapter.chapter}
              ${chapter.title ? ` - ${chapter.title}` : ""}`
                : "Oneshot"}
            </p>
          </div>

          {!hideIcons && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-sm gap-0.5 h-6 px-1"
            >
              <MessageSquare />
            </Button>
          )}
        </div>
        <div className="flex justify-between">
          <div className="flex items-center justify-self-start">
            <Users size={16} className="shrink-0" />
            {chapter.group.length === 0 ? (
              <span className="line-clamp-1 font-normal text-xs px-[0.25rem]">
                No Group
              </span>
            ) : (
              <div className="flex items-center space-x-1">
                {chapter.group.map((group) => (
                  <Button
                    key={group.id}
                    variant="ghost"
                    className="whitespace-normal font-normal text-start line-clamp-1 rounded-sm h-4 py-0 px-[0.25rem] hover:underline hover:text-primary break-all"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/group/${group.id}`);
                    }}
                  >
                    {group.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1 w-full max-w-max justify-end pr-1">
            <time
              className="text-xs font-light line-clamp-1 break-all"
              dateTime={new Date(chapter.updatedAt).toDateString()}
            >
              {formatTimeToNow(new Date(chapter.updatedAt))}
            </time>
            {!hideIcons && <Clock size={16} className="shrink-0" />}
          </div>
        </div>
      </Card>
    </NoPrefetchLink>
  );
};
