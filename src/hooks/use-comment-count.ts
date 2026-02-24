import { useQuery } from "@tanstack/react-query";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(error.error || "Có lỗi xảy ra"), { status: res.status });
  }
  return res.json();
};

export function useCommentCount(mangaId: string) {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [`comment-count-${mangaId}`],
    queryFn: () => fetcher(`/api/comments/manga/${mangaId}/count`),
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
