"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { compareDesc, formatDistanceToNowStrict, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import { AssetImage } from "@/components/asset-image"
import { cover256 } from "@/lib/catalog"
import { useAccount } from "@/modules/account/provider"
import {
  accountReadingScope,
  type LocalReadingHistoryEntry,
  useLocalReadingHistory,
} from "@/modules/reading/local-history"
import {
  readingHistoryPreviewLimit,
  readingHistoryPreviewOptions,
} from "@/modules/reading/progress"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

type PreviewItem = {
  chapterId: string
  chapterNumber: string | null
  cover: { url: string; width: number | null; height: number | null } | null
  mangaTitle: string
  readAt?: string
}

function latest(items: PreviewItem[]) {
  const sorted = [...items].sort((left, right) => {
    if (!left.readAt) return right.readAt ? 1 : 0
    if (!right.readAt) return -1
    return compareDesc(parseISO(left.readAt), parseISO(right.readAt))
  })
  const unique = new Map<string, PreviewItem>()
  for (const item of sorted)
    if (!unique.has(item.chapterId)) unique.set(item.chapterId, item)
  return [...unique.values()].slice(0, readingHistoryPreviewLimit)
}

function localPreview(entry: LocalReadingHistoryEntry): PreviewItem[] {
  return entry.snapshot
    ? [
        {
          chapterId: entry.chapterId,
          chapterNumber: entry.snapshot.chapter.number,
          cover: entry.snapshot.manga.cover,
          mangaTitle: entry.snapshot.manga.title,
          ...(entry.readAt ? { readAt: entry.readAt } : {}),
        },
      ]
    : []
}

export function HomeHistorySkeleton() {
  return (
    <div aria-label="Đang tải lịch sử đọc" role="status">
      <ItemGroup aria-hidden="true">
        {Array.from({ length: readingHistoryPreviewLimit }, (_, index) => (
          <Item className="flex-nowrap" key={index} variant="muted">
            <ItemMedia variant="image">
              <Skeleton className="size-full rounded-none" />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <Skeleton className="h-4 w-full max-w-44" />
              <Skeleton className="h-4 w-3/5 max-w-28" />
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}

export function HomeHistory() {
  const { apiBaseUrl, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const history = useQuery(readingHistoryPreviewOptions(apiBaseUrl, userId))
  const local = useLocalReadingHistory(accountReadingScope(userId))
  const guest = useLocalReadingHistory("guest")
  const serverItems: PreviewItem[] = (history.data?.data ?? []).map(
    ({ chapter, manga, progress }) => ({
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      cover: manga.cover,
      mangaTitle: manga.title,
      readAt: progress.readAt,
    })
  )
  const localItems = [...local, ...(userId ? guest : [])].flatMap(localPreview)
  const items = latest([
    ...(userId ? serverItems : []),
    ...(userId ? localItems : guest.flatMap(localPreview)),
  ])

  if (status === "loading" || (userId && history.isPending))
    return <HomeHistorySkeleton />

  if (items.length === 0)
    return (
      <p className="py-4 text-sm text-muted-foreground">Chưa có lịch sử đọc.</p>
    )

  return (
    <ItemGroup>
      {items.map((item) => (
        <Item
          key={item.chapterId}
          render={<Link href={`/chapter/${item.chapterId}`} prefetch={false} />}
          className="flex-nowrap shadow-sm"
          variant="muted"
        >
          <ItemMedia variant="image">
            <AssetImage
              alt={`Bìa truyện ${item.mangaTitle}`}
              className="size-full object-cover"
              height={item.cover?.height ?? 400}
              src={cover256(item.cover?.url ?? null)}
              width={item.cover?.width ?? 256}
            />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="line-clamp-1 w-full break-all">
              {item.mangaTitle}
            </ItemTitle>
            <ItemDescription className="line-clamp-1">
              {item.chapterNumber ? `Ch. ${item.chapterNumber}` : "Oneshot"}
              {item.readAt ? (
                <>
                  {" · "}
                  <time dateTime={item.readAt}>
                    {formatDistanceToNowStrict(parseISO(item.readAt), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </time>
                </>
              ) : null}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
