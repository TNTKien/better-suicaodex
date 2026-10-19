import { queryOptions } from "@tanstack/react-query"

export function groupRankingOptions<T extends { data: unknown[] }>(
  apiBaseUrl: string,
  window: string,
  limit = 10
) {
  return queryOptions({
    queryKey: ["groups", "ranking", apiBaseUrl, window, limit],
    staleTime: 90_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<T> => {
      const url = new URL("/v1/rankings/groups", apiBaseUrl)
      url.search = new URLSearchParams({
        window,
        limit: String(limit),
      }).toString()
      const response = await fetch(url, {
        credentials: "omit",
        headers: { accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      })
      const body = (await response.json().catch(() => null)) as T | null
      if (!response.ok || !body || !Array.isArray(body.data))
        throw new Error("Không thể tải bảng xếp hạng nhóm dịch.")
      return body
    },
  })
}

export function mangaRankingOptions<T extends { data: unknown[] }>(
  apiBaseUrl: string,
  metric: string,
  window: string
) {
  return queryOptions({
    queryKey: ["manga", "ranking", apiBaseUrl, metric, window, 10],
    staleTime: 90_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<T> => {
      const url = new URL("/v1/rankings/manga", apiBaseUrl)
      url.search = new URLSearchParams({
        metric,
        window,
        limit: "10",
      }).toString()
      const response = await fetch(url, {
        credentials: "omit",
        headers: { accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      })
      const body = (await response.json().catch(() => null)) as T | null
      if (!response.ok || !body || !Array.isArray(body.data))
        throw new Error("Không thể tải bảng xếp hạng.")
      return body
    },
  })
}
