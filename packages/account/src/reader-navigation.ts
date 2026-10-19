"use client"

import { useCallback, useRef, useState } from "react"
import { queryOptions, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

export type ChapterNavigationDirection = "previous" | "next"
type NavigationChoice = {
  state: string
  selectedChapterId: string | null
  options: readonly unknown[]
}

export function canNavigateChapter(choice: NavigationChoice) {
  return (
    (choice.state === "ready" && choice.selectedChapterId !== null) ||
    (choice.state === "choice-required" && choice.options.length > 0)
  )
}

export function chapterNavigationOptions<T>(
  apiBaseUrl: string,
  chapterId: string,
  direction: ChapterNavigationDirection
) {
  return queryOptions({
    queryKey: [
      "catalog",
      apiBaseUrl,
      "navigation-releases",
      chapterId,
      direction,
    ],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        new URL(
          `/v1/chapters/${encodeURIComponent(chapterId)}/navigation-releases?direction=${direction}`,
          apiBaseUrl
        ),
        {
          cache: "no-store",
          credentials: "omit",
          headers: { accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
        }
      )
      if (!response.ok)
        throw new Error("Không thể tải chương. Vui lòng thử lại.")
      const result = (await response.json()) as { data: T[] }
      return result.data
    },
  })
}

export function useAdjacentChapter<T>({
  apiBaseUrl,
  chapterId,
  navigation,
  navigate,
}: {
  apiBaseUrl: string
  chapterId: string
  navigation: Record<ChapterNavigationDirection, NavigationChoice>
  navigate: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const trigger = useRef<HTMLElement | null>(null)
  const [loading, setLoading] = useState<ChapterNavigationDirection | null>(
    null
  )
  const [choice, setChoice] = useState<{
    direction: ChapterNavigationDirection
    releases: T[]
  } | null>(null)
  const openAdjacentChapter = useCallback(
    async (direction: ChapterNavigationDirection, element?: HTMLElement) => {
      if (pending.current) return
      const adjacent = navigation[direction]
      if (adjacent.state === "ready" && adjacent.selectedChapterId) {
        navigate(adjacent.selectedChapterId)
        return
      }
      if (!canNavigateChapter(adjacent)) return
      pending.current = true
      trigger.current =
        element ?? (document.activeElement as HTMLElement | null)
      setLoading(direction)
      try {
        const releases = await queryClient.fetchQuery(
          chapterNavigationOptions<T>(apiBaseUrl, chapterId, direction)
        )
        // Even one release requires confirmation when it changes the source/group lane.
        if (releases.length) setChoice({ direction, releases })
        else
          toast.add({
            type: "info",
            title: "Không còn chương đọc được ở vị trí này.",
          })
      } catch {
        toast.add({
          type: "error",
          title: "Không thể tải chương. Vui lòng thử lại.",
        })
      } finally {
        pending.current = false
        setLoading(null)
      }
    },
    [apiBaseUrl, chapterId, navigation, navigate, queryClient]
  )
  return { loading, choice, setChoice, trigger, openAdjacentChapter }
}

export async function loadReaderChapters<T>(
  apiBaseUrl: string,
  mangaId: string,
  page = 1,
  signal?: AbortSignal
) {
  const response = await fetch(
    new URL(
      `/v1/manga/${encodeURIComponent(mangaId)}/chapters?limit=100&page=${page}`,
      apiBaseUrl
    ),
    { headers: { accept: "application/json" }, signal }
  )
  const body = (await response.json().catch(() => null)) as
    T | { error?: { message?: string } } | null
  if (!response.ok) {
    throw new Error(
      (typeof body === "object" &&
        body &&
        "error" in body &&
        body.error?.message) ||
        "Không thể kết nối tới máy chủ"
    )
  }
  return body as T
}
