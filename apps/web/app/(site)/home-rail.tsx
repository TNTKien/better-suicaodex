import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import type { RecentComment } from "@/lib/api"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import type { GroupRanking } from "@/modules/groups/ranking"
import type { MangaRanking } from "@/modules/manga/ranking"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { HomeMangaRanking } from "./home-manga-ranking"
import { HomeGroupRanking } from "./home-group-ranking"
import { HomeHistory } from "./home-history"
import { buttonVariants } from "@workspace/ui/components/button"

function RailHeading({
  children,
  href,
  id,
}: {
  children: string
  href?: string
  id: string
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="section-heading text-2xl" id={id}>
        {children}
      </h2>
      {href ? (
        <Link
          aria-label={`Xem thêm ${children.toLocaleLowerCase("vi")}`}
          className={buttonVariants({ variant: "secondary", size: "icon-sm" })}
          href={href}
          prefetch={false}
        >
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  )
}

export function HomeRail({
  apiBaseUrl,
  comments,
  initialGroupRanking,
  initialMangaRanking,
}: {
  apiBaseUrl: string
  comments: RecentComment[]
  initialGroupRanking: GroupRanking
  initialMangaRanking: MangaRanking
}) {
  return (
    <aside
      aria-label="Thông tin trang chủ"
      className="flex min-w-0 flex-col gap-8"
    >
      <section
        aria-labelledby="home-history-heading"
        className="flex flex-col gap-3"
      >
        <RailHeading href="/history" id="home-history-heading">
          Lịch sử đọc
        </RailHeading>
        <HomeHistory />
      </section>

      <section
        aria-labelledby="home-comments-heading"
        className="flex flex-col gap-3"
      >
        <RailHeading id="home-comments-heading">Bình luận mới</RailHeading>
        <div className="flex flex-col divide-y divide-border">
          {comments.map((comment) => {
            const href = comment.chapter
              ? `/chapter/${comment.chapter.id}`
              : `/manga/${comment.manga.id}/${comment.manga.slug}`

            return (
              <article key={comment.id} className="flex gap-2.5 py-3">
                <AvatarDecoration frame={comment.author.avatarFrame ?? null}>
                  <Avatar className="mt-0.5 size-10 overflow-hidden">
                    {comment.author.image ? (
                      <AvatarImage alt="" src={comment.author.image} />
                    ) : null}
                    <AvatarFallback className="text-xs font-semibold">
                      {comment.author.name.slice(0, 2).toLocaleUpperCase("vi")}
                    </AvatarFallback>
                  </Avatar>
                </AvatarDecoration>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {comment.author.name}
                    </p>
                    <time
                      className="shrink-0 text-[0.6875rem] text-muted-foreground"
                      dateTime={comment.createdAt}
                    >
                      {formatDistanceToNowStrict(parseISO(comment.createdAt), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-snug wrap-break-word whitespace-pre-wrap">
                    {comment.body}
                  </p>
                  <Link
                    className="mt-1.5 block truncate text-xs text-muted-foreground hover:text-primary"
                    href={href}
                    prefetch={false}
                  >
                    {comment.manga.title}
                    {comment.chapter?.number
                      ? ` · Ch. ${comment.chapter.number}`
                      : ""}
                  </Link>
                </div>
              </article>
            )
          })}
          {comments.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Chưa có bình luận.
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="home-manga-ranking-heading"
        className="flex flex-col gap-3"
      >
        <RailHeading id="home-manga-ranking-heading">BXH truyện</RailHeading>
        <HomeMangaRanking
          apiBaseUrl={apiBaseUrl}
          initialRanking={initialMangaRanking}
        />
      </section>

      <section
        aria-labelledby="home-group-ranking-heading"
        className="flex flex-col gap-3"
      >
        <RailHeading id="home-group-ranking-heading">BXH nhóm dịch</RailHeading>
        <HomeGroupRanking
          apiBaseUrl={apiBaseUrl}
          initialRanking={initialGroupRanking}
        />
      </section>
    </aside>
  )
}
