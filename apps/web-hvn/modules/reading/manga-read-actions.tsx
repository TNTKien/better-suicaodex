"use client"

import { useRouter } from "next/navigation"
import { useMangaReadingEntry } from "@workspace/account/reading-entry"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Button } from "@workspace/ui/components/button"

import { Spinner } from "@workspace/ui/components/spinner"
import type { components } from "@/src/lib/generated/api"
import { useAccount } from "@/modules/account/provider"
import { ChapterReleaseDialog } from "./chapter-release-dialog"

export function MangaReadActions({
  mangaId,
  hasChapters,
}: {
  mangaId: string
  hasChapters: boolean
}) {
  const router = useRouter()
  const { apiBaseUrl } = useAccount()
  const { loading, choice, trigger, openEntry, closeChoice } =
    useMangaReadingEntry<components["schemas"]["ChapterSummary"]>({
      apiBaseUrl,
      mangaId,
      navigate: (href) => router.push(href),
    })
  return (
    <>
      {(["first", "last"] as const).map((position) => (
        <div className="hvn-login-panel" key={position}>
          <Button
            className="hvn-manga-read"
            data-kind={position === "first" ? "first" : "latest"}
            aria-busy={loading === position}
            disabled={!hasChapters || loading !== null}
            onClick={(event) => openEntry(position, event.currentTarget)}
          >
            {loading === position ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <AssetImage
                src="/brand/doc-online.webp"
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0"
              />
            )}
            {position === "first" ? "ĐỌC ONLINE" : "ĐỌC MỚI NHẤT"}
          </Button>
        </div>
      ))}
      {choice ? (
        <ChapterReleaseDialog
          title={choice.position === "first" ? "Đọc từ đầu" : "Đọc mới nhất"}
          releases={choice.releases}
          finalFocus={trigger}
          onClose={closeChoice}
        />
      ) : null}
    </>
  )
}
