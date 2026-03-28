"use client";

import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { Manga } from "@/lib/weebdex/model";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { StatusTag } from "@/app/(suicaodex)/(manga)/manga/_components/manga-tags";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";

interface CompactCardWeebdexProps {
  manga: Manga;
}

export default function CompactCardWeebdex({ manga }: CompactCardWeebdexProps) {
  const { title } = parseMangaTitle(manga);
  const cover = manga.relationships?.cover;
  const coverUrl = cover
    ? `${siteConfig.weebdex.proxyURL}/covers/${manga.id}/${cover.id}.256.webp`
    : "/images/no-cover.webp";

  return (
    <Card className="rounded-md shadow-xs transition-colors duration-200 hover:bg-accent">
      <CardContent className="flex gap-3 p-3">
        <LazyLoadImage
          wrapperClassName="block! shrink-0"
          src={coverUrl}
          alt={title}
          placeholderSrc="/images/place-doro.webp"
          className="w-16! h-auto! aspect-5/7 object-cover! rounded-sm border"
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
          }}
        />
        <div className="flex min-w-0 w-full flex-col gap-1.5">
          <p className="line-clamp-2 text-lg font-semibold leading-tight">
            {title}
          </p>

          {!!manga.status && <StatusTag status={manga.status} />}

          {!!manga.description && (
            <ScrollArea className="max-h-16">
              <Streamdown className="text-xs" controls={{ table: false }}>
                {manga.description}
              </Streamdown>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
