"use client";

import { cn, getCoverImageUrl } from "@/lib/utils";
import { Artist, Author, Manga } from "@/types/types";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import Tags from "@/components/Manga/Tags";
import MangaCover from "@/components/Manga/manga-cover";
import { useIsMobile } from "@/hooks/use-mobile";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";

interface MangaSlideProps {
  manga: Manga;
}

export default function MangaSlide({ manga }: MangaSlideProps) {
  const isMobile = useIsMobile();
  const bannerSrc = getCoverImageUrl(manga.id, manga.cover, "full");

  return (
    <>
      {/* Banner */}
      <div className="absolute h-[324px] md:h-[400px] z-[-2] w-auto left-0 right-0 top-0 block">
        <div
          className={cn(
            "absolute h-[324px] md:h-[400px] w-full",
            "bg-no-repeat bg-cover bg-center-25"
          )}
          style={{ backgroundImage: `url('${bannerSrc}')` }}
        ></div>

        <div
          className={cn(
            "absolute h-[324px] md:h-[400px] w-auto inset-0 pointer-events-none"
            //"backdrop-blur-[1px]"
          )}
          style={{
            background:
              "linear-gradient(to bottom, hsl(var(--background) / .25) 0%, hsl(var(--background)) 100%)",
          }}
        ></div>
      </div>

      {/* Manga */}

      <div
        className={cn(
          "flex gap-4 h-full pt-28 px-4 md:pl-8 lg:pl-12",
          "md:pr-[calc(32px+var(--sidebar-width-icon))] lg:pr-[calc(48px+var(--sidebar-width-icon))]"
        )}
      >
        <NoPrefetchLink href={`/manga/${manga.id}`}>
          <MangaCover
            id={manga.id}
            cover={manga.cover}
            alt={manga.title}
            placeholder="/images/place-doro.webp"
            className="shadow-md drop-shadow-md aspect-[7/10] !object-cover"
            wrapper="w-[130px] md:w-[200px] lg:w-[215px] h-auto"
            preload={true}
          />
        </NoPrefetchLink>

        <div
          className="grid gap-6 sm:gap-2 h-full min-h-0 pb-8 md:pb-1.5 lg:pb-1"
          style={{
            gridTemplateRows: isMobile
              ? "1fr auto"
              : "max-content min-content auto max-content",
          }}
        >
          <NoPrefetchLink href={`/manga/${manga.id}`}>
            <p className="drop-shadow-md font-black text-xl line-clamp-5 sm:line-clamp-2 lg:text-4xl overflow-hidden lg:!leading-[2.75rem]">
              {manga.title}
            </p>
          </NoPrefetchLink>

          <div className="hidden md:flex flex-wrap gap-1">
            <Tags
              tags={manga.tags}
              contentRating={manga.contentRating}
              status={manga.status}
            />
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
                {manga.description.content}
              </ReactMarkdown>
            </div>
          </div>

          <p className="self-end text-base md:text-lg italic font-medium line-clamp-1 max-w-full md:max-w-[80%]">
            {[
              ...new Set([
                ...manga.author.map((a: Author) => a.name),
                ...manga.artist.map((a: Artist) => a.name),
              ]),
            ].join(", ")}
          </p>
        </div>
      </div>
    </>
  );
}
