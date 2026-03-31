"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGetV2CommentsChaptersById } from "@/lib/moetruyen/hooks/comments/comments";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import MoeChapterCommentItem from "./moe-chapter-comment-item";

const LIMIT = 10;

export default function MoeChapterComments({
  chapterId,
}: {
  chapterId: number;
}) {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useGetV2CommentsChaptersById(
    chapterId,
    {
      page: page === 1 ? 1 : page,
      limit: LIMIT,
      sort: "created_at",
      order: "desc",
    },
    {
      query: {
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  );

  if (isLoading) {
    return (
      <div className="flex h-16 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || data?.status !== 200) {
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertDescription className="flex justify-center">
          Lỗi mất rồi 😭
        </AlertDescription>
      </Alert>
    );
  }

  const comments = data.data.data;
  const totalPages = data.data.meta.pagination?.totalPages ?? 1;

  if (comments.length === 0) {
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertTitle className="flex justify-center text-center">
          Chương này chưa có bình luận nào.
        </AlertTitle>
        {/* <AlertDescription className="flex justify-center text-center">
          Chương này chưa có bình luận nào.
        </AlertDescription> */}
      </Alert>
    );
  }

  return (
    <div className="space-y-4" key={chapterId}>
      <div className="space-y-4 px-1">
        {comments.map((comment) => (
          <MoeChapterCommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => value - 1)}
            disabled={page === 1}
          >
            Trước
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => value + 1)}
            disabled={page === totalPages}
          >
            Sau
          </Button>
        </div>
      ) : null}
    </div>
  );
}
