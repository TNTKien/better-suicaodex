"use client";

import CommentList from "./comment-list";
import CommentFormSimple from "./comment-form-simple"; // New simple form with stickers
import { useRef } from "react";
import { useCommentCount } from "@/hooks/use-comment-count";

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
  // Create a reference to the CommentList component's mutate function
  const commentListRef = useRef<{ mutate: () => void } | null>(null);

  // Always call the hook unconditionally
  const commentCount = useCommentCount(type === "manga" ? id : "");

  const handleCommentPosted = () => {
    // Call the mutate function from the CommentList component to refresh data
    if (commentListRef.current) {
      commentListRef.current.mutate();
    }
    if (type === "manga") {
      commentCount.refresh();
    }
  };

  return (
    <div className="mt-2 grid grid-cols-1 gap-4 w-full">
      <CommentFormSimple
        id={id}
        title={title}
        type={type}
        onCommentPosted={handleCommentPosted}
        chapterNumber={chapterNumber}
      />
      <CommentList id={id} type={type} ref={commentListRef} />
    </div>
  );
}
