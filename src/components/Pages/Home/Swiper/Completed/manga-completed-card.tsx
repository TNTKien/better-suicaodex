"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn, generateSlug, getCoverImageUrl } from "@/lib/utils";
import { Manga } from "@/types/types";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { Streamdown } from "streamdown";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";

interface MangaCompletedCardProps {
  manga: Manga;
}

export default function MangaCompletedCard({ manga }: MangaCompletedCardProps) {
  const src = getCoverImageUrl(manga.id, manga.cover, "512");
  const [loaded, setLoaded] = useState(false);
  return (
    <Card className="relative rounded-sm shadow-none transition-colors duration-200 w-full h-full border-none bg-background">
      <CardContent className="relative p-0 rounded-sm">
        <div className="z-10 flex rounded-sm opacity-0 hover:opacity-100 transition-opacity absolute inset-0 bg-black/75">
          <div className="p-2.5 grid grid-cols-1 gap-2 justify-between">
            <Streamdown
              controls={{ table: false }}
              className="text-sm text-white overflow-auto"
            >
              {manga.description.content}
            </Streamdown>

            <Button
              asChild
              className="self-end [&_svg]:size-6"
              size="icon"
              variant="secondary"
            >
              <NoPrefetchLink
                href={`/manga/${manga.id}/${generateSlug(manga.title)}`}
              >
                <ArrowRight />
              </NoPrefetchLink>
            </Button>
          </div>
        </div>
        <LazyLoadImage
          wrapperClassName={cn(
            "block! rounded-sm object-cover w-full h-full",
            !loaded && "aspect-5/7",
          )}
          placeholderSrc="/images/place-doro.webp"
          className={cn(
            "h-auto w-full rounded-sm block object-cover aspect-5/7",
          )}
          src={src}
          alt={`Ảnh bìa ${manga.title}`}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
          }}
        />
      </CardContent>

      <CardFooter className="py-2 px-0 w-full">
        <NoPrefetchLink
          href={`/manga/${manga.id}/${generateSlug(manga.title)}`}
        >
          <p className="text-base font-semibold line-clamp-2 drop-shadow-xs">
            {manga.title}
          </p>
        </NoPrefetchLink>
      </CardFooter>
    </Card>
  );
}
