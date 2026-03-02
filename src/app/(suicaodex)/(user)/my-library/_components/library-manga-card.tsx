"use client";

import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type { MangaLibraryMeta } from "@/hooks/use-local-library-v2";
import { generateSlug } from "@/lib/utils";
import { X } from "lucide-react";
import { LazyLoadImage } from "react-lazy-load-image-component";

interface LibraryMangaCardProps {
  mangaId: string;
  meta: MangaLibraryMeta;
  onRemove: (mangaId: string) => void;
}

export default function LibraryMangaCard({
  mangaId,
  meta,
  onRemove,
}: LibraryMangaCardProps) {
  const { title, coverId } = meta;
  const coverUrl = coverId
    ? `${siteConfig.weebdex.proxyURL}/covers/${mangaId}/${coverId}.512.webp`
    : "/images/no-cover.webp";
  const slug = generateSlug(title);

  return (
    <div className="relative group rounded-sm overflow-hidden shadow-md">
      <NoPrefetchLink href={`/manga/${mangaId}/${slug}`}>
        <div className="relative">
          <LazyLoadImage
            wrapperClassName="block! w-full aspect-5/7"
            placeholderSrc="/images/place-doro.webp"
            className="w-full h-auto aspect-5/7 object-cover rounded-sm"
            src={coverUrl}
            alt={`Ảnh bìa ${title}`}
            onError={(e) => {
              e.currentTarget.src = "/images/xidoco.webp";
            }}
          />
          {/* Gradient title overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-linear-to-t from-black rounded-b-sm flex items-end p-2">
            <p className="text-base font-semibold line-clamp-2 text-white drop-shadow-xs">
              {title}
            </p>
          </div>
        </div>
      </NoPrefetchLink>

      {/* Remove button */}
      <Button
        variant="destructive"
        size="icon-sm"
        className="absolute top-1 right-1 size-6"
        onClick={(e) => {
          e.preventDefault();
          onRemove(mangaId);
        }}
        aria-label="Xóa khỏi thư viện"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
