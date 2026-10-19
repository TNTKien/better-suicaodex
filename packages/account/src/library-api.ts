import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import { parseAsString, parseAsStringLiteral } from "nuqs/server"

export const libraryCategories = [
  { value: "following", label: "Theo dõi" },
  { value: "reading", label: "Đang đọc" },
  { value: "plan", label: "Sẽ đọc" },
  { value: "completed", label: "Đã hoàn thành" },
] as const

export type LibraryCategory = (typeof libraryCategories)[number]["value"]

export const libraryTabParser = parseAsStringLiteral(
  libraryCategories.map(({ value }) => value)
)
  .withDefault("following")
  .withOptions({ clearOnDefault: false, history: "push" })

export const librarySorts = [
  { value: "addedAt", label: "Mặc định" },
  { value: "latestChapter", label: "Mới nhất" },
] as const

export type LibrarySort = (typeof librarySorts)[number]["value"]

export const librarySearchParser = parseAsString
  .withDefault("")
  .withOptions({ history: "replace" })
export const librarySortParser = parseAsStringLiteral(
  librarySorts.map(({ value }) => value)
)
  .withDefault("addedAt")
  .withOptions({ history: "push" })

export class LibraryApiError extends Error {
  constructor(readonly status: number) {
    super("Library API request failed")
  }
}

async function libraryRequest<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...init.headers,
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new LibraryApiError(response.status)
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T)
}

export const libraryItemKey = (
  apiBaseUrl: string,
  userId: string | null,
  mangaId: string
) => ["library", apiBaseUrl, userId, "item", mangaId] as const

export const libraryListKey = (
  apiBaseUrl: string,
  userId: string | null,
  category: LibraryCategory,
  q = "",
  sort: LibrarySort = "addedAt"
) => ["library", apiBaseUrl, userId, "list", category, q, sort] as const

export function libraryListOptions<
  T extends { meta: { nextCursor: string | null } },
>(
  apiBaseUrl: string,
  userId: string | null,
  category: LibraryCategory,
  q = "",
  sort: LibrarySort = "addedAt"
) {
  return infiniteQueryOptions({
    queryKey: libraryListKey(apiBaseUrl, userId, category, q, sort),
    enabled: userId !== null,
    initialPageParam: null as string | null,
    gcTime: 5 * 60_000,
    staleTime: 30_000,
    retry: false,
    queryFn: ({ pageParam, signal }) => {
      const search = new URLSearchParams({ category, limit: "20", sort })
      if (q) search.set("q", q)
      if (pageParam) search.set("cursor", pageParam)
      return libraryRequest<T>(
        apiBaseUrl,
        `/v1/me/library?${search}`,
        {},
        signal
      )
    },
    getNextPageParam: ({ meta }: T) => meta.nextCursor ?? undefined,
  })
}

export function libraryItemOptions<T>(
  apiBaseUrl: string,
  userId: string | null,
  mangaId: string
) {
  return queryOptions({
    queryKey: libraryItemKey(apiBaseUrl, userId, mangaId),
    enabled: userId !== null,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await libraryRequest<{ data: T | null }>(
          apiBaseUrl,
          `/v1/me/library/${encodeURIComponent(mangaId)}`,
          {},
          signal
        )
      ).data,
  })
}

export async function putLibraryItem<T>(
  apiBaseUrl: string,
  mangaId: string,
  category: LibraryCategory
) {
  return (
    await libraryRequest<{ data: T }>(
      apiBaseUrl,
      `/v1/me/library/${encodeURIComponent(mangaId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      }
    )
  ).data
}

export async function deleteLibraryItem(apiBaseUrl: string, mangaId: string) {
  await libraryRequest<void>(
    apiBaseUrl,
    `/v1/me/library/${encodeURIComponent(mangaId)}`,
    { method: "DELETE" }
  )
}
