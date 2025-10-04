"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn, getCoverImageUrl } from "@/lib/utils";
import { Manga } from "@/types/types";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface RecentlyCardProps {
  manga: Manga;
}

export default function RecentlyCard({ manga }: RecentlyCardProps) {
  const src = getCoverImageUrl(manga.id, manga.cover, "512");
  const [loaded, setLoaded] = useState(false);

  return (
    <Card className="relative rounded-sm shadow-md transition-colors duration-200 w-full h-full border-none">
      <CardContent className="p-0">
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

      <CardFooter className="absolute bottom-0 p-2 bg-gradient-to-t from-black w-full rounded-b-sm dark:rounded-b-none h-[40%] max-h-full items-end">
        <p className="text-base font-semibold line-clamp-2 hover:line-clamp-none text-white drop-shadow-sm">
          {manga.title}
        </p>
      </CardFooter>
    </Card>
  );
}
