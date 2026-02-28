"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, ChevronDown, Eraser, Loader2, SearchX } from "lucide-react";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringLiteral,
  parseAsString,
  useQueryStates,
} from "nuqs";

import { getManga } from "@/lib/weebdex/hooks/manga/manga";
import type {
  GetMangaContentRatingItem,
  GetMangaDemographicItem,
  GetMangaOrder,
  GetMangaSort,
  GetMangaStatusItem,
} from "@/lib/weebdex/model";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { cn } from "@/lib/utils";
import useContentHeight from "@/hooks/use-content-height";
import MangaCard from "@/app/weebdex/manga/_components/manga-card";

import { CN, GB, JP, VN } from "country-flag-icons/react/3x2";

// ── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 36;

const ALLOWED_STATUS: GetMangaStatusItem[] = [
  "ongoing",
  "completed",
  "hiatus",
  "cancelled",
];
const ALLOWED_DEMOS: GetMangaDemographicItem[] = [
  "shounen",
  "shoujo",
  "josei",
  "seinen",
  "none",
];
const ALLOWED_CONTENT: GetMangaContentRatingItem[] = [
  "safe",
  "suggestive",
  "erotica",
  "pornographic",
];
const ALLOWED_ORIG_LANG = ["ja", "zh", "en", "vi"] as const;
const ALLOWED_TRANS_LANG = ["en", "vi"] as const;
const ALLOWED_SORT = [
  "createdAt",
  "updatedAt",
  "lastUploadedChapterAt",
  "relevance",
  "title",
  "year",
  "rating",
  "views",
  "follows",
  "chapters",
] as const;
const ALLOWED_ORDER = ["asc", "desc"] as const;

// ── nuqs parsers ─────────────────────────────────────────────────────────────

const searchParsers = {
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsStringLiteral([...ALLOWED_STATUS])).withDefault([]),
  demographic: parseAsArrayOf(parseAsStringLiteral([...ALLOWED_DEMOS])).withDefault([]),
  contentRating: parseAsArrayOf(parseAsStringLiteral([...ALLOWED_CONTENT])).withDefault([]),
  lang: parseAsArrayOf(parseAsStringLiteral([...ALLOWED_ORIG_LANG])).withDefault([]),
  hasChapters: parseAsBoolean.withDefault(false),
  availableTranslatedLang: parseAsArrayOf(parseAsStringLiteral([...ALLOWED_TRANS_LANG])).withDefault([]),
  sort: parseAsStringLiteral([...ALLOWED_SORT]),
  order: parseAsStringLiteral([...ALLOWED_ORDER]),
  page: parseAsInteger.withDefault(1),
} as const;

// ── Main component ───────────────────────────────────────────────────────────

export default function WeebdexAdvancedSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const { contentRef, fullHeight } = useContentHeight({
    expanded: isOpen,
    initialDelay: 100,
    dependencies: [isOpen],
  });

  // ── Committed URL state (drives the API query) ─────────────────────────────

  const [committed, setCommitted] = useQueryStates(searchParsers, {
    history: "push",
  });

  // ── Local draft state (form inputs before user hits Search) ───────────────

  const [query, setQuery] = useState(committed.q);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(committed.status);
  const [selectedDemographic, setSelectedDemographic] = useState<string[]>(committed.demographic);
  const [selectedContentRating, setSelectedContentRating] = useState<string[]>(committed.contentRating);
  const [selectedLang, setSelectedLang] = useState<string[]>(committed.lang);
  const [hasChapters, setHasChapters] = useState(committed.hasChapters);
  const [selectedTranslatedLang, setSelectedTranslatedLang] = useState<string[]>(committed.availableTranslatedLang);
  const [selectedSort, setSelectedSort] = useState<GetMangaSort | null>(committed.sort);
  const [selectedOrder, setSelectedOrder] = useState<GetMangaOrder | null>(committed.order);

  // ── API query ──────────────────────────────────────────────────────────────

  const { data: response, isFetching: isLoading } = useQuery({
    queryKey: ["weebdex-advanced-search", committed],
    queryFn: () =>
      getManga({
        title: committed.q || undefined,
        status: committed.status.length ? committed.status : undefined,
        demographic: committed.demographic.length ? committed.demographic : undefined,
        contentRating: committed.contentRating.length ? committed.contentRating : undefined,
        lang: committed.lang.length ? committed.lang : undefined,
        hasChapters: committed.hasChapters ? "true" : undefined,
        availableTranslatedLang:
          committed.hasChapters && committed.availableTranslatedLang.length
            ? committed.availableTranslatedLang
            : undefined,
        sort: committed.sort ?? undefined,
        order: committed.order ?? undefined,
        page: committed.page,
        limit: LIMIT,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const mangaData = response?.status === 200 ? response.data : null;
  const isApiError = response?.status !== undefined && response.status !== 200;
  const totalPages = Math.ceil((mangaData?.total ?? 0) / LIMIT);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearch = () => {
    setCommitted({
      q: query,
      status: selectedStatus as GetMangaStatusItem[],
      demographic: selectedDemographic as GetMangaDemographicItem[],
      contentRating: selectedContentRating as GetMangaContentRatingItem[],
      lang: selectedLang as (typeof ALLOWED_ORIG_LANG)[number][],
      hasChapters,
      availableTranslatedLang: selectedTranslatedLang as (typeof ALLOWED_TRANS_LANG)[number][],
      sort: selectedSort,
      order: selectedOrder,
      page: 1,
    });
  };

  const handlePageChange = (newPage: number) => {
    setCommitted({ page: newPage });
  };

  const handleReset = () => {
    setQuery("");
    setSelectedStatus([]);
    setSelectedDemographic([]);
    setSelectedContentRating([]);
    setSelectedLang([]);
    setHasChapters(false);
    setSelectedTranslatedLang([]);
    setSelectedSort(null);
    setSelectedOrder(null);
    setResetKey((prev) => prev + 1);
    setCommitted(null);
  };

  const isFilterEmpty =
    query.length === 0 &&
    selectedStatus.length === 0 &&
    selectedDemographic.length === 0 &&
    selectedContentRating.length === 0 &&
    selectedLang.length === 0 &&
    !hasChapters &&
    selectedTranslatedLang.length === 0 &&
    selectedSort === null &&
    selectedOrder === null;

  // ── Option lists ───────────────────────────────────────────────────────────

  const statusList = [
    { value: "ongoing", label: "Đang tiến hành" },
    { value: "completed", label: "Đã hoàn thành" },
    { value: "hiatus", label: "Tạm ngừng" },
    { value: "cancelled", label: "Đã hủy" },
  ];

  const demosList = [
    { value: "shounen", label: "Shounen" },
    { value: "shoujo", label: "Shoujo" },
    { value: "seinen", label: "Seinen" },
    { value: "josei", label: "Josei" },
    { value: "none", label: "None" },
  ];

  const contentList = [
    { value: "safe", label: "Lành mạnh" },
    { value: "suggestive", label: "Hơi hơi" },
    { value: "erotica", label: "Cũng tạm" },
    { value: "pornographic", label: "Segggg!" },
  ];

  const origLangList = [
    { value: "ja", label: "Tiếng Nhật", icon: JP },
    { value: "zh", label: "Tiếng Trung", icon: CN },
    { value: "en", label: "Tiếng Anh", icon: GB },
    { value: "vi", label: "Tiếng Việt", icon: VN },
  ];

  const transLangList = [
    { value: "en", label: "Tiếng Anh", icon: GB },
    { value: "vi", label: "Tiếng Việt", icon: VN },
  ];

  const sortList: { value: GetMangaSort; label: string }[] = [
    { value: "relevance", label: "Độ phù hợp" },
    { value: "lastUploadedChapterAt", label: "Chương mới nhất" },
    { value: "updatedAt", label: "Cập nhật gần đây" },
    { value: "createdAt", label: "Ngày tạo" },
    { value: "title", label: "Tiêu đề" },
    { value: "year", label: "Năm phát hành" },
    { value: "rating", label: "Đánh giá" },
    { value: "views", label: "Lượt xem" },
    { value: "follows", label: "Theo dõi" },
    { value: "chapters", label: "Số chương" },
  ];

  const orderList: { value: GetMangaOrder; label: string }[] = [
    { value: "desc", label: "Giảm dần" },
    { value: "asc", label: "Tăng dần" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Filter panel ── */}
      <section className="flex flex-col gap-4">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Tìm kiếm nâng cao</h1>
        </div>

        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="w-full space-y-4"
        >
          {/* Search bar + toggle button */}
          <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                className="bg-secondary pl-7"
                placeholder="Nhập từ khóa..."
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant={isOpen ? "secondary" : "default"}
                className="[&[data-state=open]>svg]:rotate-180 [&_svg]:transition-transform transition-all"
              >
                <ChevronDown />
                {isOpen ? "Ẩn bộ lọc" : "Mở bộ lọc"}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Animated filter area */}
          <div
            style={{ height: isOpen ? fullHeight : 0 }}
            className="overflow-hidden transition-[height] duration-200 ease-out"
          >
            <div ref={contentRef}>
              <CollapsibleContent
                className={cn(
                  "grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 py-4 px-0.5",
                  "data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
                  "transition-opacity duration-200",
                )}
              >
                {/* Tình trạng */}
                <div className="flex flex-col gap-2">
                  <Label>
                    Tình trạng
                    {selectedStatus.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedStatus.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`status-${resetKey}`}
                    isCompact
                    className="shadow-none"
                    disableSearch
                    disableFooter
                    placeholder="Mặc định"
                    variant="secondary"
                    options={statusList}
                    onValueChange={setSelectedStatus}
                    defaultValue={selectedStatus}
                  />
                </div>

                {/* Dành cho */}
                <div className="flex flex-col gap-2">
                  <Label>
                    Dành cho
                    {selectedDemographic.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedDemographic.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`demographic-${resetKey}`}
                    isCompact
                    className="shadow-none"
                    disableSearch
                    disableFooter
                    placeholder="Mặc định"
                    variant="secondary"
                    options={demosList}
                    onValueChange={setSelectedDemographic}
                    defaultValue={selectedDemographic}
                  />
                </div>

                {/* Giới hạn nội dung */}
                <div className="flex flex-col gap-2">
                  <Label>
                    Giới hạn nội dung
                    {selectedContentRating.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedContentRating.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`content-${resetKey}`}
                    isCompact
                    className="shadow-none"
                    disableSearch
                    disableFooter
                    placeholder="Mặc định"
                    variant="secondary"
                    options={contentList}
                    onValueChange={setSelectedContentRating}
                    defaultValue={selectedContentRating}
                  />
                </div>

                {/* Ngôn ngữ gốc */}
                <div className="flex flex-col gap-2">
                  <Label>
                    Ngôn ngữ gốc
                    {selectedLang.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedLang.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`lang-${resetKey}`}
                    isCompact
                    className="shadow-none"
                    disableSearch
                    disableFooter
                    placeholder="Mặc định"
                    variant="secondary"
                    options={origLangList}
                    onValueChange={setSelectedLang}
                    defaultValue={selectedLang}
                  />
                </div>

                {/* Có bản dịch + ngôn ngữ bản dịch */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasChapters"
                      className="size-3.5 [&_svg]:size-3.5"
                      checked={hasChapters}
                      onCheckedChange={(checked) => {
                        setHasChapters(!!checked);
                        if (!checked) setSelectedTranslatedLang([]);
                      }}
                    />
                    <Label htmlFor="hasChapters">
                      Có bản dịch?
                      {hasChapters && selectedTranslatedLang.length > 0 && (
                        <span className="font-light text-primary">
                          {" "}
                          +{selectedTranslatedLang.length}
                        </span>
                      )}
                    </Label>
                  </div>
                  <MultiSelect
                    key={`translated-${resetKey}`}
                    disabled={!hasChapters}
                    isCompact
                    className="shadow-none"
                    disableSearch
                    disableFooter
                    placeholder="Mặc định"
                    variant="secondary"
                    options={transLangList}
                    onValueChange={setSelectedTranslatedLang}
                    defaultValue={selectedTranslatedLang}
                  />
                </div>

                {/* Sắp xếp theo */}
                <div className="flex flex-col gap-2">
                  <Label>Sắp xếp theo</Label>
                  <Select
                    key={`sort-${resetKey}`}
                    value={selectedSort ?? ""}
                    onValueChange={(v) => setSelectedSort((v as GetMangaSort) || null)}
                  >
                    <SelectTrigger className="px-3! shadow-none rounded-md! h-10! w-full text-muted-foreground font-medium">
                      <SelectValue placeholder="Mặc định" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px] rounded-md!">
                      <SelectGroup>
                        {sortList.map((s) => (
                          <SelectItem
                            key={s.value}
                            value={s.value}
                            className="h-8"
                          >
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Thứ tự */}
                <div className="flex flex-col gap-2">
                  <Label>Thứ tự</Label>
                  <Select
                    key={`order-${resetKey}`}
                    value={selectedOrder ?? ""}
                    onValueChange={(v) => setSelectedOrder((v as GetMangaOrder) || null)}
                  >
                    <SelectTrigger className="px-3 shadow-none rounded-md! h-10! w-full text-muted-foreground font-medium">
                      <SelectValue placeholder="Mặc định" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px] rounded-md!">
                      <SelectGroup>
                        {orderList.map((o) => (
                          <SelectItem
                            key={o.value}
                            value={o.value}
                            className="h-8"
                          >
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </div>
          </div>
        </Collapsible>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="bg-[#FF4040]/20 hover:bg-[#FF4040]/10 text-[#FF4040]"
            variant="default"
            onClick={handleReset}
            disabled={isFilterEmpty}
          >
            <Eraser />
            Đặt lại
          </Button>
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
            Tìm kiếm
          </Button>
        </div>
      </section>

      {/* ── Results ── */}
      <section className="mt-8">
        {isLoading ? (
          <SkeletonGrid />
        ) : isApiError ? (
          <Empty className="bg-muted/30 mt-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Có lỗi xảy ra 🤪</EmptyTitle>
              <EmptyDescription>Thử lại xem sao nhé</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : mangaData?.data?.length === 0 ? (
          <Empty className="bg-muted/30 mt-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Không tìm thấy kết quả</EmptyTitle>
              <EmptyDescription>
                Thử thay đổi bộ lọc hoặc từ khóa khác nhé
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : mangaData?.data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {mangaData.data.map((manga) => (
                <Link
                  key={manga.id}
                  href={`/weebdex/manga/${manga.id}`}
                  prefetch={false}
                >
                  <MangaCard
                    manga_id={manga.id!}
                    title={manga.title ?? ""}
                    cover={manga.relationships?.cover}
                  />
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationPrevious
                    className="w-8 h-8"
                    onClick={() => handlePageChange(committed.page - 1)}
                    disabled={committed.page === 1}
                  />

                  {totalPages <= 7 ? (
                    Array.from({ length: totalPages }, (_, i) => (
                      <PaginationItem key={i + 1}>
                        <PaginationLink
                          className="w-8 h-8"
                          isActive={i + 1 === committed.page}
                          onClick={() => handlePageChange(i + 1)}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))
                  ) : committed.page <= 4 ? (
                    <>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <PaginationItem key={num}>
                          <PaginationLink
                            className="w-8 h-8"
                            isActive={num === committed.page}
                            onClick={() => handlePageChange(num)}
                          >
                            {num}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationEllipsis />
                      <PaginationItem>
                        <PaginationLink
                          className="w-8 h-8"
                          onClick={() => handlePageChange(totalPages)}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  ) : committed.page >= totalPages - 3 ? (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          className="w-8 h-8"
                          onClick={() => handlePageChange(1)}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationEllipsis />
                      {[
                        totalPages - 4,
                        totalPages - 3,
                        totalPages - 2,
                        totalPages - 1,
                        totalPages,
                      ].map((num) => (
                        <PaginationItem key={num}>
                          <PaginationLink
                            className="w-8 h-8"
                            isActive={num === committed.page}
                            onClick={() => handlePageChange(num)}
                          >
                            {num}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                    </>
                  ) : (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          className="w-8 h-8"
                          onClick={() => handlePageChange(1)}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationEllipsis />
                      {[
                        committed.page - 1,
                        committed.page,
                        committed.page + 1,
                      ].map((num) => (
                        <PaginationItem key={num}>
                          <PaginationLink
                            className="w-8 h-8"
                            isActive={num === committed.page}
                            onClick={() => handlePageChange(num)}
                          >
                            {num}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationEllipsis />
                      <PaginationItem>
                        <PaginationLink
                          className="w-8 h-8"
                          onClick={() => handlePageChange(totalPages)}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationNext
                    className="w-8 h-8"
                    onClick={() => handlePageChange(committed.page + 1)}
                    disabled={committed.page === totalPages}
                  />
                </PaginationContent>
              </Pagination>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}

// ── Skeleton placeholder ──────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {Array.from({ length: 18 }).map((_, i) => (
        <Skeleton key={i} className="aspect-5/7 w-full rounded-sm" />
      ))}
    </div>
  );
}
