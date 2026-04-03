"use client";

import { useEffect } from "react";

import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  BugIcon,
  CalendarArrowDown,
  ChevronDownIcon,
  MessagesSquare,
  SearchIcon,
  SwatchBook,
  Users,
  X,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getV2Teams } from "@/lib/moetruyen/hooks/teams/teams";
import { generateSlug } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GetV2TeamsSort } from "@/lib/moetruyen/model/getV2TeamsSort";

const LIMIT = 36;

type TeamsSortValue = (typeof GetV2TeamsSort)[keyof typeof GetV2TeamsSort];

const TEAM_SORT_OPTIONS = [
  { value: GetV2TeamsSort.updated_at, label: "Mới nhất", icon: CalendarArrowDown },
  { value: GetV2TeamsSort.member_count, label: "Số thành viên", icon: Users },
  { value: GetV2TeamsSort.manga_count, label: "Số truyện", icon: BookOpen },
  { value: GetV2TeamsSort.chapter_count, label: "Số chapter", icon: SwatchBook },
  { value: GetV2TeamsSort.comment_count, label: "Số bình luận", icon: MessagesSquare },
] as const satisfies readonly {
  value: TeamsSortValue;
  label: string;
  icon: React.ComponentType;
}[];

function isTeamSortValue(value: string): value is TeamsSortValue {
  return TEAM_SORT_OPTIONS.some((option) => option.value === value);
}

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
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString.withDefault(GetV2TeamsSort.updated_at).withOptions({
      shallow: false,
    }),
  );
  const safePage = Math.max(1, page);
  const safeSort = isTeamSortValue(sort) ? sort : GetV2TeamsSort.updated_at;
  const activeSortLabel =
    TEAM_SORT_OPTIONS.find((option) => option.value === safeSort)?.label ??
    TEAM_SORT_OPTIONS[0].label;

  const [debouncedQuery] = useDebouncedValue(inputValue, 500);

  useEffect(() => {
    if (page < 1) {
      void setPage(1);
    }
  }, [page, setPage]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["moetruyen", "teams", debouncedQuery, safePage, safeSort],
    queryFn: async () => {
      const res = await getV2Teams({
        q: debouncedQuery || undefined,
        limit: LIMIT,
        page: safePage,
        sort: safeSort,
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

  const handleSortChange = (
    nextSort: (typeof TEAM_SORT_OPTIONS)[number]["value"],
  ) => {
    void setSort(nextSort);
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
      <InputGroup className="h-10">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          className="h-10"
          placeholder="Nhập tên nhóm, mô tả..."
          autoComplete="off"
          value={inputValue}
          onChange={(event) => {
            void setInputValue(event.target.value || null);
            void setPage(null);
          }}
        />

        <InputGroupAddon align="inline-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton variant="secondary" className="h-7" size="sm">
                {activeSortLabel} <ChevronDownIcon />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuLabel>Sắp xếp theo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={safeSort}
                onValueChange={(value) => {
                  if (isTeamSortValue(value)) {
                    handleSortChange(value);
                  }
                }}
              >
                {TEAM_SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    <option.icon />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            className="size-7"
            variant="secondary"
            size="icon-sm"
            onClick={inputValue ? handleClear : undefined}
          >
            {inputValue ? <X /> : <ArrowRight />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <div className="mt-4 w-full">{renderResults()}</div>

      {totalPages >= 1 ? (
        <PaginationControl
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={(targetPage) => {
            if (targetPage <= 1) {
              void setPage(null);
              return;
            }

            void setPage(targetPage);
          }}
          className="mt-4"
        />
      ) : null}
    </>
  );
}
