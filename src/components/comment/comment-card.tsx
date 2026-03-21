"use client";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { formatShortTime } from "@/lib/utils";
import { getStickerByName } from "@/lib/stickers-fn";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/blur.css";
import { useState, useRef } from "react";
import { Textarea } from "../ui/textarea";
import { X, Send } from "lucide-react";
import { StickerPicker } from "./sticker-picker";
import { ButtonGroup } from "../ui/button-group";
import { Spinner } from "../ui/spinner";
import { authClient } from "@/lib/auth-client";

interface SerializedComment {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  isEdited: boolean;
  reactions: number;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: string | Date;
  };
  replies?: SerializedComment[];
  type?: "manga" | "chapter";
  mangaId?: string;
  chapterId?: string;
  chapterNumber?: string;
}

interface CommentCardProps {
  comment: SerializedComment;
  type: "manga" | "chapter";
  contentId: string;
  isReply?: boolean;
  onMutate?: () => void;
}

const MIN_COMMENT_LENGTH = 3;
const MAX_COMMENT_LENGTH = 2000;

// Check if content is HTML (old format from richtext editor)
const isHTML = (str: string): boolean => {
  return /<[a-z][\s\S]*>/i.test(str);
};

const getCommentValidationError = (content: string): string | null => {
  const trimmed = content.trim();

  if (!trimmed) {
    return "Bình luận không được để trống!";
  }

  if (trimmed.length < MIN_COMMENT_LENGTH) {
    return `Bình luận phải dài ít nhất ${MIN_COMMENT_LENGTH} ký tự!`;
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return `Bình luận không được dài hơn ${MAX_COMMENT_LENGTH} ký tự!`;
  }

  return null;
};

// Parse comment content to separate text and stickers
const parseCommentContent = (content: string) => {
  if (isHTML(content)) {
    return { text: content, stickers: [] };
  }

  const regex = /:([a-zA-Z0-9-]+):/g;
  const stickers: { name: string; url: string }[] = [];
  const foundPatterns: string[] = [];
  let textContent = content;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const stickerName = match[1];
    const sticker = getStickerByName(stickerName);
    if (sticker) {
      stickers.push({ name: stickerName, url: sticker.url });
      foundPatterns.push(match[0]);
    }
  }

  foundPatterns.forEach((pattern) => {
    textContent = textContent.replace(pattern, "");
  });
  textContent = textContent.trim();

  return { text: textContent, stickers };
};

export default function CommentCard({
  comment,
  type,
  contentId,
  isReply = false,
  onMutate,
}: CommentCardProps) {
  const { data: session } = authClient.useSession();
  const [editMode, setEditMode] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const { text, stickers } = parseCommentContent(comment.content);

  const handleEditOpen = () => {
    setEditContent(comment.content);
    setEditMode(true);
    setReplyMode(false);
    setTimeout(() => editTextareaRef.current?.focus(), 0);
  };

  const handleReplyOpen = () => {
    setReplyContent("");
    setReplyMode(true);
    setEditMode(false);
    setTimeout(() => replyTextareaRef.current?.focus(), 0);
  };

  const handleEditSubmit = async () => {
    const trimmed = editContent.trim();
    const validationError = getCommentValidationError(editContent);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setEditLoading(true);
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: trimmed, type }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Rap chậm thôi bruh...😓");
        } else {
          toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
        }
        return;
      }

      setEditMode(false);
      if (onMutate) onMutate();
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setEditLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    const trimmed = replyContent.trim();
    const validationError = getCommentValidationError(replyContent);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setReplyLoading(true);
      const endpoint = `/api/comments/${type}/${contentId}`;
      const body: Record<string, string> = {
        content: trimmed,
        parentId: comment.id,
        title: "",
      };
      if (type === "chapter") {
        body.chapterNumber = "";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Rap chậm thôi bruh...😓");
        } else {
          toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
        }
        return;
      }

      setReplyContent("");
      setReplyMode(false);
      if (onMutate) onMutate();
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setReplyLoading(false);
    }
  };

  const insertStickerToEdit = (stickerName: string) => {
    setEditContent((prev) =>
      prev ? `${prev} :${stickerName}:` : `:${stickerName}:`,
    );
  };

  const insertStickerToReply = (stickerName: string) => {
    setReplyContent((prev) =>
      prev ? `${prev} :${stickerName}:` : `:${stickerName}:`,
    );
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Avatar className="size-8 relative z-10 shrink-0">
          <AvatarImage
            src={comment.user.image ?? ""}
            alt={comment.user.name ?? "User"}
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

          {/* Comment content — hidden when editing */}
          {!editMode && (
            <>
              {text && (
                <div className="bg-muted rounded-2xl px-3 py-2 mt-1 inline-block max-w-full">
                  <Streamdown>{text}</Streamdown>
                </div>
              )}
              {stickers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 max-w-full">
                  {stickers.map((sticker, index) => (
                    <LazyLoadImage
                      key={`${sticker.name}-${index}`}
                      src={sticker.url}
                      alt={sticker.name}
                      className="rounded-md w-full max-w-[120px] sm:max-w-[150px] h-auto object-contain aspect-square"
                      effect="blur"
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Inline edit form */}
          {editMode && (
            <div className="mt-1 space-y-2">
              <div className="relative">
                <Textarea
                  ref={editTextareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Chỉnh sửa bình luận...(hỗ trợ markdown)"
                  className="bg-sidebar rounded-sm resize-none min-h-[100px] pr-28"
                  maxLength={MAX_COMMENT_LENGTH}
                  disabled={editLoading}
                />
                <div className="absolute bottom-2 right-2">
                  <ButtonGroup>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleEditSubmit();
                      }}
                      disabled={editLoading}
                      className="text-xs"
                      size="sm"
                      variant="outline"
                    >
                      {editLoading ? <Spinner /> : <Send />}
                      Lưu
                    </Button>
                    <StickerPicker onSelectSticker={insertStickerToEdit} />
                  </ButtonGroup>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditMode(false)}
              >
                <X />
                Hủy
              </Button>
            </div>
          )}

          {/* Timestamp + action buttons */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground line-clamp-1">
              {formatShortTime(new Date(comment.updatedAt))}
              {comment.isEdited ? " (Đã chỉnh sửa)" : ""}
            </span>

            {!!session?.user?.id && !editMode && (
              <div className="flex items-center gap-2">
                {session?.user?.id === comment.user.id && !comment.isEdited && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0 px-1 text-xs font-semibold hover:underline"
                    onClick={handleEditOpen}
                  >
                    Sửa
                  </Button>
                )}
                {/* Only allow reply on top-level comments (1-level nesting) */}
                {!isReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0 px-1 text-xs font-semibold hover:underline"
                    onClick={handleReplyOpen}
                  >
                    Trả lời
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Inline reply form */}
          {replyMode && (
            <div className="mt-2 space-y-2 px-1">
              <div className="relative">
                <Textarea
                  ref={replyTextareaRef}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Trả lời ${comment.user.name ?? ""}...`}
                  className="bg-sidebar rounded-sm resize-none min-h-[90px] pr-28"
                  maxLength={MAX_COMMENT_LENGTH}
                  disabled={replyLoading}
                />
                <div className="absolute bottom-2 right-2">
                  <ButtonGroup>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleReplySubmit();
                      }}
                      disabled={replyLoading}
                      className="text-xs"
                      size="sm"
                      variant="outline"
                    >
                      {replyLoading ? <Spinner /> : <Send />}
                      Gửi
                    </Button>
                    <StickerPicker onSelectSticker={insertStickerToReply} />
                  </ButtonGroup>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReplyMode(false)}
              >
                <X />
                Hủy
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
