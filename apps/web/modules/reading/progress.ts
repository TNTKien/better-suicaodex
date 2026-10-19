import { queryOptions } from "@tanstack/react-query"
import {
  readingRequest,
  readingKeys,
  mangaProgressKey,
  mangaReadingHistoryOptions as sharedMangaReadingHistoryOptions,
  mergeReadingHistory as sharedMergeReadingHistory,
} from "@workspace/account/reading-api"
export {
  ReadingApiError,
  readingKeys,
  mangaProgressKey,
  deleteReadingProgress,
} from "@workspace/account/reading-api"

import { compareDesc, parseISO } from "date-fns"

import type { components } from "@/src/lib/generated/api"

export type ReadingProgress = components["schemas"]["ReadingProgress"]
export type ReadingHistoryItem = components["schemas"]["ReadingHistoryItem"]
export type MangaReadingHistoryItem =
  components["schemas"]["MangaReadingHistoryItem"]
export type MergeHistoryResult = components["schemas"]["MergeHistoryResult"]

export type ReadingHistoryPage = {
  data: ReadingHistoryItem[]
  meta: { limit: number; nextCursor: string | null }
}

export type MangaReadingHistoryPage = {
  data: MangaReadingHistoryItem[]
  meta: { limit: number; nextCursor: string | null }
}

export const readingHistoryPreviewLimit = 5

export function mangaProgressOptions(
  apiBaseUrl: string,
  userId: string | null,
  mangaId: string
) {
  return queryOptions({
    queryKey: mangaProgressKey(apiBaseUrl, userId, mangaId),
    enabled: userId !== null,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await readingRequest<{ data: ReadingProgress[] }>(
          apiBaseUrl,
          `/v1/me/reading-progress?mangaId=${encodeURIComponent(mangaId)}`,
          { signal }
        )
      ).data,
  })
}

export function mangaReadingHistoryOptions(
  apiBaseUrl: string,
  userId: string | null,
  limit = 20
) {
  return sharedMangaReadingHistoryOptions<MangaReadingHistoryPage>(
    apiBaseUrl,
    userId,
    limit
  )
}

export function readingHistoryPreviewOptions(
  apiBaseUrl: string,
  userId: string | null
) {
  const limit = readingHistoryPreviewLimit
  return queryOptions({
    queryKey: readingKeys.history(apiBaseUrl, userId, limit),
    enabled: userId !== null,
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) =>
      readingRequest<ReadingHistoryPage>(
        apiBaseUrl,
        `/v1/me/reading-history?limit=${limit}`,
        { signal }
      ),
  })
}

export { putReadingProgress } from "@workspace/account/reading-api"

export function mergeReadingHistory(
  apiBaseUrl: string,
  entries: components["schemas"]["MergeHistoryInput"]["entries"],
  signal?: AbortSignal
) {
  return sharedMergeReadingHistory<MergeHistoryResult>(
    apiBaseUrl,
    entries,
    signal
  )
}

export function resumeChapterHref(
  progress?: Pick<ReadingProgress, "chapterId">
) {
  return progress ? `/chapter/${progress.chapterId}` : null
}

export function latestProgress<
  T extends Pick<ReadingProgress, "chapterId"> & {
    readAt?: string
  },
>(progress: readonly T[]) {
  return [...progress].sort((left, right) => {
    if (!left.readAt) return right.readAt ? 1 : 0
    if (!right.readAt) return -1
    return compareDesc(parseISO(left.readAt), parseISO(right.readAt))
  })[0]
}

export function readChapterIdSet(
  progress?: readonly Pick<ReadingProgress, "chapterId">[]
) {
  return new Set(progress?.map(({ chapterId }) => chapterId))
}
