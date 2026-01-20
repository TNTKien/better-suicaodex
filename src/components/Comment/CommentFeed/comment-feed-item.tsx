// "use client";
import { Card } from "@/components/ui/card";
import { CommentWithUser } from "@/lib/suicaodex/serializers";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatShortTime } from "@/lib/utils";
import { getStickerByName } from "@/lib/stickers-fn";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/blur.css";

interface CommentFeedItemProps {
  comment: CommentWithUser & {
    mangaId?: string;
    chapterId?: string;
    chapterNumber?: number;
  };
  type: "manga" | "chapter";
}

// Check if content is HTML (old format from richtext editor)
const isHTML = (str: string): boolean => {
  return /<[a-z][\s\S]*>/i.test(str);
};

// Parse comment content to separate text and stickers
const parseCommentContent = (content: string) => {
  // If it's HTML (old format), return as is without parsing stickers
  if (isHTML(content)) {
    return { text: content, stickers: [], isLegacyHTML: true };
  }

  const regex = /:([a-zA-Z0-9-]+):/g;
  const stickers: { name: string; url: string }[] = [];
  const foundPatterns: string[] = [];
  let textContent = content;
  let match;

  // Extract all stickers and track which patterns are valid
  while ((match = regex.exec(content)) !== null) {
    const stickerName = match[1];
    const sticker = getStickerByName(stickerName);

    if (sticker) {
      stickers.push({ name: stickerName, url: sticker.url });
      foundPatterns.push(match[0]); // Save the full pattern like ":doro-think:"
    }
  }

  // Remove only valid sticker patterns from text
  foundPatterns.forEach((pattern) => {
    textContent = textContent.replace(pattern, "");
  });
  textContent = textContent.trim();

  return { text: textContent, stickers, isLegacyHTML: false };
};

export default function CommentFeedItem({
  comment,
  type,
}: CommentFeedItemProps) {
  const commentLink =
    type === "manga"
      ? `/manga/${comment.mangaId}`
      : `/chapter/${comment.chapterId}`;

  const { text, stickers, isLegacyHTML } = parseCommentContent(comment.content);

  return (
    <Card className="rounded-sm p-3 h-full bg-transparent shadow-none border-none">
      <NoPrefetchLink
        href={commentLink}
        className="font-bold line-clamp-1 break-all border-b pb-2 block hover:text-primary"
      >
        {!!comment.chapterNumber && <span>{comment.chapterNumber} - </span>}
        <span>{comment.title}</span>
      </NoPrefetchLink>

      <div className="flex gap-2 mt-2">
        <Avatar className="h-10 w-10 relative z-10 shrink-0">
          <AvatarImage
            src={comment.user.image || ""}
            alt={comment.user.name || "User"}
          />
          <AvatarFallback>
            {comment.user.name ? comment.user.name.slice(0, 2) : "SC"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm line-clamp-1 hover:underline">
              {comment.user.name}
            </span>
          </div>
          {text && (
            <div className="bg-muted rounded-2xl px-3 py-2 mt-1 inline-block max-w-full">
              <ReactMarkdown
                className="prose prose-sm prose-img:my-1 prose-img:max-w-[120px] dark:prose-invert max-w-full"
                remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
                rehypePlugins={
                  isLegacyHTML ? [rehypeRaw, [rehypeSanitize]] : undefined
                }
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
                  p: ({ children }) => (
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {children}
                    </p>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          )}
          {stickers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 max-w-full">
              {stickers.map((sticker, index) => (
                <LazyLoadImage
                  key={`${sticker.name}-${index}`}
                  src={sticker.url}
                  alt={sticker.name}
                  className="rounded-md w-full max-w-[80px] sm:max-w-[100px] h-auto object-contain aspect-square"
                  effect="blur"
                />
              ))}
            </div>
          )}

          <span className="mt-1 text-xs text-muted-foreground line-clamp-1 block">
            {formatShortTime(new Date(comment.createdAt))}
            {comment.isEdited ? " (Đã chỉnh sửa)" : ""}
          </span>
        </div>
      </div>
    </Card>
  );
}
