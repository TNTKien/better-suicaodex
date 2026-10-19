import Link from "next/link"
import { cover256, coverSrcSet } from "@workspace/catalog/images"
import type { ReactNode } from "react"
import { BookmarkIcon, EyeIcon, MessagesSquareIcon } from "lucide-react"

import { AssetImage } from "@/components/asset-image"
import type { MangaDetail } from "@/lib/api"
import {
  generateFaviconUrl,
  mangaContentRatingLabel,
  mangaStatusLabel,
} from "@/lib/catalog"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { MangaDescription } from "./manga-description"
import { MangaTabs } from "./manga-tabs"
import { MangaTitle } from "./manga-title"

export type MangaView = Omit<MangaDetail, "publishedAt"> & {
  publishedAt: MangaDetail["publishedAt"] | null
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const statisticItems = [
  { value: "views", label: "Lượt xem", icon: EyeIcon },
  { value: "follows", label: "Theo dõi", icon: BookmarkIcon },
  { value: "comments", label: "Bình luận", icon: MessagesSquareIcon },
] as const

function MangaStatistics({
  className,
  statistics,
}: {
  className?: string
  statistics: MangaView["statistics"]
}) {
  return (
    <div
      aria-label="Thống kê truyện"
      className={cn(
        "flex flex-wrap items-center gap-4 text-sm font-medium md:text-base",
        className
      )}
    >
      {statisticItems.map(({ icon: StatisticIcon, label, value }) => (
        <span
          aria-label={`${statistics[value].toLocaleString("vi-VN")} ${label.toLocaleLowerCase("vi")}`}
          className="inline-flex items-center gap-1.5"
          key={value}
          title={label}
        >
          <StatisticIcon aria-hidden="true" className="size-4" />
          {statistics[value] === 0
            ? "N/A"
            : compactNumber.format(statistics[value])}
        </span>
      ))}
    </div>
  )
}

function MetadataBadges({
  hrefPrefix,
  label,
  values,
}: {
  hrefPrefix?: "artist" | "author" | "group" | "tag"
  label: string
  values: Array<{ id: string; name: string; slug?: string }>
}) {
  if (values.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-heading text-base font-semibold">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const href =
            hrefPrefix && value.slug
              ? `/${hrefPrefix}/${encodeURIComponent(value.id)}/${encodeURIComponent(value.slug)}`
              : undefined

          return (
            <Link
              key={value.id}
              href={href ?? "#"}
              prefetch={false}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {value.name}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function MangaHero({
  actions,
  manga,
}: {
  actions: ReactNode
  manga: MangaView
}) {
  const coverWidth = manga.cover?.width ?? 700
  const coverHeight = manga.cover?.height ?? 1_000
  const alternativeTitles = [
    ...new Set(Object.values(manga.alternativeTitles).flat()),
  ].filter((title) => title !== manga.title)
  const creators = [...manga.authors, ...manga.artists]
    .map(({ name }) => name)
    .filter((name, index, names) => names.indexOf(name) === index)

  return (
    <section className="relative">
      <div className="relative mx-auto grid max-w-480 grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-5 px-4 pt-6 pb-8 [grid-template-areas:'cover_title'_'actions_actions'_'info_info'] sm:grid-cols-[10rem_minmax(0,1fr)] sm:px-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-6 md:gap-y-3 md:pt-8 md:[grid-template-areas:'cover_title'_'cover_actions'_'cover_info']">
        <div className="self-start overflow-hidden drop-shadow-md [grid-area:cover]">
          <AssetImage
            alt={`Bìa truyện ${manga.title}`}
            className="aspect-5/7 h-auto w-full rounded-md object-cover drop-shadow-md"
            eager
            height={coverHeight}
            src={manga.cover?.url ?? null}
            srcSet={coverSrcSet(manga.cover)}
            sizes="(min-width: 768px) 208px, (min-width: 640px) 160px, 128px"
            width={coverWidth}
          />
        </div>

        <header className="flex min-w-0 flex-col justify-between gap-4 drop-shadow-md [grid-area:title] md:min-h-64">
          <div className="flex min-w-0 flex-col gap-2">
            <MangaTitle>{manga.title}</MangaTitle>
            {alternativeTitles[0] ? (
              <p className="line-clamp-2 text-sm sm:text-base md:text-lg">
                {alternativeTitles[0]}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {creators.length > 0 ? (
              <p className="line-clamp-2 text-sm font-medium sm:text-base md:line-clamp-1 md:text-lg">
                {creators.join(", ")}
              </p>
            ) : null}
            <MangaStatistics
              className="md:hidden"
              statistics={manga.statistics}
            />
          </div>
        </header>

        <div className="flex flex-wrap gap-2 [grid-area:actions]">
          {actions}
        </div>

        <div className="flex flex-col gap-2 [grid-area:info]">
          <div className="flex flex-wrap gap-2" aria-label="Thông tin nhanh">
            <Badge className="h-3.75 w-fit rounded-sm px-1.5 py-0 text-[0.625rem] font-bold uppercase md:h-4">
              {mangaStatusLabel(manga.status)}
            </Badge>
            {manga.contentRating === "erotica" ? (
              <Badge
                variant="destructive"
                className="h-3.75 w-fit rounded-sm px-1.5 py-0 text-[0.625rem] font-bold uppercase md:h-4"
              >
                {mangaContentRatingLabel(manga.contentRating)}
              </Badge>
            ) : null}
            {manga.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="h-3.75 w-fit rounded-sm px-1.5 py-0 text-[0.625rem] font-bold uppercase md:h-4"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
          <MangaStatistics
            className="hidden md:flex"
            statistics={manga.statistics}
          />
        </div>
      </div>
    </section>
  )
}

function MangaMetadata({
  className,
  manga,
}: {
  className?: string
  manga: MangaView
}) {
  const alternativeTitles = [
    ...new Set(Object.values(manga.alternativeTitles).flat()),
  ].filter((title) => title !== manga.title)

  return (
    <aside
      aria-label="Thông tin truyện"
      className={cn("flex flex-col gap-5", className)}
    >
      <div className="flex flex-wrap gap-4">
        <MetadataBadges
          hrefPrefix="author"
          label="Tác giả"
          values={manga.authors}
        />
        <MetadataBadges
          hrefPrefix="artist"
          label="Họa sĩ"
          values={manga.artists}
        />
      </div>
      <MetadataBadges hrefPrefix="tag" label="Thể loại" values={manga.tags} />
      <MetadataBadges
        hrefPrefix="group"
        label="Nhóm dịch"
        values={manga.groups}
      />

      {manga.links.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-base font-semibold">Liên kết</h3>
          <div className="flex flex-wrap gap-2">
            {manga.links.map((link) => (
              <a
                className={buttonVariants({ size: "sm", variant: "secondary" })}
                href={link.url}
                key={link.key}
                rel="noopener noreferrer"
                target="_blank"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Tiny remote favicon does not need image optimization. */}
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  data-icon="inline-start"
                  height={12}
                  src={generateFaviconUrl(link.url, 16)}
                  width={12}
                />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {alternativeTitles.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-base font-semibold">Tên khác</h3>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {alternativeTitles.map((title) => (
              <li className="wrap-break-word" key={title}>
                {title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}

export function MangaDetailView({
  actions,
  chapters,
  comments,
  manga,
  recommendations,
}: {
  actions: ReactNode
  chapters: ReactNode
  comments: ReactNode
  manga: MangaView
  recommendations: ReactNode
}) {
  const coverWidth = manga.cover?.width ?? 700
  const coverHeight = manga.cover?.height ?? 1_000

  return (
    <article className="relative isolate overflow-hidden">
      {manga.cover ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-192 overflow-hidden bg-background sm:h-208 md:h-224 lg:h-192"
        >
          <AssetImage
            alt=""
            className="size-full scale-105 object-cover object-[center_25%] blur-[1px] md:blur-xs"
            eager
            height={coverHeight}
            src={cover256(manga.cover.url)}
            width={coverWidth}
          />
          <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-r from-background/70 via-background/25 to-background/10 sm:h-64 md:h-72" />
          <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-t from-background via-background/50 to-background/10 sm:h-64 md:hidden md:h-72" />
          <div className="absolute inset-x-0 top-56 bottom-0 bg-linear-to-b from-background via-background/90 to-background backdrop-blur-2xl sm:top-64 md:top-72 md:from-background/80" />
        </div>
      ) : null}

      <MangaHero actions={actions} manga={manga} />

      <div className="mx-auto flex max-w-480 flex-col gap-7 px-4 pb-7 sm:px-6 sm:pb-9">
        <section aria-labelledby="description-heading">
          <h2 className="sr-only" id="description-heading">
            Tóm tắt và thông tin truyện
          </h2>
          <MangaDescription mobileDetails={<MangaMetadata manga={manga} />}>
            {manga.description ?? ""}
          </MangaDescription>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
          <MangaMetadata className="hidden lg:flex" manga={manga} />
          <MangaTabs
            chapters={chapters}
            comments={comments}
            recommendations={recommendations}
          />
        </div>
      </div>
    </article>
  )
}
