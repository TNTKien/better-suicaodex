// "use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { CommentWithUser } from "@/lib/suicaodex/serializers";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTimeToNow } from "@/lib/utils";
import { Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommentFeedItemProps {
  comment: CommentWithUser & {
    mangaId?: string;
    chapterId?: string;
    chapterNumber?: number;
  };
  type: "manga" | "chapter";
}

export default function CommentFeedItem({
  comment,
  type,
}: CommentFeedItemProps) {
  const commentLink =
    type === "manga"
      ? `/manga/${comment.mangaId}`
      : `/chapter/${comment.chapterId}`;

  return (
    <Card className="rounded-sm flex flex-col gap-1 px-3 py-0 h-full dark:bg-sidebar">
      <NoPrefetchLink
        href={commentLink}
        className="font-bold line-clamp-1 break-all border-b py-1"
      >
        {!!comment.chapterNumber && <span>{comment.chapterNumber} - </span>}
        <span>{comment.title}</span>
      </NoPrefetchLink>

      <ScrollArea className="h-20">
        <ReactMarkdown
          className="prose prose-img:my-1 prose-img:!max-w-[150px] flex-1 flex-col gap-2 dark:prose-invert text-sm"
          remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize]]}
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
              <thead className="border-b border-secondary">{children}</thead>
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
          {comment.content}
        </ReactMarkdown>
      </ScrollArea>

      <div className="flex items-center justify-between pb-1.5 pt-1">
        <div className="flex items-center gap-2">
          <Avatar className="size-5 rounded-full">
            <AvatarImage src={comment.user.image || ""} />
            <AvatarFallback>
              {comment.user.name ? comment.user.name.slice(0, 2) : "SC"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm line-clamp-1 break-all font-medium">
            {comment.user.name}
          </span>
        </div>

        <div className="flex items-center space-x-1 w-full max-w-max justify-end">
          <time
            className="text-xs font-light line-clamp-1"
            dateTime={new Date(comment.createdAt).toDateString()}
          >
            {formatTimeToNow(new Date(comment.createdAt))}
          </time>
          <Clock size={14} className="shrink-0 hidden sm:block" />
        </div>
      </div>
    </Card>
  );
}
