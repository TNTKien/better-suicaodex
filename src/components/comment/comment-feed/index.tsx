"use client";

import { useQuery } from "@tanstack/react-query";
import CommentFeedItem from "./comment-feed-item";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchCommentJson, type LatestComment } from "@/lib/comment-client";
import { latestCommentsQueryKey } from "@/lib/comment-query-keys";

import Image from "next/image";
import DoroLoading from "#/images/doro-loading.gif";
import { Marquee } from "@/components/ui/marquee";

export default function CommentFeed() {
  const {
    data: comments,
    isLoading,
    error,
  } = useQuery<LatestComment[]>({
    queryKey: latestCommentsQueryKey,
    queryFn: () => fetchCommentJson<LatestComment[]>("/api/comments/latest"),
  });

  if (isLoading)
    return (
      <>
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
        </div>
        <Alert className="rounded-sm border-none mt-4">
          <AlertDescription className="flex justify-center">
            <Image
              src={DoroLoading}
              alt="Loading..."
              unoptimized
              priority
              className="w-20 h-auto"
            />
          </AlertDescription>
        </Alert>
      </>
    );
  if (error || !comments) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
      </div>

      <Marquee
        pauseOnHover
        vertical
        className="[--duration:55s] px-0 h-[450px] md:h-[650px] overflow-hidden"
      >
        {comments.map((cmt) => (
          <CommentFeedItem key={cmt.id} comment={cmt} type={cmt.type} />
        ))}
      </Marquee>
    </div>
  );
}
