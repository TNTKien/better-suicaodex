"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { Cover } from "@/lib/weebdex/model";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface MangaCardProps {
  manga_id: string;
  title: string;
  cover: Cover;
  className?: string;
}

export default function MangaCard({
  manga_id,
  title,
  cover,
  className,
}: MangaCardProps) {
  const cover_url = `${siteConfig.weebdex.proxyURL}/covers/${manga_id}/${cover.id}.512.webp`;

  const [loaded, setLoaded] = useState(false);

  return (
    <Card
      className={cn(
        "relative rounded-sm shadow-md transition-colors duration-200 w-full h-full border-none",
        className,
      )}
    >
      <CardContent className="p-0">
        <LazyLoadImage
          wrapperClassName={cn(
            "block! rounded-sm object-cover w-full h-full",
            !loaded && "aspect-5/7",
          )}
          placeholderSrc="/images/place-doro.webp"
          className={cn(
            "h-auto w-full rounded-sm block object-cover aspect-5/7",
          )}
          src={cover_url}
          alt={`Ảnh bìa ${title}`}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
          }}
        />
      </CardContent>

      <CardFooter className="absolute bottom-0 p-2 bg-linear-to-t from-black w-full rounded-b-sm dark:rounded-b-none h-[40%] max-h-full items-end">
        <p className="text-base font-semibold line-clamp-2 hover:line-clamp-none text-white drop-shadow-xs">
          {title}
        </p>
      </CardFooter>
    </Card>
  );
}
