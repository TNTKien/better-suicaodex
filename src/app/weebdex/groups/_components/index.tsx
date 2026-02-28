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
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import PaginationControl from "@/components/Custom/pagination-control";
import { generateSlug } from "@/lib/utils";
import {
  getGroup,
  getGroupResponseSuccess,
} from "@/lib/weebdex/hooks/scanlation-group/scanlation-group";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { ArrowRight, BugIcon, Search, Users, X } from "lucide-react";

interface GroupsSearchProps {
  page: number;
  q: string;
}

const LIMIT = 100;

export default function GroupsSearch({ page, q }: GroupsSearchProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(q);
  const [debouncedQuery] = useDebounceValue(inputValue, 500);

  // When debounced query stabilises and differs from URL, update URL (reset to page 1)
  useEffect(() => {
    if (debouncedQuery === q) return;
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    router.push(`/weebdex/groups${params.size ? `?${params}` : ""}`);
  }, [debouncedQuery, q, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["weebdex", "groups", debouncedQuery, page],
    queryFn: async () => {
      const res = await getGroup({
        name: debouncedQuery || undefined,
        limit: LIMIT,
        page,
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
    router.push("/weebdex/groups");
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
              href={`/weebdex/group/${group.id}/${generateSlug(group.name ?? "")}`}
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
          onChange={(e) => setInputValue(e.target.value)}
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
          currentPage={page}
          totalPages={totalPages}
          createHref={(p) => {
            const params = new URLSearchParams();
            if (debouncedQuery) params.set("q", debouncedQuery);
            if (p > 1) params.set("page", String(p));
            return `/weebdex/groups${params.size ? `?${params}` : ""}`;
          }}
          className="mt-4"
        />
      )}
    </>
  );
}
