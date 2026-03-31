"use client";

import { useMounted } from "@mantine/hooks";

import { useGetV2CommentsRecent } from "@/lib/moetruyen/hooks/comments/comments";

import MoeRecentCommentItem from "./moe-recent-comment-item";
import MoeRecentCommentsSkeleton from "./moe-recent-comments-skeleton";

const LIMIT = 10;

export default function MoeRecentComments() {
  const isMounted = useMounted();

  const { data, isLoading, error } = useGetV2CommentsRecent(
    {
      limit: LIMIT,
      sort: "created_at",
      order: "desc",
    },
    {
      query: {
        enabled: isMounted,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  );

  if (!isMounted || isLoading) {
    return <MoeRecentCommentsSkeleton />;
  }

  if (error || data?.status !== 200 || !data.data.data.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
      </div>

      <div className="grid gap-3">
        {data.data.data.map((comment) => (
          <MoeRecentCommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}
