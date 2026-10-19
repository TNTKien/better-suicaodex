"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { tz } from "@date-fns/tz"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { components } from "@/src/lib/generated/api"
import { hvnAvatarSrc } from "@/lib/avatar"

export type RecentComment = components["schemas"]["RecentComment"]

export function RecentComments({
  comments,
  error = false,
  loading = false,
  variant = "home",
}: {
  comments: RecentComment[]
  error?: boolean
  loading?: boolean
  variant?: "home" | "profile"
}) {
  const router = useRouter()
  return (
    <section
      aria-labelledby="recent-comments-heading"
      className="min-w-0 border border-[#666666] bg-black p-0.5 text-white"
    >
      <h2
        id="recent-comments-heading"
        className={
          variant === "profile"
            ? "hvn-login-heading hvn-login-heading-info"
            : "hvn-home-heading"
        }
        data-kind={variant === "home" ? "comments" : undefined}
      >
        Bình luận mới
      </h2>
      {loading ? (
        <div
          role="status"
          aria-label="Đang tải bình luận mới"
          className="flex flex-col gap-3 p-1 pt-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm">
          <p role="alert">Không thể tải bình luận mới.</p>
          <Button
            className="hvn-button"
            size="sm"
            onClick={() => router.refresh()}
          >
            Thử lại
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm">Chưa có bình luận nào.</p>
      ) : (
        <ul className="flex flex-col gap-2 p-1 pt-3">
          {comments.map((comment) => {
            const avatar = hvnAvatarSrc(comment.author.image)
            const href = comment.chapter
              ? `/chapter/${comment.chapter.id}`
              : `/manga/${comment.manga.id}/${comment.manga.slug}`
            return (
              <li key={comment.id} className="min-w-0">
                <div className="flex items-start gap-2 px-0.5 pb-3">
                  <Link
                    href={`/profile/${comment.author.id}`}
                    prefetch={false}
                    aria-label={`Tường nhà ${comment.author.name}`}
                    className="shrink-0"
                  >
                    <AssetImage
                      key={avatar}
                      src={avatar}
                      fallbackSrc="/brand/mac_dinh.webp"
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 border border-[#666666] object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${comment.author.id}`}
                      prefetch={false}
                      className="block truncate font-bold text-[#00bfff] hover:underline"
                      title={comment.author.name}
                    >
                      {comment.author.name}
                    </Link>
                    <Link
                      href={href}
                      prefetch={false}
                      className="mt-1 block text-sm leading-[1.2]"
                    >
                      <p className="line-clamp-3 wrap-anywhere whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </Link>
                  </div>
                </div>
                <div className="min-w-0 bg-[#444444] px-1.5 py-0.5 text-sm italic">
                  {variant === "profile" ? (
                    <time
                      dateTime={comment.createdAt}
                      className="mb-0.5 block text-xs"
                    >
                      {format(
                        parseISO(comment.createdAt),
                        "HH:mm:ss - dd/MM/yyyy",
                        { in: tz("Asia/Ho_Chi_Minh") }
                      )}
                    </time>
                  ) : null}
                  <div className="flex min-w-0 items-center gap-3">
                    <time
                      dateTime={comment.createdAt}
                      suppressHydrationWarning
                      className="shrink-0"
                    >
                      {formatDistanceToNowStrict(parseISO(comment.createdAt), {
                        addSuffix: true,
                        locale: vi,
                        in: tz("Asia/Ho_Chi_Minh"),
                      })}
                    </time>
                    <Link
                      href={href}
                      prefetch={false}
                      title={comment.manga.title}
                      className="min-w-0 truncate text-[#00bfff] hover:underline"
                    >
                      {comment.manga.title}
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
