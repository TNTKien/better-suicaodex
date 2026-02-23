import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(error.error || "Có lỗi xảy ra"), { status: res.status });
  }
  return res.json();
};

export function useCommentCount(mangaId: string) {
  const { data, mutate } = useSWR(
    mangaId ? `/api/comments/manga/${mangaId}/count` : null,
    fetcher,
    { refreshInterval: 0 } // Không auto revalidate
  );

  return {
    count: data?.count ?? 0,
    refresh: mutate,
    isLoading: !data,
  };
}
