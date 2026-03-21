import { useQuery } from "@tanstack/react-query";
import {
  fetchCommentJson,
  type CommentCountResponse,
} from "@/lib/comment-client";
import { getCommentCountQueryKey } from "@/lib/comment-query-keys";

export function useCommentCount(mangaId: string) {
  const { data, refetch, isLoading } = useQuery<CommentCountResponse>({
    queryKey: getCommentCountQueryKey(mangaId),
    queryFn: () =>
      fetchCommentJson<CommentCountResponse>(
        `/api/comments/manga/${mangaId}/count`,
      ),
    enabled: !!mangaId,
    refetchInterval: false, // Không auto revalidate
    staleTime: Infinity,
  });

  return {
    count: data?.count ?? 0,
    refresh: refetch,
    isLoading,
  };
}
