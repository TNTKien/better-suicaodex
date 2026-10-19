"use client"

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { compareDesc, parseISO } from "date-fns"
import { useState } from "react"
import { toast } from "@workspace/ui/components/toast"
import {
  accountReadingScope,
  removeLocalReadingEntry,
  type LocalReadingHistoryEntry,
  type LocalReadingSnapshot,
  useLocalReadingHistory,
} from "./reading-local-history"
import {
  deleteReadingProgress,
  mangaReadingHistoryOptions,
  readingKeys,
} from "./reading-api"

export type HistoryItem = {
  chapterId: string
  chapterNumber: string | null
  chapterTitle: string | null
  cover: { url: string; width: number | null; height: number | null } | null
  mangaId: string
  mangaSlug: string | null
  mangaTitle: string
  readAt?: string
}

type HistoryGroup = Pick<
  HistoryItem,
  "cover" | "mangaId" | "mangaSlug" | "mangaTitle"
> & {
  chapters: HistoryItem[]
}

function localItem(entry: LocalReadingHistoryEntry): HistoryItem {
  return {
    chapterId: entry.chapterId,
    chapterNumber: entry.snapshot?.chapter.number ?? null,
    chapterTitle: entry.snapshot?.chapter.title ?? null,
    cover: entry.snapshot?.manga.cover ?? null,
    mangaId: entry.mangaId,
    mangaSlug: entry.snapshot?.manga.slug ?? null,
    mangaTitle: entry.snapshot?.manga.title ?? "Chapter đã đọc",
    ...(entry.readAt ? { readAt: entry.readAt } : {}),
  }
}

export function groupHistory(items: HistoryItem[]) {
  const groups = new Map<string, HistoryGroup>()
  const chapterIds = new Set<string>()
  for (const item of [...items].sort((left, right) => {
    if (!left.readAt) return right.readAt ? 1 : 0
    if (!right.readAt) return -1
    return compareDesc(parseISO(left.readAt), parseISO(right.readAt))
  })) {
    if (chapterIds.has(item.chapterId)) continue
    chapterIds.add(item.chapterId)
    const group = groups.get(item.mangaId)
    if (!group) {
      groups.set(item.mangaId, {
        cover: item.cover,
        mangaId: item.mangaId,
        mangaSlug: item.mangaSlug,
        mangaTitle: item.mangaTitle,
        chapters: [item],
      })
    } else {
      if (group.chapters.length < 3) group.chapters.push(item)
      if (!group.cover && item.cover) group.cover = item.cover
      if (!group.mangaSlug && item.mangaSlug) {
        group.mangaSlug = item.mangaSlug
        group.mangaTitle = item.mangaTitle
      }
    }
  }
  return [...groups.values()]
}

export function chapterName(item: HistoryItem) {
  const number = item.chapterNumber ? `Ch. ${item.chapterNumber}` : "Oneshot"
  return item.chapterTitle ? `${number} - ${item.chapterTitle}` : number
}

type MangaHistoryPage = {
  data: {
    manga: LocalReadingSnapshot["manga"]
    chapters: {
      chapter: LocalReadingSnapshot["chapter"]
      progress: { readAt: string }
    }[]
  }[]
  meta: { limit: number; nextCursor: string | null }
}

export function useReadingHistory<T extends MangaHistoryPage>(
  apiBaseUrl: string,
  userId: string | null,
  options: ReturnType<typeof mangaReadingHistoryOptions<T>>
) {
  const queryClient = useQueryClient()
  const scope = accountReadingScope(userId)
  const local = useLocalReadingHistory(scope)
  const guest = useLocalReadingHistory("guest")
  const history = useInfiniteQuery(options)
  const [deleteItem, setDeleteItem] = useState<HistoryItem | null>(null)
  const serverItems: HistoryItem[] = (
    history.data?.pages.flatMap(({ data }) => data) ?? []
  ).flatMap(({ chapters, manga }) =>
    chapters.map(({ chapter, progress }) => ({
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      cover: manga.cover,
      mangaId: manga.id,
      mangaSlug: manga.slug,
      mangaTitle: manga.title,
      readAt: progress.readAt,
    }))
  )
  const groups = groupHistory(
    userId
      ? [...serverItems, ...local.map(localItem), ...guest.map(localItem)]
      : guest.map(localItem)
  )

  const remove = useMutation({
    mutationFn: async (item: HistoryItem) => {
      if (userId) await deleteReadingProgress(apiBaseUrl, item.chapterId)
      removeLocalReadingEntry(scope, item.chapterId)
      if (!userId) return
      removeLocalReadingEntry("guest", item.chapterId)
    },
    onSuccess: (_, item) => {
      if (userId)
        queryClient.setQueryData<InfiniteData<T>>(options.queryKey, (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  data: page.data.flatMap((group) => {
                    const chapters = group.chapters.filter(
                      ({ chapter }) => chapter.id !== item.chapterId
                    )
                    return chapters.length ? [{ ...group, chapters }] : []
                  }),
                })),
              }
            : data
        )
      void queryClient.invalidateQueries({
        queryKey: readingKeys.account(apiBaseUrl, userId),
      })
      setDeleteItem(null)
      toast.add({ type: "success", title: "Đã xóa khỏi lịch sử đọc" })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Không thể xóa lịch sử đọc. Vui lòng thử lại.",
      }),
  })

  return { groups, history, deleteItem, setDeleteItem, remove }
}
