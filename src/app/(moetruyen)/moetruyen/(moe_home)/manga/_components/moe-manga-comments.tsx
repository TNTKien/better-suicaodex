"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useGetV1CommentsMangaById } from "@/lib/moetruyen/hooks/comments/comments";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

import MoeMangaCommentItem from "./moe-manga-comment-item";

const LIMIT = 10;

export default function MoeMangaComments({
  mangaId,
  page,
  onPageChange,
}: {
  mangaId: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { data, isLoading, error } = useGetV1CommentsMangaById(
    mangaId,
    {
      page,
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
      <Alert className="mt-2 rounded-sm bg-secondary">
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
      <Alert className="mt-2 rounded-sm bg-secondary">
        <AlertTitle className="flex justify-center text-center">
          Chưa có bình luận nào!
        </AlertTitle>
        <AlertDescription className="flex justify-center text-center">
          Hãy bóc tem em nó ngay thôi! 😍
        </AlertDescription>
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

      {totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationPrevious
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            />

            {totalPages <= 7 ? (
              Array.from({ length: totalPages }, (_, index) => (
                <PaginationItem key={index + 1}>
                  <PaginationLink
                    className="h-8 w-8"
                    isActive={page === index + 1}
                    onClick={() => onPageChange(index + 1)}
                  >
                    {index + 1}
                  </PaginationLink>
                </PaginationItem>
              ))
            ) : (
              <>
                {page > 3 ? (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        className="h-8 w-8"
                        onClick={() => onPageChange(1)}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {page > 4 ? <PaginationEllipsis /> : null}
                  </>
                ) : null}

                {Array.from({ length: 5 }, (_, index) => page - 2 + index)
                  .filter((value) => value >= 1 && value <= totalPages)
                  .map((value) => (
                    <PaginationItem key={value}>
                      <PaginationLink
                        className="h-8 w-8"
                        isActive={page === value}
                        onClick={() => onPageChange(value)}
                      >
                        {value}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                {page < totalPages - 2 ? (
                  <>
                    {page < totalPages - 3 ? <PaginationEllipsis /> : null}
                    <PaginationItem>
                      <PaginationLink
                        className="h-8 w-8"
                        onClick={() => onPageChange(totalPages)}
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                ) : null}
              </>
            )}

            <PaginationNext
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            />
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
