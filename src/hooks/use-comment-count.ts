import useSWR from "swr";

interface CommentCountResponse {
  count: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useCommentCount(mangaId: string) {
  const { data, mutate } = useSWR<CommentCountResponse>(
    mangaId ? `/api/comments/manga/${mangaId}/count` : null,
    fetcher,
    { refreshInterval: 0 }, // Không auto revalidate
  );

  return {
    count: data?.count ?? 0,
    refresh: mutate,
    isLoading: !data,
  };
}
