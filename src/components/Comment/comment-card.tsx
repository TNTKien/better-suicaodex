"use client";

import { CommentWithUser } from "@/lib/suicaodex/serializers";
import { Card } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { PencilLine, Reply, ThumbsUp } from "lucide-react";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CommentCardProps {
  comment: CommentWithUser;
}


export default function CommentCard({ comment }: CommentCardProps) {
  const { data: session } = useSession();
  const handleBtnClick = () => {
    return toast.info("Chức năng đang phát triển!", {
      closeButton: false,
    });
  };

  return (
    <Card className="flex flex-col md:flex-row gap-3 p-3 rounded-md">
      <div className="flex flex-row md:flex-col items-center md:justify-center p-2 bg-secondary border rounded-sm md:max-w-[114px] max-h-fit">
        <Avatar className="size-12 md:size-24 rounded-sm">
          <AvatarImage src={comment.user.image || ""} />
          <AvatarFallback>
            {comment.user.name ? comment.user.name.slice(0, 2) : "SC"}
          </AvatarFallback>
        </Avatar>

        <div className="pl-2 md:pl-0">
          <p className="font-semibold line-clamp-1 break-all md:text-center">
            {comment.user.name}
          </p>
          <div className="flex md:flex-col gap-1 md:gap-0 items-center md:justify-center text-xs text-muted-foreground">
            <p>Gia nhập:</p>
            <p className="line-clamp-1 break-all">
              {new Date(comment.user.createdAt).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full">
        <span className="text-sm text-muted-foreground border-b pb-1">
          {(() => {
            const date = new Date(comment.updatedAt);
            const dateStr = date.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeStr = date.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });
            return `${dateStr}, ${timeStr}`;
          })()}

          {comment.isEdited ? " (Đã chỉnh sửa)" : ""}
        </span>

        {/* <p className="flex-1 pt-1">{comment.content}</p> */}
        <ReactMarkdown
          className="prose prose-img:my-1 prose-img:!max-w-[150px]  flex-1 flex-col gap-2 pt-1 dark:prose-invert max-w-full"
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

        {!!session?.user?.id && (
          <div
            className={cn(
              "flex flex-row items-center mt-2",
              session?.user?.id === comment.user.id
                ? "justify-between"
                : "justify-end"
            )}
          >
            {session?.user?.id === comment.user.id && (
              <Button
                variant="link"
                className="h-6 px-0 gap-1"
                onClick={handleBtnClick}
              >
                <PencilLine />
                Sửa
              </Button>
            )}

            <div className="flex flex-row items-center gap-2">
              {session?.user?.id !== comment.user.id && (
                <Button
                  variant="link"
                  className="h-6 px-0 gap-1"
                  onClick={handleBtnClick}
                >
                  <ThumbsUp />
                  Thích
                </Button>
              )}
              <Button
                variant="link"
                className="h-6 px-0 gap-1"
                onClick={handleBtnClick}
              >
                <Reply />
                Trả lời
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
