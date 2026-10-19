"use client"

import { useReaderProgress as useSharedReaderProgress } from "@workspace/account/reader-progress"
import type { ChapterDetail } from "@/lib/api"
import { useAccount } from "@/modules/account/provider"

export function useReaderProgress(props: {
  chapter: ChapterDetail
  hydrate: (chapterId: string, pageCount: number) => number
  ready: boolean
}) {
  const { apiBaseUrl, status, user } = useAccount()
  return useSharedReaderProgress({
    ...props,
    apiBaseUrl,
    status,
    userId: status === "authenticated" ? (user?.id ?? null) : null,
  })
}
