"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import NoPrefetchLink from "@/components/common/no-prefetch-link";
import PaginationControl from "@/components/common/pagination-control";
import { generateSlug } from "@/lib/utils";
// import {
//   getGroup,
//   getGroupResponseSuccess,
// } from "@/lib/weebdex/hooks/scanlation-group/scanlation-group";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { ArrowRight, BugIcon, Search, Users, X } from "lucide-react";
import { getGroup, getGroupResponseSuccess } from "@/lib/weebdex/hooks/group/group";

const LIMIT = 100;

export default function GroupsSearch() {
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
    if (page < 1) setPage(1);
  }, [page, setPage]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["weebdex", "groups", debouncedQuery, safePage],
    queryFn: async () => {
      const res = await getGroup({
        name: debouncedQuery || undefined,
        limit: LIMIT,
        page: safePage,
      });
      if (res.status !== 200) throw new Error("Failed to fetch groups");
      return (res as getGroupResponseSuccess).data;
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

  const handleClear = () => {
    setInputValue("");
    setPage(null);
  };

  const renderResults = () => {
    if (isLoading)
      return (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 36 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-sm" />
          ))}
        </div>
      );

    if (error || !data)
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

    if ((data.data ?? []).length === 0)
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

    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.data!.map((group) => (
          <Button
            asChild
            key={group.id}
            className="rounded-sm justify-start px-4! whitespace-normal! break-all! shrink!"
            variant="secondary"
            size="lg"
          >
            <NoPrefetchLink
              href={`/group/${group.id}/${generateSlug(group.name ?? "")}`}
            >
              <Users />
              <span className="line-clamp-1 break-all">{group.name}</span>
            </NoPrefetchLink>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="relative w-full">
        <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="bg-secondary pl-7 w-full h-10 pr-10"
          placeholder="Nhập từ khóa..."
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value || null);
            setPage(null);
          }}
        />
        <Button
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary rounded-sm size-8"
          onClick={inputValue ? handleClear : undefined}
        >
          {inputValue ? <X /> : <ArrowRight />}
        </Button>
      </div>

      <div className="mt-4 w-full">{renderResults()}</div>

      {totalPages >= 1 && (
        <PaginationControl
          currentPage={safePage}
          totalPages={totalPages}
          createHref={(p) => {
            const params = new URLSearchParams();
            if (debouncedQuery) params.set("q", debouncedQuery);
            if (p > 1) params.set("page", String(p));
            return `/groups${params.size ? `?${params}` : ""}`;  
          }}
          className="mt-4"
        />
      )}
    </>
  );
}
