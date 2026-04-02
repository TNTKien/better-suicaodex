"use client";

import { useEffect } from "react";

import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BugIcon, Search, Users, X } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";

import NoPrefetchLink from "@/components/common/no-prefetch-link";
import PaginationControl from "@/components/common/pagination-control";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getV2Teams } from "@/lib/moetruyen/hooks/teams/teams";
import { generateSlug } from "@/lib/utils";

const LIMIT = 100;

export default function MoeGroupsSearch() {
  const [inputValue, setInputValue] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, throttleMs: 500 }),
  );
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const safePage = Math.max(1, page);

  const [debouncedQuery] = useDebouncedValue(inputValue, 500);

  useEffect(() => {
    if (page < 1) {
      void setPage(1);
    }
  }, [page, setPage]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["moetruyen", "teams", debouncedQuery, safePage],
    queryFn: async () => {
      const res = await getV2Teams({
        q: debouncedQuery || undefined,
        limit: LIMIT,
        page: safePage,
      });

      if (res.status !== 200) {
        throw new Error("Failed to fetch teams");
      }

      return res.data;
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const totalPages = data?.meta.pagination?.totalPages ?? 0;

  const handleClear = () => {
    void setInputValue("");
    void setPage(null);
  };

  const renderResults = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 36 }).map((_, index) => (
            <Skeleton key={index} className="h-10 rounded-sm" />
          ))}
        </div>
      );
    }

    if (error || !data) {
      return (
        <Empty className="bg-muted/30">
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

    if (data.data.length === 0) {
      return (
        <Empty className="bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Không có kết quả</EmptyTitle>
            <EmptyDescription>Thử tìm với từ khóa khác nhé</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.data.map((team) => (
          <Button
            asChild
            key={team.id}
            className="shrink! justify-start rounded-sm px-4! whitespace-normal! break-all!"
            variant="secondary"
            size="lg"
          >
            <NoPrefetchLink
              href={`/moetruyen/group/${team.id}/${team.slug || generateSlug(team.name)}`}
            >
              <Users />
              <span className="line-clamp-1 break-all">{team.name}</span>
            </NoPrefetchLink>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="relative w-full">
        <Search className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="bg-secondary h-10 w-full pr-10 pl-7"
          placeholder="Nhập từ khóa..."
          autoComplete="off"
          value={inputValue}
          onChange={(event) => {
            void setInputValue(event.target.value || null);
            void setPage(null);
          }}
        />
        <Button
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-sm bg-primary"
          onClick={inputValue ? handleClear : undefined}
        >
          {inputValue ? <X /> : <ArrowRight />}
        </Button>
      </div>

      <div className="mt-4 w-full">{renderResults()}</div>

      {totalPages >= 1 ? (
        <PaginationControl
          currentPage={safePage}
          totalPages={totalPages}
          createHref={(targetPage) => {
            const params = new URLSearchParams();

            if (debouncedQuery) {
              params.set("q", debouncedQuery);
            }

            if (targetPage > 1) {
              params.set("page", String(targetPage));
            }

            return `/moetruyen/groups${params.size ? `?${params}` : ""}`;
          }}
          className="mt-4"
        />
      ) : null}
    </>
  );
}
