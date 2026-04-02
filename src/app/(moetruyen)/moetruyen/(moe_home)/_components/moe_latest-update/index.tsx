"use client";

import { useMounted } from "@mantine/hooks";
import { ArrowRight, BugIcon } from "lucide-react";
import Link from "next/link";

import PaginationControl from "@/components/common/pagination-control";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { siteConfig } from "@/config/site";
import { useGetV2Manga } from "@/lib/moetruyen/hooks/manga/manga";

import MoeLatestMangaCard from "./moe-latest-manga-card";
import MoeLatestSkeletonCard from "./moe-latest-skeleton-card";

const LIMIT = 36;

interface MoeLatestUpdateProps {
  page?: number;
  showHeader?: boolean;
  showExternalLink?: boolean;
  showPagination?: boolean;
}

export default function MoeLatestUpdate({
  page = 1,
  showHeader = true,
  showExternalLink = true,
  showPagination = false,
}: MoeLatestUpdateProps) {
  const isMounted = useMounted();

  const { data, isLoading, error } = useGetV2Manga(
    {
      limit: LIMIT,
      page,
      sort: "updated_at",
      include: "stats",
    },
    {
      query: {
        enabled: isMounted,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  );

  if (!isMounted || isLoading) {
    return (
      <div className="flex flex-col">
        {showHeader ? (
          <>
            <hr className="h-1 w-9 border-none bg-primary" />
            <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
          </>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <MoeLatestSkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || data?.status !== 200 || !data.data.data.length) {
    return (
      <Empty className="mt-4 h-full bg-muted/30">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BugIcon />
          </EmptyMedia>
          <EmptyTitle>Lỗi mất rồi 🤪</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Có lỗi xảy ra, thử F5 xem sao nhé
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const totalPages = data.data.meta.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col">
      {showHeader ? (
        <div className="flex justify-between gap-4">
          <div>
            <hr className="w-9 h-1 bg-primary border-none" />
            <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
          </div>

          {showExternalLink ? (
            <Button
              asChild
              size="icon"
              variant="secondary"
              className="[&_svg]:size-5"
            >
              <Link href="/moetruyen/latest" prefetch={false}>
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {data.data.data.map((manga) => (
          <MoeLatestMangaCard key={manga.id} manga={manga} />
        ))}
      </div>

      {showPagination && totalPages > 1 ? (
        <PaginationControl
          currentPage={page}
          totalPages={totalPages}
          createHref={(targetPage) => `/moetruyen/latest?page=${targetPage}`}
          className="mt-4"
        />
      ) : null}
    </div>
  );
}
