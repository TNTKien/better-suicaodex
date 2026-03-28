"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { GetV1Manga200DataItem } from "@/lib/moetruyen/model/getV1Manga200DataItem";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import { MoeStatusTag } from "@/app/(moetruyen)/moetruyen/(moe_home)/manga/_components/moe-manga-tags";

interface CompactCardMoetruyenProps {
  manga: GetV1Manga200DataItem;
}

export default function CompactCardMoetruyen({
  manga,
}: CompactCardMoetruyenProps) {
  const coverUrl = manga.coverUrl ?? "/images/no-cover.webp";

  return (
    <Card className="rounded-md shadow-xs transition-colors duration-200 hover:bg-accent">
      <CardContent className="flex gap-3 p-3">
        <LazyLoadImage
          wrapperClassName="block! shrink-0"
          src={coverUrl}
          alt={manga.title}
          placeholderSrc="/images/place-doro.webp"
          className="w-16! h-auto! aspect-5/7 object-cover! rounded-sm border"
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
          }}
        />

        <div className="flex min-w-0 w-full flex-col gap-1.5">
          <p className="line-clamp-2 text-lg font-semibold leading-tight">
            {manga.title}
          </p>

          <MoeStatusTag status={manga.status} />

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
