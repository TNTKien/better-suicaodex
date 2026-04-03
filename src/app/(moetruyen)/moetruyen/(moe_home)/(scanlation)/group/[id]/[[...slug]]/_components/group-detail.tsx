"use client";

import {
  BookOpen,
  BookText,
  type LucideIcon,
  MessageSquareText,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";

import PaginationControl from "@/components/common/pagination-control";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { getV2TeamsByIdManga } from "@/lib/moetruyen/hooks/teams/teams";
import { getMoetruyenBannerCoverUrl } from "@/lib/moetruyen/cover-url";
import type { GetV2TeamsById200Data } from "@/lib/moetruyen/model/getV2TeamsById200Data";
import { GetV2TeamsByIdMangaSort } from "@/lib/moetruyen/model/getV2TeamsByIdMangaSort";
import { cn, formatNumber } from "@/lib/utils";

import GroupMangaCard from "./group-manga-card";

interface GroupDetailProps {
  team: GetV2TeamsById200Data;
}

const detailIcons: Record<string, LucideIcon> = {
  "Thành viên": Users,
  "Tổng truyện": BookOpen,
  "Tổng chapter": BookText,
  "Tổng bình luận": MessageSquareText,
} as const;

export function GroupDetail({ team }: GroupDetailProps) {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const safePage = Math.max(1, page);

  useEffect(() => {
    if (page < 1) {
      void setPage(1);
    }
  }, [page, setPage]);

  const { data, error, isLoading } = useQuery({
    queryKey: ["moetruyen", "team", team.id, "manga", safePage],
    queryFn: async () => {
      const response = await getV2TeamsByIdManga(team.id, {
        page: safePage,
        limit: 36,
        sort: GetV2TeamsByIdMangaSort.updated_at,
        include: "stats,genres",
      });

      if (response.status !== 200) {
        throw new Error("Failed to fetch team manga");
      }

      return response.data;
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const manga = data?.data ?? [];
  const currentPage = data?.meta.pagination?.page ?? safePage;
  const totalPages = data?.meta.pagination?.totalPages ?? 1;
  const coverUrl = team.coverUrl
    ? getMoetruyenBannerCoverUrl(team.coverUrl)
    : "/images/frieren.webp";
  const avatarFallback = team.name.slice(0, 2).toUpperCase();
  const details = [
    { label: "Thành viên", value: formatNumber(team.memberCount) },
    { label: "Tổng truyện", value: formatNumber(team.totalMangaCount) },
    { label: "Tổng chapter", value: formatNumber(team.totalChapterCount) },
    {
      label: "Tổng bình luận",
      value: formatNumber(team.totalCommentCount),
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="absolute top-0 right-0 left-0 z-[-2] block h-70 w-auto">
        <div
          className="absolute h-70 w-full bg-cover bg-no-repeat bg-position-[center_top_33%] transition-[width] duration-150 ease-in-out md:bg-fixed"
          style={{ backgroundImage: `url('${coverUrl}')` }}
        ></div>
        <div className="absolute inset-0 h-70 w-auto pointer-events-none bg-linear-to-r from-background/65 to-transparent backdrop-blur-none md:backdrop-blur-xs"></div>
        <div className="md:hidden absolute inset-0 h-70 w-auto pointer-events-none bg-linear-to-b from-background/5 to-background backdrop-blur-[1px]"></div>
      </div>

      <Card className="-mt-2 relative overflow-hidden rounded-md border-none shadow-sm">
        {/* <LightRays /> */}
        <CardContent className="relative p-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar className="size-24 rounded-md sm:size-28">
                <AvatarImage
                  src={team.avatarUrl ?? "/avatars/doro_think.webp"}
                  alt={team.name}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-md text-2xl font-black">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-3">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold">
                    @{team.slug}
                  </p>
                  <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                    {team.name}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-md!">
                    <Users data-icon="inline-start" />
                    {formatNumber(team.memberCount)} thành viên
                  </Badge>

                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-md!",
                      team.totalMangaCount > 0
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <BookOpen data-icon="inline-start" />
                    {formatNumber(team.totalMangaCount)} truyện
                  </Badge>
                </div>

                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {team.intro?.trim() ?? "Nhóm này chưa có mô tả."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {details.map((detail) => {
                const Icon = detailIcons[detail.label] ?? Sparkles;

                return (
                  <Item key={detail.label} variant="muted">
                    <ItemMedia variant="icon">
                      <Icon className="size-4 text-primary" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="font-semibold uppercase tracking-[0.2em]">
                        {detail.label}
                      </ItemTitle>
                      <ItemDescription className="break-all">
                        {detail.value}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <hr className="h-1 w-9 border-none bg-primary" />
          <h1 className="text-2xl font-black uppercase">Truyện đã đăng</h1>
        </div>

        {error ? (
          <Empty className="bg-muted/30">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>Không tải được danh sách truyện</EmptyTitle>
              <EmptyDescription>
                Có lỗi xảy ra khi tải truyện của nhóm. Thử lại sau nhé.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isLoading && manga.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="aspect-5/7 w-full rounded-sm" />
            ))}
          </div>
        ) : null}

        {!error && manga.length === 0 ? (
          <Empty className="bg-muted/30">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>Chưa có truyện nào</EmptyTitle>
              <EmptyDescription>
                Nhóm này hiện chưa có truyện nào để hiển thị.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : !error ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {manga.map((item) => (
              <GroupMangaCard key={item.id} manga={item} />
            ))}
          </div>
        ) : null}

        {totalPages > 1 ? (
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(targetPage) => {
              if (targetPage <= 1) {
                void setPage(null);
                return;
              }

              void setPage(targetPage);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
