"use client";

import NoPrefetchLink from "@/components/common/no-prefetch-link";
import PaginationControl from "@/components/common/pagination-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGetV2MangaByIdChapters } from "@/lib/moetruyen/hooks/manga/manga";
import { getMoeGroupHref } from "@/lib/moetruyen/group-url";
import type { GetV2MangaByIdChapters200DataChaptersItem } from "@/lib/moetruyen/model/getV2MangaByIdChapters200DataChaptersItem";
import { cn, formatNumber, formatTimeToNow } from "@/lib/utils";
import {
  BadgeAlert,
  Clock,
  Eye,
  FileImage,
  KeySquare,
  ListX,
  Loader2,
  Lock,
  MessagesSquare,
  Users,
} from "lucide-react";

const LIMIT = 30;

function getChapterLabel(chapter: GetV2MangaByIdChapters200DataChaptersItem) {
  return `Ch. ${chapter.number ?? chapter.number}`;
}

function getAccessDisplay(
  access: GetV2MangaByIdChapters200DataChaptersItem["access"],
) {
  if (access === "password_required") {
    return {
      Icon: KeySquare,
      label: "Có mật khẩu",
    } as const;
  }

  if (access === "locked") {
    return {
      Icon: Lock,
      label: "Đã khoá",
    } as const;
  }

  return null;
}

export function MoeChapterCard({
  chapter,
}: {
  chapter: GetV2MangaByIdChapters200DataChaptersItem;
}) {
  const isUnavailable = chapter.access !== "public";
  const timestamp = chapter.date;
  const chapterText = `${getChapterLabel(chapter)}${chapter.title ? ` - ${chapter.title}` : ""}`;
  const accessDisplay = getAccessDisplay(chapter.access);
  const AccessIcon = accessDisplay?.Icon;
  const groups = chapter.groups ?? [];
  const card = (
    <Card
      aria-disabled={isUnavailable}
      className={cn(
        "relative flex min-h-14 flex-col justify-between rounded-none px-1.5 py-1.5 shadow-xs",
        "hover:bg-accent/15",
        "border-l-2 border-l-primary",
        isUnavailable && "cursor-not-allowed text-muted-foreground opacity-90",
      )}
    >
      {isUnavailable ? null : (
        <NoPrefetchLink
          suppressHydrationWarning
          href={`/moetruyen/chapter/${chapter.id}`}
          target="_self"
          aria-label={chapterText}
          className="absolute inset-0 z-0"
        >
          <span className="sr-only">{chapterText}</span>
        </NoPrefetchLink>
      )}

      <div className="relative z-10 flex items-center gap-2 pointer-events-none">
        <div className="flex min-w-0 flex-auto items-center space-x-2">
          {AccessIcon ? (
            <AccessIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Eye className="size-4 shrink-0" />
          )}

          <p className="line-clamp-1 break-all text-sm font-semibold md:text-base">
            {chapterText}
          </p>

          {accessDisplay ? (
            <Badge
              variant="secondary"
              className="max-h-4 rounded px-1 py-0 text-[0.625rem] font-bold"
            >
              {accessDisplay.label}
            </Badge>
          ) : null}
        </div>

        {timestamp ? (
          <div className="flex w-40 shrink-0 items-center justify-end gap-2 sm:w-48 md:w-52">
            <div className="flex flex-auto items-center gap-1">
              <Clock size={16} className="shrink-0" />
              <time
                className="line-clamp-1 break-all text-sm font-light"
                dateTime={new Date(timestamp).toISOString()}
              >
                {formatTimeToNow(new Date(timestamp))}
              </time>
            </div>

            <div className="flex w-14 shrink-0 items-center gap-1">
              <Eye size={16} className="shrink-0" />
              <span className="line-clamp-1 break-all text-sm font-light">
                {formatNumber(chapter.viewCount)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center gap-2 pointer-events-none">
        <div className="flex min-w-0 flex-auto items-center space-x-1">
          <Users size={16} className="shrink-0" />

          {groups.length === 0 ? (
            <span className="line-clamp-1 px-1 text-sm font-normal">
              No Group
            </span>
          ) : (
            <div className="flex min-w-0 items-center space-x-1">
              {groups.map((group) => (
                <Button
                  asChild
                  key={group.id}
                  variant="ghost"
                  className="pointer-events-auto whitespace-normal! shrink! font-normal text-start text-sm line-clamp-1 rounded-sm h-auto! py-0! px-1! hover:underline hover:text-primary break-all"
                  size="sm"
                >
                  <NoPrefetchLink href={getMoeGroupHref(group)}>
                    {group.name}
                  </NoPrefetchLink>
                </Button>
              ))}
            </div>
          )}
        </div>

        {chapter.pages || accessDisplay ? (
          <div className="flex w-40 shrink-0 items-center justify-end gap-2 sm:w-48 md:w-52">
            <div className="flex flex-auto items-center gap-1">
              {chapter.pages ? (
                <>
                  <FileImage size={16} className="shrink-0" />
                  <span className="line-clamp-1 break-all text-sm font-light">
                    {chapter.pages} trang
                  </span>
                </>
              ) : AccessIcon && accessDisplay ? (
                <>
                  <AccessIcon size={16} className="shrink-0" />
                  <span className="line-clamp-1 break-all text-sm font-light">
                    {accessDisplay.label}
                  </span>
                </>
              ) : null}
            </div>

            <div className="flex w-14 shrink-0 items-center gap-1 opacity-65">
              <MessagesSquare size={16} className="shrink-0" />
              <span className="text-sm font-light">N/A</span>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );

  if (isUnavailable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent className="select-none">
          Không thể đọc chương này
        </TooltipContent>
      </Tooltip>
    );
  }

  return card;
}

export default function MoeMangaChaptersList({
  mangaId,
  page,
  onPageChange,
}: {
  mangaId: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const currentPage = Math.max(page, 1);
  const { data, isLoading, error } = useGetV2MangaByIdChapters(
    mangaId,
    {
      page: currentPage,
      limit: LIMIT,
    },
    {
      query: {
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  );

  if (isLoading) {
    return (
      <div className="flex h-16 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || data?.status !== 200) {
    return (
      <Empty className="mt-2 h-full bg-muted/30">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BadgeAlert />
          </EmptyMedia>
          <EmptyTitle>Lỗi mất rồi 🤪</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Có lỗi xảy ra, thử F5 xem sao nhé
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const chapters = data.data.data.chapters;
  const totalPages = data.data.meta.pagination?.totalPages ?? 1;
  const resolvedCurrentPage = data.data.meta.pagination?.page ?? currentPage;

  if (chapters.length === 0) {
    return (
      <Empty className="mt-2 h-full bg-muted/30">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX />
          </EmptyMedia>
          <EmptyTitle>Không tìm thấy chương nào</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Truyện này chưa có chương nào để hiển thị
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-col gap-2">
        {chapters.map((chapter) => (
          <MoeChapterCard key={chapter.id} chapter={chapter} />
        ))}
      </div>

      {totalPages > 1 ? (
        <PaginationControl
          currentPage={resolvedCurrentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="mt-2"
        />
      ) : null}
    </>
  );
}
