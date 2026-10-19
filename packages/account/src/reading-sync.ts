"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  accountReadingScope,
  acknowledgeLocalReadingEntries,
  localReadingHistoryStorageKey,
  readLocalReadingHistory,
  rehydrateLocalReadingHistory,
  type ReadingHistoryScope,
  useLocalReadingHistoryReady,
} from "./reading-local-history"
import { notificationsKey } from "./notifications-api"
import { mergeReadingHistory, readingKeys } from "./reading-api"

const batchSize = 100

async function mergeScope(
  apiBaseUrl: string,
  scope: ReadingHistoryScope,
  signal: AbortSignal
) {
  const pending = readLocalReadingHistory(scope)
  let acknowledged = false

  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize)
    const result = await mergeReadingHistory(
      apiBaseUrl,
      batch.map(({ chapterId, readAt }) => ({
        chapterId,
        ...(readAt ? { readAt } : {}),
      })),
      signal
    )
    const chapterIds = new Set([
      ...result.merged.map(({ chapterId }) => chapterId),
      ...result.ignored
        .filter(({ acknowledged }) => acknowledged)
        .map(({ chapterId }) => chapterId),
    ])
    if (chapterIds.size > 0) {
      acknowledgeLocalReadingEntries(scope, batch, chapterIds)
      acknowledged = true
    }
  }

  return acknowledged
}

export function useReadingHistorySync(
  apiBaseUrl: string,
  userId: string | null
) {
  const queryClient = useQueryClient()
  const localHistoryReady = useLocalReadingHistoryReady()

  useEffect(() => {
    const rehydrate = (event: StorageEvent) => {
      if (event.key === localReadingHistoryStorageKey)
        void rehydrateLocalReadingHistory()
    }
    window.addEventListener("storage", rehydrate)
    return () => window.removeEventListener("storage", rehydrate)
  }, [])

  useEffect(() => {
    if (!localHistoryReady || !userId) return
    const controller = new AbortController()
    let running = false

    const sync = async () => {
      if (running) return
      running = true
      try {
        const results = await Promise.all([
          mergeScope(apiBaseUrl, "guest", controller.signal),
          mergeScope(
            apiBaseUrl,
            accountReadingScope(userId),
            controller.signal
          ),
        ])
        if (results.some(Boolean))
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: readingKeys.account(apiBaseUrl, userId),
            }),
            queryClient.invalidateQueries({
              queryKey: notificationsKey(apiBaseUrl, userId),
            }),
          ])
      } catch {
        // Pending local entries remain available for the next online retry.
      } finally {
        running = false
      }
    }

    void sync()
    window.addEventListener("online", sync)
    return () => {
      controller.abort()
      window.removeEventListener("online", sync)
    }
  }, [apiBaseUrl, localHistoryReady, queryClient, userId])
}
