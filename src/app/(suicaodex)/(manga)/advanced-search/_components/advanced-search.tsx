"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Ban,
  Bookmark,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarPlus,
  CaseUpper,
  ChevronDown,
  Eraser,
  Eye,
  Flame,
  Flower2,
  Heart,
  Loader2,
  Pause,
  Rss,
  ScanSearch,
  Search,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  SwatchBook,
  Users,
} from "lucide-react";
import { CN, GB, JP, VN } from "country-flag-icons/react/3x2";

import { getManga } from "@/lib/weebdex/hooks/manga/manga";
import { getMangaTag } from "@/lib/weebdex/hooks/tag/tag";
import type {
  GetMangaContentRatingItem,
  GetMangaDemographicItem,
  GetMangaOrder,
  GetMangaSort,
  GetMangaStatusItem,
} from "@/lib/weebdex/model";
import { cn } from "@/lib/utils";
import useContentHeight from "@/hooks/use-content-height";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import MangaCard from "../../manga/_components/manga-card";
import TagsPanel from "./tags-panel";
import {
  buildTagStates,
  getExcluded,
  getIncluded,
  tagsFromTagList,
  type TagStates,
  type TagOption,
} from "../../../../../../deprecated/advanced-search/tags-filter";
import { AuthorPicker } from "./author-picker";
import {
  FilterDropdown,
  SingleFilterDropdown,
  type FilterDropdownOption,
} from "./filter-dropdown";

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
const ALLOWED_TMOD = ["AND", "OR"] as const;

const statusList: FilterDropdownOption[] = [
  { value: "ongoing", label: "Đang tiến hành", icon: Activity },
  { value: "completed", label: "Đã hoàn thành", icon: BadgeCheck },
  { value: "hiatus", label: "Tạm ngừng", icon: Pause },
  { value: "cancelled", label: "Đã hủy", icon: Ban },
];

const demosList: FilterDropdownOption[] = [
  { value: "shounen", label: "Shounen", icon: Flame },
  { value: "shoujo", label: "Shoujo", icon: Flower2 },
  { value: "seinen", label: "Seinen", icon: Briefcase },
  { value: "josei", label: "Josei", icon: Sparkles },
  { value: "none", label: "None", icon: Users },
];

const contentList: FilterDropdownOption[] = [
  { value: "safe", label: "Lành mạnh", icon: ShieldCheck },
  { value: "suggestive", label: "Hơi hơi", icon: Sparkles },
  { value: "erotica", label: "Cũng tạm", icon: Heart },
  { value: "pornographic", label: "Segggg!", icon: ShieldAlert },
];

const origLangList: FilterDropdownOption[] = [
  { value: "ja", label: "Tiếng Nhật", icon: JP },
  { value: "zh", label: "Tiếng Trung", icon: CN },
  { value: "en", label: "Tiếng Anh", icon: GB },
  { value: "vi", label: "Tiếng Việt", icon: VN },
];

const transLangList: FilterDropdownOption[] = [
  { value: "en", label: "Tiếng Anh", icon: GB },
  { value: "vi", label: "Tiếng Việt", icon: VN },
];

const sortList: FilterDropdownOption[] = [
  { value: "relevance", label: "Độ phù hợp", icon: ScanSearch },
  { value: "lastUploadedChapterAt", label: "Chương mới nhất", icon: BookOpen },
  { value: "updatedAt", label: "Cập nhật gần đây", icon: Rss },
  { value: "createdAt", label: "Ngày tạo", icon: CalendarPlus },
  { value: "title", label: "Tiêu đề", icon: CaseUpper },
  { value: "year", label: "Năm phát hành", icon: Calendar },
  { value: "rating", label: "Đánh giá", icon: Star },
  { value: "views", label: "Lượt xem", icon: Eye },
  { value: "follows", label: "Theo dõi", icon: Bookmark },
  { value: "chapters", label: "Số chương", icon: SwatchBook },
];

const orderList: FilterDropdownOption[] = [
  { value: "desc", label: "Giảm dần", icon: ArrowDown },
  { value: "asc", label: "Tăng dần", icon: ArrowUp },
];

const searchParsers = {
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsStringLiteral([...ALLOWED_STATUS])).withDefault(
    [],
  ),
  demographic: parseAsArrayOf(
    parseAsStringLiteral([...ALLOWED_DEMOS]),
  ).withDefault([]),
  contentRating: parseAsArrayOf(
    parseAsStringLiteral([...ALLOWED_CONTENT]),
  ).withDefault([]),
  lang: parseAsArrayOf(
    parseAsStringLiteral([...ALLOWED_ORIG_LANG]),
  ).withDefault([]),
  hasChapters: parseAsBoolean.withDefault(false),
  availableTranslatedLang: parseAsArrayOf(
    parseAsStringLiteral([...ALLOWED_TRANS_LANG]),
  ).withDefault([]),
  sort: parseAsStringLiteral([...ALLOWED_SORT]),
  order: parseAsStringLiteral([...ALLOWED_ORDER]),
  page: parseAsInteger.withDefault(1),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  tagx: parseAsArrayOf(parseAsString).withDefault([]),
  tmod: parseAsStringLiteral([...ALLOWED_TMOD]),
  txmod: parseAsStringLiteral([...ALLOWED_TMOD]),
  author: parseAsArrayOf(parseAsString).withDefault([]),
} as const;

type ModeValue = (typeof ALLOWED_TMOD)[number] | null;

interface QueryState {
  q: string;
  status: GetMangaStatusItem[];
  demographic: GetMangaDemographicItem[];
  contentRating: GetMangaContentRatingItem[];
  lang: (typeof ALLOWED_ORIG_LANG)[number][];
  hasChapters: boolean;
  availableTranslatedLang: (typeof ALLOWED_TRANS_LANG)[number][];
  sort: GetMangaSort | null;
  order: GetMangaOrder | null;
  page: number;
  tag: string[];
  tagx: string[];
  tmod: ModeValue;
  txmod: ModeValue;
  author: string[];
}

interface DraftState {
  query: string;
  status: GetMangaStatusItem[];
  demographic: GetMangaDemographicItem[];
  contentRating: GetMangaContentRatingItem[];
  lang: (typeof ALLOWED_ORIG_LANG)[number][];
  hasChapters: boolean;
  availableTranslatedLang: (typeof ALLOWED_TRANS_LANG)[number][];
  sort: GetMangaSort | null;
  order: GetMangaOrder | null;
  tagStates: TagStates;
  tmod: ModeValue;
  txmod: ModeValue;
  author: string[];
}

function buildDraftState(state: QueryState): DraftState {
  return {
    query: state.q,
    status: state.status,
    demographic: state.demographic,
    contentRating: state.contentRating,
    lang: state.lang,
    hasChapters: state.hasChapters,
    availableTranslatedLang: state.availableTranslatedLang,
    sort: state.sort,
    order: state.order,
    tagStates: buildTagStates(state.tag, state.tagx),
    tmod: state.tmod,
    txmod: state.txmod,
    author: state.author,
  };
}

function createEmptyDraftState(): DraftState {
  return {
    query: "",
    status: [],
    demographic: [],
    contentRating: [],
    lang: [],
    hasChapters: false,
    availableTranslatedLang: [],
    sort: null,
    order: null,
    tagStates: {},
    tmod: null,
    txmod: null,
    author: [],
  };
}

function buildCommittedSignature(state: QueryState) {
  return JSON.stringify({
    q: state.q,
    status: state.status,
    demographic: state.demographic,
    contentRating: state.contentRating,
    lang: state.lang,
    hasChapters: state.hasChapters,
    availableTranslatedLang: state.availableTranslatedLang,
    sort: state.sort,
    order: state.order,
    page: state.page,
    tag: state.tag,
    tagx: state.tagx,
    tmod: state.tmod,
    txmod: state.txmod,
    author: state.author,
  });
}

export default function AdvancedSearchPage() {
  const [isOpen, setIsOpen] = React.useState(false);

  const { contentRef, fullHeight } = useContentHeight({
    expanded: isOpen,
    initialDelay: 100,
    dependencies: [isOpen],
  });

  const [committed, setCommitted] = useQueryStates(searchParsers, {
    history: "push",
  });

  const committedSnapshot = React.useMemo<QueryState>(
    () => ({
      q: committed.q,
      status: committed.status,
      demographic: committed.demographic,
      contentRating: committed.contentRating,
      lang: committed.lang,
      hasChapters: committed.hasChapters,
      availableTranslatedLang: committed.availableTranslatedLang,
      sort: committed.sort,
      order: committed.order,
      page: committed.page,
      tag: committed.tag,
      tagx: committed.tagx,
      tmod: committed.tmod,
      txmod: committed.txmod,
      author: committed.author,
    }),
    [
      committed.author,
      committed.availableTranslatedLang,
      committed.contentRating,
      committed.demographic,
      committed.hasChapters,
      committed.lang,
      committed.order,
      committed.page,
      committed.q,
      committed.sort,
      committed.status,
      committed.tag,
      committed.tagx,
      committed.tmod,
      committed.txmod,
    ],
  );

  const committedSignature = buildCommittedSignature(committedSnapshot);

  const [draft, setDraft] = React.useState<DraftState>(() =>
    buildDraftState(committedSnapshot),
  );

  React.useEffect(() => {
    setDraft(buildDraftState(committedSnapshot));
  }, [committedSignature, committedSnapshot]);

  const updateDraft = React.useCallback(
    <Key extends keyof DraftState>(key: Key, value: DraftState[Key]) => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const includedTagsDraft = React.useMemo(
    () => getIncluded(draft.tagStates),
    [draft.tagStates],
  );
  const excludedTagsDraft = React.useMemo(
    () => getExcluded(draft.tagStates),
    [draft.tagStates],
  );

  const { data: tagsResponse } = useQuery({
    queryKey: ["weebdex-manga-tags"],
    queryFn: () => getMangaTag({ limit: 100 }),
    staleTime: Infinity,
  });

  const tagOptions: TagOption[] = React.useMemo(
    () =>
      tagsResponse?.status === 200
        ? tagsFromTagList(tagsResponse.data.data ?? [])
        : [],
    [tagsResponse],
  );

  const { data: response, isFetching: isLoading } = useQuery({
    queryKey: ["weebdex-advanced-search", committed],
    queryFn: () =>
      getManga({
        title: committed.q || undefined,
        status: committed.status.length ? committed.status : undefined,
        demographic: committed.demographic.length
          ? committed.demographic
          : undefined,
        contentRating: committed.contentRating.length
          ? committed.contentRating
          : undefined,
        lang: committed.lang.length ? committed.lang : undefined,
        hasChapters: committed.hasChapters ? "true" : undefined,
        availableTranslatedLang:
          committed.hasChapters && committed.availableTranslatedLang.length
            ? committed.availableTranslatedLang
            : undefined,
        sort: committed.sort ?? undefined,
        order: committed.order ?? undefined,
        tag: committed.tag.length ? committed.tag : undefined,
        tagx: committed.tagx.length ? committed.tagx : undefined,
        tmod:
          committed.tag.length && committed.tmod ? committed.tmod : undefined,
        txmod:
          committed.tagx.length && committed.txmod
            ? committed.txmod
            : undefined,
        author: committed.author.length ? committed.author : undefined,
        page: committed.page,
        limit: LIMIT,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const mangaData = response?.status === 200 ? response.data : null;
  const isApiError = response?.status !== undefined && response.status !== 200;
  const totalPages = Math.ceil((mangaData?.total ?? 0) / LIMIT);

  const handleSearch = React.useCallback(() => {
    void setCommitted({
      q: draft.query,
      status: draft.status,
      demographic: draft.demographic,
      contentRating: draft.contentRating,
      lang: draft.lang,
      hasChapters: draft.hasChapters,
      availableTranslatedLang: draft.availableTranslatedLang,
      sort: draft.sort,
      order: draft.order,
      tag: includedTagsDraft,
      tagx: excludedTagsDraft,
      tmod: includedTagsDraft.length > 0 ? draft.tmod : null,
      txmod: excludedTagsDraft.length > 0 ? draft.txmod : null,
      author: draft.author,
      page: 1,
    });
  }, [draft, excludedTagsDraft, includedTagsDraft, setCommitted]);

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      void setCommitted({ page: newPage });
    },
    [setCommitted],
  );

  const handleReset = React.useCallback(() => {
    setDraft(createEmptyDraftState());
    void setCommitted(null);
  }, [setCommitted]);

  const isFilterEmpty =
    draft.query.length === 0 &&
    draft.status.length === 0 &&
    draft.demographic.length === 0 &&
    draft.contentRating.length === 0 &&
    draft.lang.length === 0 &&
    !draft.hasChapters &&
    draft.availableTranslatedLang.length === 0 &&
    draft.sort === null &&
    draft.order === null &&
    Object.keys(draft.tagStates).length === 0 &&
    draft.author.length === 0;

  return (
    <>
      <section className="flex flex-col gap-4 px-4 md:px-8 lg:px-12">
        <div>
          <div className="h-1 w-9 bg-primary" />
          <h1 className="text-2xl font-black uppercase">Tìm kiếm nâng cao</h1>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
          <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2" />
              <Input
                className="bg-secondary pl-7"
                placeholder="Nhập từ khóa..."
                autoComplete="off"
                value={draft.query}
                onChange={(event) => updateDraft("query", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant={isOpen ? "secondary" : "default"}
                className="transition-all [&[data-state=open]>svg]:rotate-180 [&_svg]:transition-transform"
              >
                <ChevronDown />
                {isOpen ? "Ẩn bộ lọc" : "Mở bộ lọc"}
              </Button>
            </CollapsibleTrigger>
          </div>

          <div
            style={{ height: isOpen ? fullHeight : 0 }}
            className="overflow-hidden transition-[height] duration-200 ease-out"
          >
            <div ref={contentRef}>
              <CollapsibleContent
                className={cn(
                  "grid grid-cols-1 gap-4 px-0.5 py-4 md:grid-cols-3 xl:grid-cols-4",
                  "data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
                  "transition-opacity duration-200",
                )}
              >
                <div className="flex flex-col gap-2">
                  <Label className="uppercase font-semibold">
                    Tình trạng
                    {draft.status.length > 0 ? (
                      <span className="font-light text-primary">
                        {" "}
                        +{draft.status.length}
                      </span>
                    ) : null}
                  </Label>
                  <FilterDropdown
                    description="Mặc định: Tất cả"
                    value={draft.status}
                    options={statusList}
                    onChange={(value) =>
                      updateDraft("status", value as GetMangaStatusItem[])
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="uppercase font-semibold">
                    Dành cho
                    {draft.demographic.length > 0 ? (
                      <span className="font-light text-primary">
                        {" "}
                        +{draft.demographic.length}
                      </span>
                    ) : null}
                  </Label>
                  <FilterDropdown
                    description="Mặc định: Tất cả"
                    value={draft.demographic}
                    options={demosList}
                    onChange={(value) =>
                      updateDraft(
                        "demographic",
                        value as GetMangaDemographicItem[],
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="uppercase font-semibold">
                    Giới hạn nội dung
                    {draft.contentRating.length > 0 ? (
                      <span className="font-light text-primary">
                        {" "}
                        +{draft.contentRating.length}
                      </span>
                    ) : null}
                  </Label>
                  <FilterDropdown
                    description="Mặc định: Lành mạnh -> Cũng tạm"
                    value={draft.contentRating}
                    options={contentList}
                    onChange={(value) =>
                      updateDraft(
                        "contentRating",
                        value as GetMangaContentRatingItem[],
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="uppercase font-semibold">
                    Ngôn ngữ gốc
                    {draft.lang.length > 0 ? (
                      <span className="font-light text-primary">
                        {" "}
                        +{draft.lang.length}
                      </span>
                    ) : null}
                  </Label>
                  <FilterDropdown
                    description="Mặc định: Tất cả"
                    value={draft.lang}
                    options={origLangList}
                    onChange={(value) =>
                      updateDraft(
                        "lang",
                        value as (typeof ALLOWED_ORIG_LANG)[number][],
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasChaptersV2"
                      className="size-3.5 [&_svg]:size-3.5"
                      checked={draft.hasChapters}
                      onCheckedChange={(checked) => {
                        const nextHasChapters = !!checked;
                        updateDraft("hasChapters", nextHasChapters);

                        if (!nextHasChapters) {
                          updateDraft("availableTranslatedLang", []);
                        }
                      }}
                    />
                    <Label
                      htmlFor="hasChaptersV2"
                      className="uppercase font-semibold"
                    >
                      Có bản dịch?
                      {draft.hasChapters &&
                      draft.availableTranslatedLang.length > 0 ? (
                        <span className="font-light text-primary">
                          {" "}
                          +{draft.availableTranslatedLang.length}
                        </span>
                      ) : null}
                    </Label>
                  </div>
                  <FilterDropdown
                    description="Mặc định: Tất cả"
                    placeholder="Mặc định"
                    value={draft.availableTranslatedLang}
                    options={transLangList}
                    disabled={!draft.hasChapters}
                    onChange={(value) =>
                      updateDraft(
                        "availableTranslatedLang",
                        value as (typeof ALLOWED_TRANS_LANG)[number][],
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="uppercase font-semibold">
                    Sắp xếp theo
                  </Label>
                  <SingleFilterDropdown
                    description="Mặc định: Độ phù hợp"
                    placeholder="Mặc định"
                    value={draft.sort}
                    options={sortList}
                    onChange={(value) =>
                      updateDraft("sort", value as GetMangaSort | null)
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="uppercase font-semibold">Thứ tự</Label>
                  <SingleFilterDropdown
                    description="Mặc định: Giảm dần"
                    placeholder="Mặc định"
                    value={draft.order}
                    options={orderList}
                    onChange={(value) =>
                      updateDraft("order", value as GetMangaOrder | null)
                    }
                  />
                </div>

                <div className="col-span-full flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 uppercase font-semibold">
                      Tác giả
                      {draft.author.length > 0 ? (
                        <span className="font-light text-primary">
                          +{draft.author.length}
                        </span>
                      ) : null}
                    </Label>
                  </div>

                  <AuthorPicker
                    value={draft.author}
                    onChange={(value) => updateDraft("author", value)}
                    placeholder="Ai cũng được"
                  />
                </div>

                <div className="col-span-full flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 uppercase font-semibold">
                      Thể loại
                      {includedTagsDraft.length > 0 ? (
                        <span className="font-light text-primary">
                          +{includedTagsDraft.length}
                        </span>
                      ) : null}
                      {excludedTagsDraft.length > 0 ? (
                        <span className="font-light text-destructive">
                          -{excludedTagsDraft.length}
                        </span>
                      ) : null}
                    </Label>
                  </div>

                  <TagsPanel
                    tags={tagOptions}
                    tagStates={draft.tagStates}
                    onTagStatesChange={(value) =>
                      updateDraft("tagStates", value)
                    }
                    isLoading={tagOptions.length === 0}
                  />

                  {includedTagsDraft.length > 0 ||
                  excludedTagsDraft.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      {includedTagsDraft.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium uppercase text-muted-foreground">
                            bao gồm:
                          </span>
                          {(["AND", "OR"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => updateDraft("tmod", mode)}
                              className={cn(
                                "flex cursor-pointer items-center gap-1.5 transition-colors",
                                (draft.tmod ?? "AND") === mode
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-flex size-3.5 items-center justify-center rounded-full border-2",
                                  (draft.tmod ?? "AND") === mode
                                    ? "border-green-500"
                                    : "border-muted-foreground/40",
                                )}
                              >
                                {(draft.tmod ?? "AND") === mode ? (
                                  <span className="size-1.5 rounded-full bg-green-500" />
                                ) : null}
                              </span>
                              {mode === "AND"
                                ? "Tất cả (AND)"
                                : "Ít nhất một (OR)"}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {excludedTagsDraft.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium uppercase text-muted-foreground">
                            loại trừ:
                          </span>
                          {(["OR", "AND"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => updateDraft("txmod", mode)}
                              className={cn(
                                "flex cursor-pointer items-center gap-1.5 transition-colors",
                                (draft.txmod ?? "OR") === mode
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-flex size-3.5 items-center justify-center rounded-full border-2",
                                  (draft.txmod ?? "OR") === mode
                                    ? "border-red-500"
                                    : "border-muted-foreground/40",
                                )}
                              >
                                {(draft.txmod ?? "OR") === mode ? (
                                  <span className="size-1.5 rounded-full bg-red-500" />
                                ) : null}
                              </span>
                              {mode === "OR" ? "Bất kỳ (OR)" : "Tất cả (AND)"}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CollapsibleContent>
            </div>
          </div>
        </Collapsible>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="default"
            className="bg-[#FF4040]/20 text-[#FF4040] hover:bg-[#FF4040]/10"
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

      <section className="mt-8 px-4 md:px-8 lg:px-12">
        {isLoading ? (
          <SkeletonGrid />
        ) : isApiError ? (
          <Empty className="mt-4 bg-muted/30">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Có lỗi xảy ra 🤪</EmptyTitle>
              <EmptyDescription>Thử lại xem sao nhé</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : mangaData?.data?.length === 0 ? (
          <Empty className="mt-4 bg-muted/30">
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {mangaData.data.map((manga) => (
                <Link
                  key={manga.id}
                  href={`/manga/${manga.id}`}
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

            {totalPages > 1 ? (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationPrevious
                    className="size-8"
                    onClick={() => handlePageChange(committed.page - 1)}
                    disabled={committed.page === 1}
                  />

                  {totalPages <= 7 ? (
                    Array.from({ length: totalPages }, (_, index) => (
                      <PaginationItem key={index + 1}>
                        <PaginationLink
                          className="size-8"
                          isActive={index + 1 === committed.page}
                          onClick={() => handlePageChange(index + 1)}
                        >
                          {index + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))
                  ) : committed.page <= 4 ? (
                    <>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <PaginationItem key={num}>
                          <PaginationLink
                            className="size-8"
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
                          className="size-8"
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
                          className="size-8"
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
                            className="size-8"
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
                          className="size-8"
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
                            className="size-8"
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
                          className="size-8"
                          onClick={() => handlePageChange(totalPages)}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationNext
                    className="size-8"
                    onClick={() => handlePageChange(committed.page + 1)}
                    disabled={committed.page === totalPages}
                  />
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: 18 }).map((_, index) => (
        <Skeleton key={index} className="aspect-5/7 w-full rounded-sm" />
      ))}
    </div>
  );
}
