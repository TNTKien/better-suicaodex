"use client"

import { useRef, useState } from "react"
import { queryOptions, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

type ReadingPosition = "first" | "last"

export function mangaReadingEntryOptions<T extends { id: string }>(
  apiBaseUrl: string,
  mangaId: string,
  position: ReadingPosition
) {
  return queryOptions({
    queryKey: ["catalog", apiBaseUrl, "reading-entry", mangaId, position],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        new URL(
          `/v1/manga/${encodeURIComponent(mangaId)}/reading-entry?position=${position}`,
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

export function useMangaReadingEntry<T extends { id: string }>({
  apiBaseUrl,
  mangaId,
  navigate,
}: {
  apiBaseUrl: string
  mangaId: string
  navigate: (href: string) => void
}) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState<ReadingPosition | null>(null)
  const [choice, setChoice] = useState<{
    position: ReadingPosition
    releases: T[]
  } | null>(null)
  const pending = useRef(false)
  const trigger = useRef<HTMLElement | null>(null)

  async function openEntry(position: ReadingPosition, button: HTMLElement) {
    if (pending.current) return
    pending.current = true
    trigger.current = button
    setLoading(position)
    try {
      const releases = await queryClient.fetchQuery(
        mangaReadingEntryOptions<T>(apiBaseUrl, mangaId, position)
      )
      if (releases.length === 1) navigate(`/chapter/${releases[0]!.id}`)
      else if (releases.length > 1) setChoice({ position, releases })
      else toast.add({ type: "info", title: "Truyện chưa có chương đọc được." })
    } catch {
      toast.add({
        type: "error",
        title: "Không thể tải chương. Vui lòng thử lại.",
      })
    } finally {
      pending.current = false
      setLoading(null)
    }
  }

  return {
    loading,
    choice,
    trigger,
    openEntry,
    closeChoice: () => setChoice(null),
  }
}
