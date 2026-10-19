"use client"

import { PrefetchLink } from "@workspace/ui/components/prefetch-link"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { tz } from "@date-fns/tz"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { cover256 } from "@workspace/catalog/images"

import { AssetImage } from "@workspace/ui/components/asset-image"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { MangaSummary } from "./api"
import { ArrowRightIcon } from "lucide-react"
import { MangaCard } from "@/modules/manga/manga-card"

export { MangaCard } from "@/modules/manga/manga-card"

const vietnamTimeZone = tz("Asia/Ho_Chi_Minh")

function RecentMangaCard({ manga }: { manga: MangaSummary }) {
  const href = `/manga/${manga.id}/${manga.slug}`
  const chapter = manga.latestChapter
  const publishedAt = chapter ? parseISO(chapter.publishedAt) : null

  return (
    <article className="flex min-w-0 gap-2.5 bg-[#2b2b2b] p-2.5">
      <PrefetchLink
        href={href}
        className="relative h-28 w-20 shrink-0 overflow-hidden border border-white/35"
      >
        <AssetImage
          alt={`Bìa truyện ${manga.title}`}
          src={cover256(manga.cover?.url ?? null)}
          width={manga.cover?.width ?? 700}
          height={manga.cover?.height ?? 1000}
          className="absolute inset-0 size-full object-cover"
        />
      </PrefetchLink>
      <div className="flex min-w-0 flex-1 flex-col justify-evenly gap-1 text-sm">
        <h3 className="line-clamp-2 text-lg font-bold text-[#3293ed]">
          <PrefetchLink
            href={href}
            title={manga.title}
            className="hover:underline"
          >
            {manga.title}
          </PrefetchLink>
        </h3>
        {chapter ? (
          <Link
            href={`/chapter/${chapter.id}`}
            prefetch={false}
            className="w-fit font-semibold hover:underline"
          >
            {chapter.number ? `Ch. ${chapter.number}` : "Oneshot"}
          </Link>
        ) : (
          <p>Chưa có chương</p>
        )}
        <p className="line-clamp-1 text-white/75">
          <span className="font-semibold">Giờ đăng:</span>{" "}
          {publishedAt && chapter ? (
            <time dateTime={chapter.publishedAt} suppressHydrationWarning>
              {`${format(publishedAt, "HH:mm", { in: vietnamTimeZone })} (${formatDistanceToNowStrict(publishedAt, { addSuffix: true, locale: vi, in: vietnamTimeZone })})`}
            </time>
          ) : (
            "Chưa rõ"
          )}
        </p>
      </div>
    </article>
  )
}

function RandomMangaCard({ manga }: { manga: MangaSummary }) {
  const href = `/manga/${manga.id}/${manga.slug}`
  return (
    <article className="flex min-w-0 gap-2.5 bg-[#2b2b2b] p-2.5">
      <PrefetchLink
        href={href}
        className="relative h-28 w-20 shrink-0 overflow-hidden border border-white/35"
      >
        <AssetImage
          alt={`Bìa truyện ${manga.title}`}
          src={cover256(manga.cover?.url ?? null)}
          width={manga.cover?.width ?? 700}
          height={manga.cover?.height ?? 1000}
          className="absolute inset-0 size-full object-cover"
        />
      </PrefetchLink>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="line-clamp-2 text-lg font-bold text-[#3293ed]">
          <PrefetchLink
            href={href}
            title={manga.title}
            className="hover:underline"
          >
            {manga.title}
          </PrefetchLink>
        </h3>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="font-semibold text-[#888888]">Thể loại:</span>
          {manga.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tag/${tag.id}/${tag.slug}`}
              prefetch={false}
              className="rounded-[4px] bg-[#237ec7] px-1 py-0.5 text-xs font-bold text-white hover:bg-[#ae3910]"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>
    </article>
  )
}

export function MangaSection({
  kind,
  manga,
  loading = false,
  error = false,
}: {
  kind: "featured" | "latest" | "recent" | "random"
  manga: MangaSummary[]
  loading?: boolean
  error?: boolean
}) {
  const router = useRouter()
  const featured = kind === "featured"
  const recent = kind === "recent"
  const random = kind === "random"
  const rows = recent || random
  const title = featured
    ? "Thịnh hành"
    : recent
      ? "Truyện mới đăng"
      : random
        ? "Truyện ngẫu nhiên"
        : "Mới cập nhật"
  const Heading = featured ? "h1" : "h2"
  const gridClass = cn(
    "grid gap-2 border border-t-0 border-white/35 p-2",
    rows
      ? "grid-cols-1"
      : featured
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
  )

  return (
    <section
      aria-labelledby={`${kind}-heading`}
      aria-busy={loading}
      className="min-w-0"
    >
      <div className="hvn-home-heading-frame">
        <div
          className="hvn-home-heading flex items-center gap-2"
          data-kind={kind}
        >
          <Heading
            id={`${kind}-heading`}
            className={cn(
              "flex items-center gap-1 font-bold",
              featured && "h-fit! rounded-[4px] bg-white px-1 text-[#1baeee]"
            )}
          >
            {featured && (
              <img
                src="/brand/thinhhanhon.webp"
                alt="Flame"
                className="size-4"
              />
            )}
            {title}
          </Heading>
          {!featured && !random && !loading && !error && manga.length > 0 && (
            <Link
              href={recent ? "/recent" : "/latest"}
              prefetch={false}
              className={buttonVariants({
                size: "xs",
                variant: "ghost",
                className:
                  "hvn-button ml-auto shrink-0 p-0! text-sm! font-medium! hover:bg-transparent! hover:underline!",
              })}
            >
              Xem thêm
              <ArrowRightIcon />
            </Link>
          )}
        </div>
      </div>
      {loading ? (
        <div className={gridClass}>
          <p role="status" className="sr-only">
            Đang tải {title.toLocaleLowerCase("vi")}…
          </p>
          {Array.from(
            { length: featured || recent || random ? 6 : 18 },
            (_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className={cn(
                  "border border-white/35",
                  rows && "flex gap-2.5 p-2.5"
                )}
              >
                <Skeleton
                  className={cn(
                    "rounded-none",
                    rows ? "h-28 w-20 shrink-0" : "aspect-5/7 w-full"
                  )}
                />
                <Skeleton
                  className={cn(
                    "h-10 rounded-none md:h-12",
                    rows ? "flex-1" : "w-full"
                  )}
                />
              </div>
            )
          )}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 border border-white/35 px-4 py-8">
          <p role="alert">
            Không tải được {title.toLocaleLowerCase("vi")}. Vui lòng thử lại.
          </p>
          <Button
            className="hvn-button"
            size="sm"
            onClick={() => router.refresh()}
          >
            Thử lại
          </Button>
        </div>
      ) : manga.length === 0 ? (
        <p className="border border-white/35 px-4 py-8 text-center">
          Chưa có truyện.
        </p>
      ) : (
        <div className={gridClass}>
          {manga.map((item) =>
            recent ? (
              <RecentMangaCard key={item.id} manga={item} />
            ) : random ? (
              <RandomMangaCard key={item.id} manga={item} />
            ) : (
              <MangaCard key={item.id} manga={item} />
            )
          )}
        </div>
      )}
    </section>
  )
}
