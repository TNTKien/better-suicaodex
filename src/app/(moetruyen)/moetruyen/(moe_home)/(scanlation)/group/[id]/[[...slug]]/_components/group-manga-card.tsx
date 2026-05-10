"use client";

import Link from "next/link";
import { LazyLoadImage } from "react-lazy-load-image-component";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getMoetruyenThumbnailCoverUrl } from "@/lib/moetruyen/cover-url";
import type { GetV2TeamsByIdManga200DataItem } from "@/lib/moetruyen/model/getV2TeamsByIdManga200DataItem";
import { cn } from "@/lib/utils";

interface GroupMangaCardProps {
  manga: GetV2TeamsByIdManga200DataItem;
}

export default function GroupMangaCard({ manga }: GroupMangaCardProps) {
  const coverUrl = getMoetruyenThumbnailCoverUrl(
    manga.coverUrl ?? "/images/no-cover.webp",
  );
  const mangaHref = `/moetruyen/manga/${manga.id}/${manga.slug}`;

  return (
    <Link href={mangaHref} prefetch={false}>
      <Card className="relative rounded-sm shadow-none transition-colors duration-200 w-full h-full border-none">
        <CardContent className="p-0">
          <LazyLoadImage
            wrapperClassName="block! rounded-sm object-cover w-full h-full aspect-5/7"
            placeholderSrc="/images/place-doro.webp"
            className={cn(
              "h-auto w-full rounded-sm block object-cover aspect-5/7",
            )}
            src={coverUrl}
            alt={`Ảnh bìa ${manga.title}`}
            onError={(e) => {
              e.currentTarget.src = "/images/xidoco.webp";
            }}
          />
        </CardContent>

        <CardFooter className="absolute bottom-0 p-2 bg-linear-to-t from-background w-full rounded-b-none h-[40%] max-h-full items-end">
          <p className="text-lg font-semibold line-clamp-2 hover:line-clamp-4 drop-shadow-xs leading-tight">
            {manga.title}
          </p>
        </CardFooter>
      </Card>
    </Link>
  );
}
