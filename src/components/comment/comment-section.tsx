"use client";

import CommentList from "./comment-list";
import CommentFormSimple from "./comment-form-simple";
// import { useCommentCount } from "@/hooks/use-comment-count";

interface CommentSectionProps {
  id: string;
  type: "manga" | "chapter";
  title: string;
  chapterNumber?: string;
}

export default function CommentSection({
  id,
  type,
  title,
  chapterNumber,
}: CommentSectionProps) {
  // Always call the hook unconditionally
  // const commentCount = useCommentCount(type === "manga" ? id : "");

  return (
    <div className="mt-2 grid grid-cols-1 gap-4 w-full">
      <CommentFormSimple
        id={id}
        title={title}
        type={type}
        chapterNumber={chapterNumber}
      />
      <CommentList id={id} type={type} />
    </div>
  );
}
