import Link from "next/link"
import {
  BadgeCheckIcon,
  CalendarIcon,
  CrownIcon,
  MessageSquareIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Badge } from "@workspace/ui/components/badge"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@workspace/ui/components/empty"
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date"
import type { PublicProfile } from "./api"
import { cn } from "@workspace/ui/lib/utils"
import {
  AvatarDecoration,
  type AvatarDecorationFrame,
} from "@/modules/avatar-frames/avatar-decoration"

export function ProfileLayout({
  title,
  bannerImage = "/images/frieren.webp",
  children,
}: {
  title: string
  bannerImage?: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="relative isolate bg-card pb-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-cover bg-position-[center_33%]"
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

export function ProfileHeader({
  profile,
  avatarFrame = null,
  avatarShape = "square",
  bio,
  children,
}: {
  profile: Pick<PublicProfile, "name" | "image">
  avatarFrame?: AvatarDecorationFrame
  avatarShape?: "square" | "circle"
  bio?: string | null
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
      <div className="-mt-10 w-fit shrink-0 sm:-mt-12">
        <ProfileAvatar
          name={profile.name}
          image={profile.image}
          avatarFrame={avatarFrame}
          shape={avatarShape}
          className="size-28 sm:size-36"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
        <h1 className="text-3xl font-black tracking-tight wrap-anywhere sm:text-4xl">
          {profile.name || "Độc giả"}
        </h1>
        {children}
        <p className="wrap-anywhere whitespace-pre-wrap text-muted-foreground">
          {bio || "Chưa có giới thiệu."}
        </p>
      </div>
    </header>
  )
}

export function ProfileDetailGrid({
  className,
  details,
}: {
  className?: string
  details: { label: string; value: React.ReactNode; icon: LucideIcon }[]
}) {
  return (
    <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {details.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="relative flex min-w-0 flex-col gap-1 rounded-md bg-muted/60 p-4 pl-12"
        >
          <dt className="text-xs font-semibold tracking-wider uppercase">
            <Icon
              aria-hidden="true"
              className="absolute top-4 left-4 size-5 text-primary"
            />
            {label}
          </dt>
          <dd className="text-sm wrap-anywhere text-muted-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ProfileAvatar({
  name,
  image,
  large = false,
  className,
  avatarFrame = null,
  animateFrame = true,
  shape = "square",
}: {
  name: string
  image?: string | null
  large?: boolean
  className?: string
  avatarFrame?: AvatarDecorationFrame
  animateFrame?: boolean
  shape?: "square" | "circle"
}) {
  return (
    <AvatarDecoration frame={avatarFrame} animate={animateFrame}>
      <Avatar
        className={cn(
          large ? "size-20" : undefined,
          "rounded-md after:rounded-md",
          className,
          shape === "circle" &&
            "overflow-hidden rounded-full after:rounded-full"
        )}
      >
        <AvatarImage
          src={image ?? undefined}
          alt=""
          className={shape === "circle" ? "rounded-full" : "rounded-md"}
          referrerPolicy="no-referrer"
        />
        <AvatarFallback
          className={shape === "circle" ? "rounded-full" : "rounded-md"}
        >
          {name.trim().slice(0, 1).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
    </AvatarDecoration>
  )
}

export function ProfileSummary({ profile }: { profile: PublicProfile }) {
  return (
    <>
      <ProfileHeader
        profile={profile}
        avatarShape="circle"
        avatarFrame={profile.avatarFrame ?? null}
        bio={profile.bio}
      >
        {profile.verified || profile.groups.some((group) => group.isLeader) ? (
          <div className="flex flex-wrap gap-2">
            {profile.verified ? (
              <Badge variant="secondary">
                <BadgeCheckIcon aria-hidden="true" data-icon="inline-start" />
                Đã xác minh
              </Badge>
            ) : null}
            {profile.groups
              .filter((group) => group.isLeader)
              .map((group) => (
                <Badge
                  className="h-auto max-w-full whitespace-normal"
                  key={group.id}
                  render={
                    <Link
                      href={`/group/${group.id}/${group.slug}`}
                      prefetch={false}
                    />
                  }
                  variant="destructive"
                >
                  <CrownIcon aria-hidden="true" data-icon="inline-start" />
                  Leader {group.name}
                </Badge>
              ))}
          </div>
        ) : null}
      </ProfileHeader>
      <ProfileDetailGrid
        className="mt-6 md:grid-cols-3"
        details={[
          {
            label: "Ngày tham gia",
            icon: CalendarIcon,
            value: formatVietnamDate(profile.createdAt),
          },
          {
            label: "Đã bình luận",
            icon: MessageSquareIcon,
            value: profile.commentCount.toLocaleString("vi-VN"),
          },
          {
            label: "Nhóm dịch",
            icon: UsersIcon,
            value: profile.groups.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.groups.map((group) => (
                  <Badge
                    key={group.id}
                    variant="secondary"
                    className="h-auto max-w-full whitespace-normal"
                  >
                    {group.name}
                  </Badge>
                ))}
              </div>
            ) : (
              "Chưa tham gia nhóm dịch."
            ),
          },
        ]}
      />
      <section className="mt-6 flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Bình luận gần đây</h2>
        {profile.recentComments.length ? (
          profile.recentComments.map((comment) => (
            <article
              key={comment.id}
              className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={
                    comment.chapter
                      ? `/chapter/${comment.chapter.id}`
                      : `/manga/${comment.manga.id}/${comment.manga.slug}`
                  }
                  prefetch={false}
                  className="min-w-0 font-semibold wrap-anywhere text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {comment.manga.title}
                  {comment.chapter
                    ? ` - ${comment.chapter.number ? `Ch. ${comment.chapter.number}` : comment.chapter.title || "Oneshot"}`
                    : ""}
                </Link>
                <time
                  dateTime={comment.createdAt}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatVietnamDateTime(comment.createdAt)}
                </time>
              </div>
              <p className="text-sm wrap-anywhere whitespace-pre-wrap">
                {comment.body}
              </p>
            </article>
          ))
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Chưa có bình luận công khai</EmptyTitle>
              <EmptyDescription>
                Bình luận của độc giả sẽ xuất hiện tại đây khi có nội dung được
                hiển thị công khai.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </>
  )
}

export function PublicProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải trang cá nhân"
      className="flex flex-col gap-6"
    >
      <ProfileHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-56 max-w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
      <div className="-mt-10 w-fit shrink-0 sm:-mt-12">
        <Skeleton className="size-28 rounded-full sm:size-36" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div
      aria-label="Đang tải thông tin tài khoản"
      role="status"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
