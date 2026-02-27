"use client";

import { cn, generateSlug } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Manga } from "@/lib/weebdex/model";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";
import MangaCover from "@/app/weebdex/manga/_components/manga-cover";
import { ContentRatingTag, NormalTag, StatusTag } from "@/app/weebdex/manga/_components/manga-tags";

interface MangaSlideProps {
  manga: Manga;
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
    <>
      {/* Banner */}
      <div className="absolute h-[324px] md:h-[400px] z-[-2] w-auto left-0 right-0 top-0 block">
        <div
          className={cn(
            "absolute h-[324px] md:h-[400px] w-full",
            "bg-no-repeat bg-cover bg-position-[center_top_25%]",
          )}
          style={{ backgroundImage: `url('${coverUrl}')` }}
        />

        <div
          className={cn(
            "absolute h-[324px] md:h-[400px] w-auto inset-0 pointer-events-none",
            "bg-linear-to-b from-background/25 to-background backdrop-blur-[0.5px]",
          )}
        />
      </div>

      {/* Manga */}
      <div
        className={cn(
          "flex gap-4 h-full pt-28 px-4 md:pl-8 lg:pl-12",
          "md:pr-[calc(32px+var(--sidebar-width-icon))] lg:pr-[calc(48px+var(--sidebar-width-icon))]",
        )}
      >
        <Link href={`/weebdex/manga/${manga.id}/${slug}`} prefetch={false}>
          <MangaCover
            manga_id={manga.id || ""}
            cover={manga.relationships?.cover}
            alt={title}
            placeholder="/images/place-doro.webp"
            className="shadow-md drop-shadow-md aspect-7/10 object-cover!"
            wrapper="w-[130px] md:w-[200px] lg:w-[215px] h-auto"
            preload={true}
            ext="512.webp"
          />
        </Link>

        <div
          className="grid gap-6 sm:gap-2 h-full min-h-0 pb-8 md:pb-1.5 lg:pb-1"
          style={{
            gridTemplateRows: isMobile
              ? "1fr auto"
              : "max-content min-content auto max-content",
          }}
        >
          <Link href={`/weebdex/manga/${manga.id}/${slug}`}>
            <p className="drop-shadow-md font-black text-xl line-clamp-5 sm:line-clamp-2 lg:text-4xl overflow-hidden lg:leading-11!">
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
              <ReactMarkdown
                className="text-sm"
                remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <table className="table-auto border-collapse border border-secondary rounded-md w-fit">
                      {children}
                    </table>
                  ),
                  thead: ({ children }) => (
                    <thead className="border-b border-secondary">
                      {children}
                    </thead>
                  ),
                  tr: ({ children }) => (
                    <tr className="even:bg-secondary">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-2 py-1 text-left">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1">{children}</td>
                  ),
                }}
              >
                {manga.description ?? ""}
              </ReactMarkdown>
            </div>
          </div>

          <p className="self-end text-base md:text-lg italic font-medium line-clamp-1 max-w-full md:max-w-[80%]">
            {creatorNames.join(", ")}
          </p>
        </div>
      </div>
    </>
  );
}
