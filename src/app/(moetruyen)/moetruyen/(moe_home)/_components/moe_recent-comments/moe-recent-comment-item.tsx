"use client";

import Link from "next/link";
import { Clock3, MessageSquareText, SwatchBook } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import type { GetV1CommentsRecent200DataItem } from "@/lib/moetruyen/model/getV1CommentsRecent200DataItem";
import { formatShortTime, formatTimeToNow } from "@/lib/utils";

function getCommentHref(comment: GetV1CommentsRecent200DataItem) {
  if (comment.chapter) {
    return `/moetruyen/chapter/${comment.chapter.id}`;
  }

  return `/moetruyen/manga/${comment.manga.id}/${comment.manga.slug}`;
}

function getAuthorFallback(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function MoeRecentCommentItem({
  comment,
}: {
  comment: GetV1CommentsRecent200DataItem;
}) {
  const href = getCommentHref(comment);
  const chapterLabel = comment.chapter?.number
    ? `Ch. ${comment.chapter.number}`
    : comment.chapter
      ? `Ch. ${comment.chapter.number}`
      : null;

  return (
    <Card className="rounded-sm border-none p-3 shadow-xs">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage
            src={comment.author.avatarUrl ?? ""}
            alt={comment.author.name}
          />
          <AvatarFallback>
            {getAuthorFallback(comment.author.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-semibold">
                {comment.author.name}
              </p>
            </div>
          </div>

          <Link href={href} prefetch={false} className="mt-2 block">
            <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
              <p className="line-clamp-3 wrap-break-word">
                {comment.contentPreview}
              </p>
            </div>
          </Link>

          <div className="mt-2 flex items-center justify-between gap-1 text-sm text-muted-foreground">
            <Link
              href={href}
              prefetch={false}
              className="mt-0.5 flex items-center gap-1 line-clamp-1 text-muted-foreground hover:text-primary"
            >
              {comment.createdAt ? (
                <time
                  className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
                  dateTime={comment.createdAt}
                >
                  <span>{formatShortTime(new Date(comment.createdAt))} · </span>
                </time>
              ) : null}
              {/* <SwatchBook className="size-3.5" /> */}

              {comment.manga.title}
              {chapterLabel ? ` · ${chapterLabel}` : ""}
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
