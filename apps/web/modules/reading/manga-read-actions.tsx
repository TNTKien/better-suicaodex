"use client"

import Link from "next/link"
import { useRouter } from "@bprogress/next/app"
import { useQuery } from "@tanstack/react-query"
import { useMangaReadingEntry } from "@workspace/account/reading-entry"
import { BookOpenIcon, ListEndIcon, ListStartIcon } from "lucide-react"

import type { ChapterSummary } from "@/lib/api"
import { useAccount } from "@/modules/account/provider"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { accountReadingScope, useLocalReadingHistory } from "./local-history"
import { ChapterReleaseDialog } from "./chapter-release-dialog"
import {
  latestProgress,
  mangaProgressOptions,
  resumeChapterHref,
} from "./progress"

export { mangaReadingEntryOptions } from "@workspace/account/reading-entry"

export function MangaReadActions({
  hasChapters,
  finalChapter,
  mangaId,
}: {
  hasChapters: boolean
  finalChapter: string | null
  mangaId: string
}) {
  const router = useRouter()
  const { apiBaseUrl, status, user } = useAccount()
  const { loading, choice, trigger, openEntry, closeChoice } =
    useMangaReadingEntry<ChapterSummary>({
      apiBaseUrl,
      mangaId,
      navigate: (href) => router.push(href),
    })
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const progress = useQuery(mangaProgressOptions(apiBaseUrl, userId, mangaId))
  const local = useLocalReadingHistory(accountReadingScope(userId))
  const guest = useLocalReadingHistory("guest")
  const resumeHref = resumeChapterHref(
    latestProgress([
      ...(progress.data ?? []),
      ...local.filter((entry) => entry.mangaId === mangaId),
      ...guest.filter((entry) => entry.mangaId === mangaId),
    ])
  )

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap">
        {hasChapters ? (
          <Button
            aria-busy={loading === "first"}
            className="h-8! md:h-10!"
            disabled={loading !== null}
            onClick={(event) => openEntry("first", event.currentTarget)}
            size="lg"
          >
            {loading === "first" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ListEndIcon aria-hidden="true" data-icon="inline-start" />
            )}
            Đọc từ đầu
          </Button>
        ) : null}

        {hasChapters ? (
          <Button
            aria-busy={loading === "last"}
            className="h-8! md:h-10!"
            disabled={loading !== null}
            onClick={(event) => openEntry("last", event.currentTarget)}
            size="lg"
          >
            {loading === "last" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ListStartIcon aria-hidden="true" data-icon="inline-start" />
            )}
            Đọc mới nhất
          </Button>
        ) : null}
      </div>

      {resumeHref ? (
        <Link
          className={buttonVariants({
            size: "lg",
            variant: "secondary",
            className: "h-8! w-full md:h-10! md:w-auto",
          })}
          href={resumeHref}
        >
          <BookOpenIcon aria-hidden="true" data-icon="inline-start" />
          Đọc tiếp
        </Link>
      ) : null}

      {choice ? (
        <ChapterReleaseDialog
          title={choice.position === "first" ? "Đọc từ đầu" : "Đọc mới nhất"}
          mangaId={mangaId}
          releases={choice.releases}
          finalChapter={finalChapter}
          finalFocus={trigger}
          onClose={closeChoice}
        />
      ) : null}
    </>
  )
}
