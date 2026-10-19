import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import {
  BookOpenIcon,
  CalendarIcon,
  EyeIcon,
  LinkIcon,
  ListIcon,
  UsersIcon,
} from "lucide-react"
import { Suspense } from "react"

import { MangaCardSkeleton } from "@/components/manga-card"
import { MangaGrid } from "@/components/manga-grid"
import { siteConfig } from "@/config/site"
import { getGroup } from "@/lib/api"
import { groupPath } from "@workspace/catalog/routing"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"
import { getGroupOgImageUrl } from "@/lib/og-image"
import { generateFaviconUrl, isUuid, parsePageNumber } from "@/lib/catalog"
import { formatVietnamDate } from "@/lib/date"
import { ProfileAvatar, ProfileDetailGrid } from "@/modules/account/profile"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CatalogResults } from "../../../catalog-page"

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

type Props = {
  params: Promise<{ id: string; slug?: string[] }>
  searchParams: Promise<{ page?: string | string[] }>
}

function GroupPageLayout({
  bannerImage,
  children,
}: {
  bannerImage: string
  children: React.ReactNode
}) {
  return (
    <section className="relative isolate overflow-hidden bg-card pb-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-cover bg-center"
        style={{ backgroundImage: `url("${bannerImage}")` }}
      >
        <div className="absolute inset-0 bg-background/20" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-card/25 to-card" />
      </div>
      <div className="mx-auto max-w-480 px-4 pt-60 sm:px-6">
        <div className="min-h-[calc(100vh-15rem)] px-1 pb-10 sm:px-4">
          {children}
        </div>
      </div>
    </section>
  )
}

function GroupSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải nhóm dịch"
      className="flex flex-col gap-10"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Skeleton className="-mt-10 size-28 rounded-xl sm:-mt-12 sm:size-36" />
        <div className="flex flex-col gap-3 pb-1">
          <Skeleton className="h-10 w-64 max-w-full sm:h-12" />
          <Skeleton className="h-5 w-80 max-w-full" />
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-md" />
        ))}
      </div>
      <section className="flex flex-col gap-4">
        <Skeleton className="h-8 w-52" />
        <MangaGrid
          className="2xl:[--manga-columns:6]"
          hideIncompleteRow={false}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <MangaCardSkeleton key={index} />
          ))}
        </MangaGrid>
      </section>
    </div>
  )
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params
  const group = isUuid(id) ? await getGroup(id) : null
  if (!group) return { title: "Không tìm thấy nhóm dịch" }
  const canonical = pageHref(
    groupPath(group.id, group.slug),
    pageNumber((await searchParams).page)
  )
  const description =
    group.description?.trim() ||
    `Thông tin nhóm dịch ${group.name} và các bộ truyện của nhóm trên ${siteConfig.name}.`
  const image = {
    url: getGroupOgImageUrl(group.id),
    width: 1200,
    height: 630,
    alt: `Nhóm dịch ${group.name} trên ${siteConfig.name}`,
  }
  return {
    title: group.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: siteConfig.name,
      title: group.name,
      description,
      url: canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: group.name,
      description,
      images: [image],
    },
  }
}
async function GroupContent({ params, searchParams }: Props) {
  const { id, slug } = await params
  if (!isUuid(id)) notFound()
  const group = await getGroup(id)
  if (!group) notFound()
  const path = groupPath(group.id, group.slug)
  if (slug?.length !== 1 || slug[0] !== group.slug || id !== group.id) {
    const page = parsePageNumber((await searchParams).page)
    permanentRedirect(page === 1 ? path : `${path}?page=${page}`)
  }
  const statistics = [
    {
      label: "Ngày thành lập",
      icon: CalendarIcon,
      value: formatVietnamDate(group.createdAt),
    },
    {
      label: "Truyện",
      icon: BookOpenIcon,
      value: compactNumber.format(group.statistics.mangaCount),
    },
    {
      label: "Chương",
      icon: ListIcon,
      value: compactNumber.format(group.statistics.chapterCount),
    },
    {
      label: "Lượt xem",
      icon: EyeIcon,
      value: group.statistics.views
        ? compactNumber.format(Math.round(group.statistics.views))
        : "N/A",
    },
    {
      label: "Trưởng nhóm",
      icon: UsersIcon,
      value: group.leader || "Chưa xác định.",
    },
    {
      label: "Liên hệ",
      icon: LinkIcon,
      value: group.links.length ? (
        <div className="flex flex-wrap gap-2">
          {group.links.map((link) => (
            <a
              key={link.key}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                size: "sm",
                variant: "secondary",
              })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Tiny remote favicon does not need image optimization. */}
              <img
                alt=""
                aria-hidden="true"
                className="size-4 rounded-full"
                data-icon="inline-start"
                height={16}
                src={generateFaviconUrl(link.url, 16)}
                width={16}
              />
              {link.label}
            </a>
          ))}
        </div>
      ) : (
        "Chưa cập nhật."
      ),
    },
  ]
  return (
    <GroupPageLayout
      bannerImage={group.bannerUrl ?? "/images/princess-kokkoro-banner.webp"}
    >
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <ProfileAvatar
          name={group.name}
          image={group.avatarUrl ?? "/images/kokkoro-avt.webp"}
          className="-mt-10 size-28 shrink-0 rounded-xl after:rounded-xl sm:-mt-12 sm:size-36 [&_[data-slot=avatar-fallback]]:rounded-xl [&_[data-slot=avatar-image]]:rounded-xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight wrap-anywhere sm:text-4xl">
              {group.name}
            </h1>
            <Badge variant={group.inactive ? "secondary" : "default"}>
              {group.inactive ? "Ngừng hoạt động" : "Đang hoạt động"}
            </Badge>
          </div>
          <p className="wrap-anywhere whitespace-pre-wrap text-muted-foreground">
            {group.description || "Chưa có giới thiệu."}
          </p>
        </div>
      </header>


      <ProfileDetailGrid className="mt-6 md:grid-cols-3" details={statistics} />

      <section className="mt-6 flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Truyện của nhóm</h2>
        <CatalogResults
          group={[group.id]}
          hasChapter="all"
          path={path}
          searchParams={searchParams}
          sort="latestChapter"
          title={group.name}
        />
      </section>
    </GroupPageLayout>
  )
}
export default function GroupPage(props: Props) {
  return (
    <Suspense
      fallback={
        <GroupPageLayout bannerImage="/images/princess-kokkoro-banner.webp">
          <GroupSkeleton />
        </GroupPageLayout>
      }
    >
      <GroupContent {...props} />
    </Suspense>
  )
}
