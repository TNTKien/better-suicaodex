import { infiniteQueryOptions } from "@tanstack/react-query"

export class ReadingApiError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? "Phiên đăng nhập đã hết hạn."
        : "Không thể đồng bộ lịch sử đọc."
    )
  }
}

export const readingKeys = {
  root: ["reading"] as const,
  account: (apiBaseUrl: string, userId: string | null) =>
    ["reading", apiBaseUrl, userId] as const,
  manga: (apiBaseUrl: string, userId: string | null, mangaId: string) =>
    ["reading", apiBaseUrl, userId, "progress", "manga", mangaId] as const,
  historyRoot: (apiBaseUrl: string, userId: string | null) =>
    ["reading", apiBaseUrl, userId, "history"] as const,
  history: (apiBaseUrl: string, userId: string | null, limit: number) =>
    [...readingKeys.historyRoot(apiBaseUrl, userId), { limit }] as const,
  mangaHistory: (apiBaseUrl: string, userId: string | null, limit: number) =>
    [
      ...readingKeys.historyRoot(apiBaseUrl, userId),
      "manga",
      { limit },
    ] as const,
}

export const mangaProgressKey = readingKeys.manga

export type ReadingProgress = {
  chapterId: string
  mangaId: string
  readAt: string
  updatedAt: string
}

export async function putReadingProgress(
  apiBaseUrl: string,
  chapterId: string,
  readAt: string,
  keepalive = false,
  signal?: AbortSignal
) {
  return (
    await readingRequest<{ data: ReadingProgress }>(
      apiBaseUrl,
      `/v1/me/reading-progress/${encodeURIComponent(chapterId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ readAt }),
        keepalive,
        signal,
      }
    )
  ).data
}

export async function readingRequest<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(8_000)])
      : init.keepalive
        ? undefined
        : AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new ReadingApiError(response.status)
  return (response.status === 204 ? undefined : response.json()) as Promise<T>
}

export function mangaReadingHistoryOptions<
  T extends { meta: { nextCursor: string | null } },
>(apiBaseUrl: string, userId: string | null, limit = 20) {
  return infiniteQueryOptions({
    queryKey: readingKeys.mangaHistory(apiBaseUrl, userId, limit),
    enabled: userId !== null,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    initialPageParam: null as string | null,
    getNextPageParam: (lastResult: T) =>
      lastResult.meta.nextCursor ?? undefined,
    queryFn: async ({ pageParam, signal }) => {
      const query = new URLSearchParams({ limit: String(limit) })
      if (pageParam) query.set("cursor", pageParam)
      return readingRequest<T>(
        apiBaseUrl,
        `/v1/me/reading-history/manga?${query}`,
        { signal }
      )
    },
  })
}

export function deleteReadingProgress(apiBaseUrl: string, chapterId: string) {
  return readingRequest<void>(
    apiBaseUrl,
    `/v1/me/reading-progress/${encodeURIComponent(chapterId)}`,
    { method: "DELETE" }
  )
}

type MergeAcknowledgements = {
  merged: { chapterId: string }[]
  ignored: { chapterId: string; acknowledged: boolean }[]
}

export function mergeReadingHistory<T = MergeAcknowledgements>(
  apiBaseUrl: string,
  entries: { chapterId: string; readAt?: string }[],
  signal?: AbortSignal
) {
  return readingRequest<T>(apiBaseUrl, "/v1/me/reading-history/merge", {
    method: "POST",
    body: JSON.stringify({ entries }),
    signal,
  })
}
