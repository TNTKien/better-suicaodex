"use client";

import { CommentWithUser } from "@/lib/suicaodex/serializers";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { formatShortTime } from "@/lib/utils";

interface CommentCardProps {
  comment: CommentWithUser;
  isReply?: boolean;
  isLastReply?: boolean;
}

export default function CommentCard({
  comment,
  isReply = false,
  isLastReply = false,
}: CommentCardProps) {
  const { data: session } = useSession();
  const handleBtnClick = () => {
    return toast.info("Chức năng đang phát triển!", {
      closeButton: false,
    });
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
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
          <div className="bg-muted rounded-2xl px-3 py-2 mt-1 inline-block max-w-full">
            <ReactMarkdown
              className="prose prose-sm prose-img:my-1 prose-img:max-w-14 dark:prose-invert max-w-full"
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
                p: ({ children }) => (
                  <p className="whitespace-pre-wrap wrap-break-word">{children}</p>
                ),
              }}
            >
              {comment.content}
            </ReactMarkdown>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground line-clamp-1">
              {formatShortTime(new Date(comment.updatedAt))}
              {comment.isEdited ? " (Đã chỉnh sửa)" : ""}
            </span>

            {!!session?.user?.id && (
              <div className="flex items-center gap-2">
                {session?.user?.id === comment.user.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0 px-1 text-xs font-semibold hover:underline"
                    onClick={handleBtnClick}
                  >
                    Sửa
                  </Button>
                )}
                {session?.user?.id !== comment.user.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0 px-1 text-xs font-semibold hover:underline"
                    onClick={handleBtnClick}
                  >
                    Thích
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0 px-1 text-xs font-semibold hover:underline"
                  onClick={handleBtnClick}
                >
                  Trả lời
                </Button>
              </div>
            )}
          </div>

          {/* Placeholder for future replies support */}
          {/* {comment.replies && comment.replies.length > 0 && (
            <div className="relative mt-3 space-y-3">
              
              <div className="absolute left-[-29px] top-[-9999px] bottom-0 w-[2px] bg-border" />
              {comment.replies.map((reply: any, index: number) => (
                <div key={reply.id} className="relative">
                  
                  <div className="absolute left-[-28px] top-5 w-[36px] h-[2px] bg-border" />
                 
                  {index === comment.replies.length - 1 && (
                    <div className="absolute left-[-29px] top-[calc(20px+2px)] bottom-0 w-[2px] bg-background" />
                  )}
                  <CommentCard
                    comment={reply}
                    isReply
                    isLastReply={index === comment.replies.length - 1}
                  />
                </div>
              ))}
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}
