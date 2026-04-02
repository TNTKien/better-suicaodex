"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getV2CommentsMangaById } from "@/lib/moetruyen/hooks/comments/comments";
import { Loader2 } from "lucide-react";

import MoeMangaCommentItem from "./moe-manga-comment-item";

const LIMIT = 10;

export default function MoeMangaComments({ mangaId }: { mangaId: number }) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["moetruyen", "comments", "manga", mangaId],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await getV2CommentsMangaById(mangaId, {
        page: pageParam,
        limit: LIMIT,
        sort: "created_at",
        order: "desc",
      });

      if (res.status !== 200) {
        throw new Error("Failed to fetch comments");
      }

      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.meta.pagination?.page ?? 1;
      const totalPages = lastPage.meta.pagination?.totalPages ?? 1;

      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-16 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="mt-2 rounded-sm bg-secondary">
        <AlertDescription className="flex justify-center">
          Lỗi mất rồi 😭
        </AlertDescription>
      </Alert>
    );
  }

  const comments = data.pages.flatMap((page) => page.data);

  if (comments.length === 0) {
    return (
      <Alert className="mt-2 rounded-sm bg-secondary">
        <AlertTitle className="flex justify-center text-center">
          Chưa có bình luận nào!
        </AlertTitle>
        {/* <AlertDescription className="flex justify-center text-center">
          Hãy bóc tem em nó ngay thôi! 😍
        </AlertDescription> */}
      </Alert>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      <div className="space-y-4 px-1">
        {comments.map((comment) => (
          <MoeMangaCommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchNextPage();
            }}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Đang tải..." : "Xem thêm"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
