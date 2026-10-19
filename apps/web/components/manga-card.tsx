import { PrefetchLink } from "@workspace/ui/components/prefetch-link"
import { coverSrcSet } from "@workspace/catalog/images"
import Link from "next/link"
import { Fragment } from "react"
import {
  Clock3Icon,
  EyeIcon,
  MessagesSquareIcon,
  UsersIcon,
} from "lucide-react"
import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import { AssetImage } from "@/components/asset-image"
import type { MangaSummary } from "@/lib/api"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

type MangaCardProps = {
  manga: Pick<MangaSummary, "id" | "slug" | "title" | "cover">
  chapter?: MangaSummary["latestChapter"]
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function statistic(value: number) {
  return value === 0 ? "N/A" : compactNumber.format(value)
}

export function MangaCard({ manga, chapter }: MangaCardProps) {
  const groups =
    chapter?.groups.map(({ name }) => name).join(", ") || "Chưa có nhóm dịch"

  return (
    <Card
      className={cn(
        "min-w-0 gap-0 rounded-sm py-0 shadow-sm ring-0",
        !chapter && "bg-transparent"
      )}
    >
      <PrefetchLink
        className={cn(
          "relative block aspect-5/7 w-full overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          !chapter && "rounded-sm"
        )}
        href={`/manga/${manga.id}/${manga.slug}`}
        title={manga.title}
      >
        <AssetImage
          alt={`Bìa truyện ${manga.title}`}
          className="absolute inset-0 size-full object-cover"
          height={manga.cover?.height ?? 1_000}
          src={manga.cover?.url ?? null}
          srcSet={coverSrcSet(manga.cover)}
          sizes="auto, (min-width: 640px) 33vw, 50vw"
          width={manga.cover?.width ?? 700}
        />
        <div className="absolute inset-x-0 bottom-0 flex h-[45%] items-end bg-linear-to-t from-black/85 to-transparent p-2 text-white">
          <h3 className="line-clamp-2 font-heading text-base leading-tight font-semibold wrap-break-word drop-shadow-xs">
            {manga.title}
          </h3>
        </div>
      </PrefetchLink>

      {chapter ? (
        <CardContent className="gap-1 px-2 py-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Link
              className="flex min-w-0 items-center gap-1.5 font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              href={`/chapter/${chapter.id}`}
              prefetch={false}
            >
              <svg
                aria-label="Tiếng Việt"
                className="h-auto w-4 shrink-0"
                focusable="false"
                role="img"
                viewBox="0 0 30 20"
              >
                <path fill="#da251d" d="M0 0h30v20H0z" />
                <path
                  fill="#ff0"
                  d="m15 4 1.347 4.146h4.359l-3.527 2.562 1.348 4.146L15 12.292l-3.527 2.562 1.348-4.146-3.527-2.562h4.359z"
                />
              </svg>
              <span className="truncate">
                {chapter.number ? `Ch. ${chapter.number}` : "Oneshot"}
              </span>
            </Link>
            <span
              className="flex shrink-0 items-center gap-1 text-xs"
              title={`${chapter.statistics.views.toLocaleString("vi-VN")} lượt xem`}
            >
              {statistic(chapter.statistics.views)}
              <EyeIcon aria-hidden="true" className="size-4" />
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <UsersIcon aria-hidden="true" className="size-4 shrink-0" />
            {chapter.groups.length > 0 ? (
              <span className="truncate" title={groups}>
                {chapter.groups.map((group, index) => (
                  <Fragment key={group.id}>
                    {index > 0 ? ", " : null}
                    <Link
                      className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      href={`/group/${encodeURIComponent(group.id)}/${encodeURIComponent(group.slug)}`}
                      prefetch={false}
                    >
                      {group.name}
                    </Link>
                  </Fragment>
                ))}
              </span>
            ) : (
              <span className="truncate">{groups}</span>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <Clock3Icon aria-hidden="true" className="size-4 shrink-0" />
              <time className="truncate" dateTime={chapter.publishedAt}>
                {formatDistanceToNowStrict(parseISO(chapter.publishedAt), {
                  addSuffix: true,
                  locale: vi,
                })}
              </time>
            </span>
            <span
              className="flex shrink-0 items-center gap-1"
              title={`${chapter.statistics.comments.toLocaleString("vi-VN")} bình luận`}
            >
              {statistic(chapter.statistics.comments)}
              <MessagesSquareIcon aria-hidden="true" className="size-4" />
            </span>
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function MangaCardSkeleton({
  withChapter = false,
}: {
  withChapter?: boolean
}) {
  return (
    <Card
      aria-hidden="true"
      className="min-w-0 gap-0 rounded-sm py-0 shadow-none ring-0"
    >
      <div className="relative">
        <Skeleton className="aspect-5/7 w-full rounded-none" />
        <Skeleton className="absolute inset-x-2 bottom-2 h-10" />
      </div>
      {withChapter ? (
        <CardContent className="gap-1 px-2 py-1.5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      ) : null}
    </Card>
  )
}
