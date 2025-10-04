import { ChapterTitle } from "@/components/Chapter/ChapterReader/chapter-info";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn, getCoverImageUrl } from "@/lib/utils";
import { Chapter } from "@/types/types";
import { GB, VN } from "country-flag-icons/react/3x2";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface HistoryCoverCardProps {
  chapter: Chapter;
}

export default function HistoryCoverCard({ chapter }: HistoryCoverCardProps) {
  const src = getCoverImageUrl(chapter.manga.id || "", chapter.manga.cover || "", "512");
  const [loaded, setLoaded] = useState(false);
  const title = ChapterTitle(chapter);
  return (
    <Card className="relative rounded-sm shadow-none transition-colors duration-200 w-full h-full border-none bg-background">
      <NoPrefetchLink href={`/manga/${chapter.manga.id}`}>
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
            alt={`Ảnh bìa ${chapter.manga.title}`}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              e.currentTarget.src = "/images/xidoco.webp";
            }}
          />
        </CardContent>
      </NoPrefetchLink>

      <CardFooter className="py-2 px-0 w-full flex flex-col gap-1 items-start">
        <NoPrefetchLink
          href={`/manga/${chapter.manga.id}`}
          className="font-bold line-clamp-2 break-all"
        >
          {chapter.manga.title}
        </NoPrefetchLink>
        <NoPrefetchLink
          href={`/chapter/${chapter.id}`}
          className="items-center flex gap-1"
        >
          {chapter.language === "vi" ? (
            <VN className="size-4 shrink-0" />
          ) : (
            <GB className="size-4 shrink-0" />
          )}
          <span className="font-bold text-sm line-clamp-1 break-all hover:underline">
            {title}
          </span>
        </NoPrefetchLink>
      </CardFooter>
    </Card>
  );
}
