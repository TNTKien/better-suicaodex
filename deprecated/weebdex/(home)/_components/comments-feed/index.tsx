"use client";

import { useQuery } from "@tanstack/react-query";
import { Marquee } from "@/components/ui/marquee";
import { Skeleton } from "@/components/ui/skeleton";
import CommentFeedItem from "@/components/Comment/CommentFeed/comment-feed-item";

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

function CommentSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-1 py-2 border-b">
      <Skeleton className="w-3/4 h-4 rounded-sm bg-gray-500" />
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-10 w-10 rounded-full shrink-0 bg-gray-500" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="w-1/3 h-3 rounded-sm bg-gray-500" />
          <Skeleton className="w-full h-3 rounded-sm bg-gray-500" />
          <Skeleton className="w-5/6 h-3 rounded-sm bg-gray-500" />
        </div>
      </div>
    </div>
  );
}

export default function CommentsFeed() {
  const {
    data: comments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/comments/latest"],
    queryFn: () => fetcher("/api/comments/latest"),
  });

  if (isLoading)
    return (
      <div className="flex flex-col gap-4">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
        </div>
        <div className="flex flex-col gap-1 h-[450px] md:h-[650px] overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      </div>
    );

  if (error || !comments) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
      </div>

      <div className="relative">
        <Marquee
          pauseOnHover
          vertical
          className="[--duration:55s] px-0 h-[450px] md:h-[650px] overflow-hidden"
        >
          {comments.map((cmt: any) => (
            <CommentFeedItem key={cmt.id} comment={cmt} type={cmt.type} />
          ))}
        </Marquee>

        <div className="from-background pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-linear-to-b"></div>
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t"></div>
      </div>
    </div>
  );
}
