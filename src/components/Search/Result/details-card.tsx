import MangaCover from "@/components/Manga/manga-cover";
import ContentRatingChip from "@/components/Manga/Tags/content-rating-tag";
import NormalTag from "@/components/Manga/Tags/normal-tag";
import StatusChip from "@/components/Manga/Tags/status-tag";
import { Card, CardContent } from "@/components/ui/card";
import { Manga } from "@/types/types";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { generateSlug } from "@/lib/utils";

interface DetailsCardProps {
  manga: Manga;
}

export default function DetailsCard({ manga }: DetailsCardProps) {
  const slug = generateSlug(manga.title);
  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200 w-full">
      <CardContent className="flex gap-2 p-1">
        <NoPrefetchLink href={`/manga/${manga.id}/${slug}`}>
          <MangaCover
            id={manga.id}
            cover={manga.cover}
            alt={manga.title}
            placeholder="/images/place-doro.webp"
            wrapper="w-20 h-auto border"
            className="w-20! h-28! object-cover!"
            quality="256"
            //isExpandable
          />
        </NoPrefetchLink>
        <div className="flex flex-col gap-1 w-full pr-2">
          <div className="flex items-center justify-between">
            <NoPrefetchLink
              href={`/manga/${manga.id}/${slug}`}
              className="line-clamp-1 font-bold text-xl break-all"
            >
              {manga.title}
            </NoPrefetchLink>
            <StatusChip status={manga.status} />
          </div>
          <div className="flex flex-wrap items-center gap-1 max-h-4 overflow-y-hidden">
            <ContentRatingChip rating={manga.contentRating} disabledLink />
            {manga.tags.map((tag) => (
              <NormalTag key={tag.id} className="uppercase">
                {tag.name}
              </NormalTag>
            ))}
          </div>
          <div
            style={{
              maskImage:
                "linear-gradient(black 0%, black 60%, transparent 100%)",
            }}
          >
            <ReactMarkdown
              className="flex flex-col gap-0 text-sm max-h-[60px] overflow-y-hidden break-all"
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
