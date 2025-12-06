import MangaCover from "@/components/Manga/manga-cover";
import ContentRatingChip from "@/components/Manga/Tags/content-rating-tag";
import NormalTag from "@/components/Manga/Tags/normal-tag";
import StatusChip from "@/components/Manga/Tags/status-tag";
import { Card, CardContent } from "@/components/ui/card";
import { Artist, Author, Manga } from "@/types/types";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { generateSlug } from "@/lib/utils";

interface SemiCardProps {
  manga: Manga;
}

export default function SemiCard({ manga }: SemiCardProps) {
  const slug = generateSlug(manga.title);
  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200">
      <CardContent className="flex gap-2 p-1">
        <NoPrefetchLink href={`/manga/${manga.id}/${slug}`}>
          <MangaCover
            id={manga.id}
            cover={manga.cover}
            alt={manga.title}
            placeholder="/images/place-doro.webp"
            wrapper="w-[130px] md:w-[150px] h-auto border"
            className="w-[130px]! md:w-[150px]! h-[185px]! md:h-[214px]! object-cover!"
            // wrapper="w-[130px] md:w-[150px] h-auto border"
            quality="256"
            //isExpandable
          />
        </NoPrefetchLink>
        <div className="flex flex-col gap-1 w-full pr-2">
          <NoPrefetchLink
            href={`/manga/${manga.id}/${slug}`}
            className="line-clamp-1 font-bold text-xl break-all"
          >
            {manga.title}
          </NoPrefetchLink>
          <p className="text-sm line-clamp-1 break-all -mt-2">
            {[
              ...new Set([
                ...manga.author.map((a: Author) => a.name).slice(0, 1),
                ...manga.artist.map((a: Artist) => a.name).slice(0, 1),
              ]),
            ].join(", ")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1 max-h-4 overflow-y-hidden">
            <StatusChip status={manga.status} />
            <ContentRatingChip rating={manga.contentRating} disabledLink/>
            {manga.tags.map((tag) => (
              <NormalTag key={tag.id} className="uppercase">
                {tag.name}
              </NormalTag>
            ))}
          </div>
          <ScrollArea className="mt-1 max-h-[109px] md:max-h-[141px]">
            <ReactMarkdown
              className="flex flex-col gap-0 text-sm"
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
                td: ({ children }) => <td className="px-2 py-1">{children}</td>,
              }}
            >
              {manga.description.content}
            </ReactMarkdown>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
