"use client"

import { tz } from "@date-fns/tz"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useCallback, useEffect, useMemo, useRef } from "react"

import type { AccountStatus } from "./provider"
import { notificationsKey } from "./notifications-api"

import {
  accountReadingScope,
  acknowledgeLocalReadingEntries,
  recordLocalReadingProgress,
  type LocalReadingHistoryEntry,
  type LocalReadingSnapshot,
  type ReadingHistoryScope,
  useLocalReadingHistoryReady,
} from "./reading-local-history"
import {
  mangaProgressKey,
  putReadingProgress,
  readingKeys,
  type ReadingProgress,
} from "./reading-api"

type PendingWrite = {
  entry: LocalReadingHistoryEntry
  userId: string
}

function currentInstant() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", { in: tz("UTC") })
}

export function useReaderProgress({
  apiBaseUrl,
  status,
  userId,
  chapter,
  hydrate,
  ready,
}: {
  apiBaseUrl: string
  status: AccountStatus
  userId: string | null
  chapter: LocalReadingSnapshot["chapter"] & {
    manga: LocalReadingSnapshot["manga"]
    pages: readonly unknown[]
  }
  hydrate: (chapterId: string, pageCount: number) => number
  ready: boolean
}) {
  const queryClient = useQueryClient()
  const localHistoryReady = useLocalReadingHistoryReady()
  const scope: ReadingHistoryScope | null =
    userId !== null
      ? accountReadingScope(userId)
      : status === "loading"
        ? null
        : "guest"
  const snapshot = useMemo<LocalReadingSnapshot>(
    () => ({
      manga: {
        id: chapter.manga.id,
        slug: chapter.manga.slug,
        title: chapter.manga.title,
        cover: chapter.manga.cover,
      },
      chapter: {
        id: chapter.id,
        volume: chapter.volume,
        number: chapter.number,
        title: chapter.title,
        language: chapter.language,
      },
    }),
    [chapter]
  )
  const recorded = useRef<string | null>(null)
  const pending = useRef<PendingWrite | null>(null)
  const request = useRef<AbortController | null>(null)
  const activeUserId = useRef(userId)

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      hydrate(chapter.id, chapter.pages.length)
    )
    return () => cancelAnimationFrame(frame)
  }, [chapter.id, chapter.pages.length, hydrate])

  useEffect(() => {
    if (activeUserId.current === userId) return
    activeUserId.current = userId
    recorded.current = null
    pending.current = null
    request.current?.abort()
    request.current = null
  }, [userId])

  const flush = useCallback(
    async (keepalive = false) => {
      const value = pending.current
      if (!value || activeUserId.current !== value.userId) return
      const controller = new AbortController()
      request.current?.abort()
      request.current = controller

      try {
        const canonical = await putReadingProgress(
          apiBaseUrl,
          value.entry.chapterId,
          value.entry.readAt!,
          keepalive,
          controller.signal
        )
        acknowledgeLocalReadingEntries(
          accountReadingScope(value.userId),
          [value.entry],
          new Set([value.entry.chapterId])
        )
        if (pending.current?.entry.revision === value.entry.revision)
          pending.current = null
        if (activeUserId.current !== value.userId) return

        queryClient.setQueryData<ReadingProgress[] | undefined>(
          mangaProgressKey(apiBaseUrl, value.userId, chapter.manga.id),
          (items) =>
            items
              ? [
                  canonical,
                  ...items.filter(
                    ({ chapterId }) => chapterId !== canonical.chapterId
                  ),
                ]
              : items
        )
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: readingKeys.historyRoot(apiBaseUrl, value.userId),
          }),
          queryClient.invalidateQueries({
            queryKey: notificationsKey(apiBaseUrl, value.userId),
          }),
        ])
      } catch {
        // The account-scoped local entry remains queued for a later merge.
      } finally {
        if (request.current === controller) request.current = null
      }
    },
    [apiBaseUrl, chapter.manga.id, queryClient]
  )

  useEffect(() => {
    if (!ready || !localHistoryReady || !scope) return
    const key = `${scope}:${chapter.id}`
    if (recorded.current === key) return
    recorded.current = key
    const entry = recordLocalReadingProgress(scope, {
      chapterId: chapter.id,
      mangaId: chapter.manga.id,
      readAt: currentInstant(),
      snapshot,
    })
    if (!userId) return
    pending.current = { entry, userId }
    void flush()
  }, [
    chapter.id,
    chapter.manga.id,
    flush,
    localHistoryReady,
    ready,
    scope,
    snapshot,
    userId,
  ])

  useEffect(() => {
    const onPageHide = () => void flush(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush(true)
    }
    window.addEventListener("pagehide", onPageHide)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [flush])

  return { flush }
}
