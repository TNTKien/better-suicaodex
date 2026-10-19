"use client"

import type { RefObject } from "react"
import { useQuery } from "@tanstack/react-query"

import { ChapterCard } from "@/components/chapter-card"
import type { ChapterSummary } from "@/lib/api"
import { useAccount } from "@/modules/account/provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { accountReadingScope, useLocalReadingHistory } from "./local-history"
import { mangaProgressOptions, readChapterIdSet } from "./progress"

export function ChapterReleaseDialog({
  title,
  mangaId,
  releases,
  finalChapter = null,
  finalFocus,
  onClose,
  onNavigate,
}: {
  title: string
  mangaId: string
  releases: ChapterSummary[]
  finalChapter?: string | null
  finalFocus: RefObject<HTMLElement | null>
  onClose: () => void
  onNavigate?: () => void
}) {
  const { apiBaseUrl, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const progress = useQuery(mangaProgressOptions(apiBaseUrl, userId, mangaId))
  const local = useLocalReadingHistory(accountReadingScope(userId))
  const guest = useLocalReadingHistory("guest")
  const readIds = readChapterIdSet([
    ...(progress.data ?? []),
    ...local,
    ...guest,
  ])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-3xl" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Chọn chapter bạn muốn đọc.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[65dvh] min-w-0 flex-col gap-2 overflow-y-auto p-0.5">
          {releases.map((chapter) => (
            <ChapterCard
              chapter={chapter}
              finalChapter={finalChapter}
              isRead={readIds.has(chapter.id)}
              key={chapter.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
