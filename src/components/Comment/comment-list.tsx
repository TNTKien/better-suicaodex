"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import CommentCard from "./comment-card";
import { useImperativeHandle } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(error.error || "Có lỗi xảy ra"), {
      status: res.status,
    });
  }
  return res.json();
};
const LIMIT = 10;

interface CommentListProps {
  id: string;
  type: "manga" | "chapter";
  inSidebar?: boolean;
}

const CommentList = ({
  ref,
  id,
  type,
  inSidebar = false,
}: CommentListProps & {
  ref: React.RefObject<unknown>;
}) => {
  const {
    data,
    refetch: mutate,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [`/api/comments/${type}/${id}`],
    queryFn: ({ pageParam = 0 }) =>
      fetcher(`/api/comments/${type}/${id}?offset=${pageParam}&limit=${LIMIT}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce(
        (acc, page) => acc + page.comments.length,
        0,
      );
      return totalLoaded < (lastPage.meta.totalCount || 0)
        ? totalLoaded
        : undefined;
    },
  });

  // Expose the mutate function to the parent component
  useImperativeHandle(ref, () => ({
    mutate,
  }));

  if (error)
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertDescription className="flex justify-center">
          Lỗi mất rồi 😭
        </AlertDescription>
      </Alert>
    );

  if (isLoading || !data)
    return (
      <div className="space-y-4 px-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card
            key={i}
            className="rounded-none shadow-none border-none p-0 bg-transparent"
          >
            <CardContent className="p-0!">
              <div className="flex gap-2">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  const allComments = data.pages.flatMap((page) => page.comments);

  if (allComments.length === 0)
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertTitle className="flex justify-center text-center">
          Chưa có bình luận nào!
        </AlertTitle>
        <AlertDescription className="flex justify-center text-center">
          Hãy bóc tem em nó ngay thôi! 😍
        </AlertDescription>
      </Alert>
    );

  return (
    <div className="space-y-4">
      <div className="space-y-4 px-1">
        {allComments.map((comment: any) => (
          <Card
            key={comment.id}
            className="rounded-none shadow-none border-none p-0 bg-transparent overflow-hidden"
          >
            <CardContent className="p-0!">
              <div className="relative">
                <CommentCard
                  comment={comment}
                  type={type}
                  contentId={id}
                  onMutate={mutate}
                />
                {comment.replies && comment.replies.length > 0 && (
                  <div className="relative mt-2 space-y-3">
                    {/* Vertical line going up through parent and down through all replies */}
                    <div className="absolute left-4 top-[-9999px] bottom-0 w-0.5 bg-border" />
                    {comment.replies.map(
                      (reply: any, index: number, arr: any[]) => {
                        const isLast = index === arr.length - 1;
                        return (
                          <div key={reply.id} className="relative pl-10">
                            {/* Horizontal branch to reply avatar */}
                            <div className="absolute left-4 top-4 h-0.5 w-6 bg-border" />
                            {/* Cover vertical line below last reply's avatar center */}
                            {isLast && (
                              <div
                                className={cn(
                                  "absolute left-4 top-[17px] bottom-0 w-0.5",
                                  inSidebar ? "bg-sidebar" : "bg-background",
                                )}
                              />
                            )}
                            <CommentCard
                              comment={reply}
                              type={type}
                              contentId={id}
                              isReply={true}
                              onMutate={mutate}
                            />
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Đang tải..." : "Xem thêm"}
          </Button>
        </div>
      )}
    </div>
  );
};

// Add a display name for the component
CommentList.displayName = "CommentList";

export default CommentList;
