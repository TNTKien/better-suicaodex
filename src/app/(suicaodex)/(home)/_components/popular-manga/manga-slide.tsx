"use client";

import { cn, generateSlug } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import { Streamdown } from "streamdown";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";
import MangaCover from "@/app/(suicaodex)/(manga)/manga/_components/manga-cover";
import {
  ContentRatingTag,
  NormalTag,
  StatusTag,
} from "@/app/(suicaodex)/(manga)/manga/_components/manga-tags";
import type { Cover, MangaListItem } from "@/lib/weebdex/model";

interface MangaSlideProps {
  manga: MangaListItem;
}

export default function MangaSlide({ manga }: MangaSlideProps) {
  const isMobile = useIsMobile();
  const { title } = parseMangaTitle(manga);
  const slug = generateSlug(title);

  const cover = manga.relationships?.cover;
  const coverExt = cover?.ext ?? ".webp";
  const coverUrl = cover?.id
    ? `${siteConfig.weebdex.proxyURL}/covers/${manga.id}/${cover.id}${coverExt}`
    : "/images/xidoco.webp";

  const authors = manga.relationships?.authors ?? [];
  const artists = manga.relationships?.artists ?? [];

  const creatorNames = [
    ...new Set([
      ...authors.map((a) => a.name ?? ""),
      ...artists.map((a) => a.name ?? ""),
    ]),
  ].filter(Boolean);

  return (
    <div
      className="relative bg-no-repeat bg-cover bg-position-[center_top_25%] h-[300px] md:h-[400px] lg:h-[420px]"
      style={{ backgroundImage: `url('${coverUrl}')` }}
    >
      <div className="relative z-1 flex gap-4 pt-28 h-full px-4 md:px-8 lg:px-12">
        <Link
          href={`/manga/${manga.id}/${slug}`}
          prefetch={false}
          className="z-10!"
        >
          <MangaCover
            manga_id={manga.id || ""}
            cover={manga.relationships?.cover as Cover}
            alt={title}
            placeholder="/images/place-doro.webp"
            className="shadow-md drop-shadow-md aspect-7/10 object-cover!"
            wrapper="w-[130px] md:w-[200px] lg:w-[215px] h-auto"
            preload={true}
            ext="512.webp"
          />
        </Link>

        <div
          className="grid gap-6 sm:gap-2 h-full min-h-0"
          style={{
            gridTemplateRows: isMobile
              ? "1fr auto"
              : "max-content min-content auto max-content",
          }}
        >
          <Link href={`/manga/${manga.id}/${slug}`}>
            <p className="drop-shadow-md font-black text-2xl line-clamp-5 sm:line-clamp-2 wrap-break-word lg:text-[42px] overflow-hidden lg:leading-12!">
              {title}
            </p>
          </Link>

          <div className="hidden md:flex flex-wrap gap-1">
            {manga.status && <StatusTag status={manga.status} isLink={true} />}
            {manga.content_rating && (
              <ContentRatingTag rating={manga.content_rating} isLink={true} />
            )}
            {manga.relationships &&
              manga.relationships.tags &&
              manga.relationships.tags.map((tag) => (
                <NormalTag key={tag.id} className="uppercase">
                  {tag.name}
                </NormalTag>
              ))}
          </div>

          <div className="hidden md:block min-h-0 relative overflow-auto">
            <div className="relative overflow-hidden">
              <Streamdown
                controls={{ table: false }}
                className="text-sm text-balance"
              >
                {manga.description ?? ""}
              </Streamdown>
            </div>
          </div>

          <p className=" flex-1 self-end text-base md:text-lg italic font-medium line-clamp-1 max-w-full md:max-w-[80%]">
            {creatorNames.join(", ")}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "absolute w-full inset-0 pointer-events-none z-0",
          "bg-linear-to-b from-background/25 to-background backdrop-blur-[0.5px]",
        )}
      />
    </div>
  );
}
