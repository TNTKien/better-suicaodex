"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Eraser,
  Loader2,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { getTags } from "@/lib/mangadex/tag";
import useContentHeight from "@/hooks/use-content-height";
import { TagsSelector } from "./tags-selector";
import { AuthorsSelector } from "./authors-selector";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import {
  ContentRating,
  Status,
  OriginLanguge,
  Demosgraphic,
  TranslatedLanguage,
} from "@/types/types";
import { AdvancedSearchManga } from "@/lib/mangadex/search";
import useSWRMutation from "swr/mutation";
import ResultTabs from "@/components/Search/Result/result-tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AdvancedSearchGuide from "./advanded-search-guide";
import { CN, GB, JP, KR, VN } from "country-flag-icons/react/3x2";

interface AdvancedSearchProps {
  page: number;
  limit: number;
  q: string;
  author: string;
  content: string;
  status: string;
  demos: string;
  include: string;
  exclude: string;
  origin: string;
  availableChapter: boolean;
  translated: string;
  year: string;
}

// Function to filter array values based on their type
function filterByType<T extends string>(
  values: string[],
  allowedValues: readonly T[]
): T[] {
  return values.filter((value): value is T =>
    allowedValues.includes(value as T)
  ) as T[];
}

// Convert comma-separated string to array and optionally filter by allowed values
function toArray(str: string): string[] {
  return str ? str.split(",") : [];
}

export default function AdvancedSearch({
  page,
  limit,
  q,
  author,
  content,
  status,
  demos,
  include,
  exclude,
  origin,
  availableChapter,
  translated,
  year,
}: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  //TODO: more filter

  // Use custom hook for content height management
  const { contentRef, fullHeight } = useContentHeight({
    expanded: isOpen,
    initialDelay: 100,
    dependencies: [isOpen],
  });

  const [query, setQuery] = useState(q);
  // Reset keys to force re-render of MultiSelect components
  const [resetKey, setResetKey] = useState(0);

  // Define allowed values for each filter type
  const allowedContentRatings: ContentRating[] = [
    "safe",
    "suggestive",
    "erotica",
    "pornographic",
  ];
  const allowedStatuses: Status[] = [
    "ongoing",
    "completed",
    "cancelled",
    "hiatus",
  ];
  const allowedDemos: Demosgraphic[] = [
    "shounen",
    "shoujo",
    "jousei",
    "seinen",
  ];
  const allowedOriginLanguages: OriginLanguge[] = [
    "en",
    "vi",
    "ja",
    "ko",
    "zh",
  ];
  const allowedTranslatedLanguages: TranslatedLanguage[] = ["en", "vi"];

  // Filter and set the selected values based on their types
  const [selectedStatus, setSelectedStatus] = useState<string[]>(
    filterByType(toArray(status), allowedStatuses)
  );
  const [selectedDemos, setSelectedDemos] = useState<string[]>(
    filterByType(toArray(demos), allowedDemos)
  );
  const [selectedContent, setSelectedContent] = useState<string[]>(
    filterByType(toArray(content), allowedContentRatings)
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string[]>(
    filterByType(toArray(translated), allowedTranslatedLanguages)
  );
  const [selectedOriginLanguage, setSelectedOriginLanguage] = useState<
    string[]
  >(filterByType(toArray(origin), allowedOriginLanguages));
  const [selectedAuthor, setSelectedAuthor] = useState<string[]>(
    toArray(author)
  );
  const [selectedInclude, setSelectedInclude] = useState<string[]>(
    toArray(include) || []
  );
  const [selectedExclude, setSelectedExclude] = useState<string[]>(
    toArray(exclude) || []
  );
  const [tagOptions, setTagOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [hasAvailableChapter, setHasAvailableChapter] =
    useState(availableChapter);

  const [selectedYear, setSelectedYear] = useState(year);

  const statusList = [
    { value: "completed", label: "Đã hoàn thành" },
    { value: "ongoing", label: "Đang tiến hành" },
    { value: "hiatus", label: "Tạm ngừng" },
    { value: "cancelled", label: "Đã hủy" },
  ];

  const demosList = [
    { value: "shounen", label: "Shounen" },
    { value: "shoujo", label: "Shoujo" },
    { value: "seinen", label: "Seinen" },
    { value: "jousei", label: "Jousei" },
    { value: "none", label: "None" },
  ];

  const contentList = [
    { value: "safe", label: "Lành mạnh" },
    { value: "suggestive", label: "Hơi hơi" },
    { value: "erotica", label: "Cũng tạm" },
    { value: "pornographic", label: "Segggg!" },
  ];

  const originLanguageList = [
    { value: "vi", label: "Tiếng Việt", icon: VN },
    { value: "en", label: "Tiếng Anh", icon: GB },
    { value: "ja", label: "Tiếng Nhật", icon: JP },
    { value: "ko", label: "Tiếng Hàn", icon: KR },
    { value: "zh", label: "Tiếng Trung", icon: CN },
  ];

  const languageList = [
    { value: "vi", label: "Tiếng Việt", icon: VN },
    { value: "en", label: "Tiếng Anh", icon: GB },
  ];

  const tagsList = async () => {
    const data = await getTags();
    return data.map((item) => ({
      value: item.id,
      label: item.name,
    }));
  };
  useEffect(() => {
    tagsList().then((data) => setTagOptions(data));
  }, []);

  // Parse author string to array of IDs on component mount
  // useEffect(() => {
  //   if (author && author.length > 0) {
  //     const authorIds = author.split(",");
  //     setSelectedAuthor(authorIds);
  //   }
  // }, [author]);

  const resetFilter = () => {
    setQuery("");
    setSelectedStatus([]);
    setSelectedDemos([]);
    setSelectedContent([]);
    setSelectedLanguage([]);
    setSelectedOriginLanguage([]);
    setSelectedAuthor([]);
    setSelectedInclude([]);
    setSelectedExclude([]);
    setHasAvailableChapter(false);
    setSelectedYear("");
    // Increment reset key to force re-render of MultiSelect components
    setResetKey((prev) => prev + 1);
    router.replace("/advanced-search");
  };

  const offset = (page - 1) * limit;
  const { data, error, trigger, isMutating } = useSWRMutation(
    [
      "advanced-search",
      query,
      offset,
      limit,
      selectedContent,
      selectedStatus,
      selectedInclude,
      selectedExclude,
      selectedAuthor,
      selectedDemos,
      selectedOriginLanguage,
      hasAvailableChapter,
      selectedLanguage,
      selectedYear,
    ],
    ([
      ,
      q,
      offset,
      limit,
      content,
      status,
      include,
      exclude,
      author,
      graphic,
      origin,
      availableChapter,
      translated,

      year,
    ]) =>
      AdvancedSearchManga(
        q,
        offset,
        limit,
        content,
        status,
        include,
        exclude,
        author,
        graphic,
        origin,
        availableChapter,
        translated,
        year
      )
  );

  // Function to handle search button click
  const handleSearch = () => {
    // Generate search params from current state
    const params = generateSearchParams({
      q: query,
      page,
      limit,
      author: selectedAuthor.join(","),
      content: selectedContent.join(","),
      status: selectedStatus.join(","),
      demos: selectedDemos.join(","),
      include: selectedInclude.join(","),
      exclude: selectedExclude.join(","),
      origin: selectedOriginLanguage.join(","),
      availableChapter: hasAvailableChapter,
      translated: selectedLanguage.join(","),
      year: selectedYear,
    });

    // Update the URL with search parameters
    router.push(`/advanced-search?${params.toString()}`);

    // Trigger the search
    trigger();
  };

  const handlePageChange = (newPage: number) => {
    // Generate search params from current state
    const params = generateSearchParams({
      q: query,
      page: newPage,
      limit,
      author: selectedAuthor.join(","),
      content: selectedContent.join(","),
      status: selectedStatus.join(","),
      demos: selectedDemos.join(","),
      include: selectedInclude.join(","),
      exclude: selectedExclude.join(","),
      origin: selectedOriginLanguage.join(","),
      availableChapter: hasAvailableChapter,
      translated: selectedLanguage.join(","),
      year: selectedYear,
    });
    router.push(`/advanced-search?${params.toString()}`);
    trigger();
  };

  //initial load
  useEffect(() => {
    if (!data) {
      trigger();
    }
  }, [data, trigger]);

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <>
      <section className="flex flex-col gap-4 transition-all">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Tìm kiếm nâng cao</h1>
        </div>

        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="w-full space-y-4"
        >
          <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2" />
              <Input
                className="bg-secondary pl-7"
                placeholder="Nhập từ khóa..."
                autoComplete="off"
                //defaultValue={query}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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

          <div
            style={{ height: isOpen ? fullHeight : 0 }}
            className="overflow-hidden transition-[height] duration-200 ease-out"
          >
            <div ref={contentRef}>
              <CollapsibleContent
                className={cn(
                  "grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 py-4 px-0.5",
                  "data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
                  "transition-opacity duration-200"
                )}
              >
                <div className="flex flex-col gap-2">
                  <Label>
                    Thể loại
                    {selectedInclude.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedInclude.length}
                      </span>
                    )}
                    {selectedExclude.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        -{selectedExclude.length}
                      </span>
                    )}
                  </Label>
                  <TagsSelector
                    key={`tags-selector-${resetKey}`}
                    className="shadow-none"
                    disableFooter
                    isCompact
                    options={tagOptions}
                    onValueChange={(includedTags, excludedTags) => {
                      setSelectedInclude(includedTags);
                      setSelectedExclude(excludedTags);
                    }}
                    placeholder="Gì cũng được"
                    defaultExcluded={selectedExclude}
                    defaultIncluded={selectedInclude}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>
                    Tác giả
                    {selectedAuthor.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedAuthor.length}
                      </span>
                    )}
                  </Label>
                  <AuthorsSelector
                    key={`authors-selector-${resetKey}`}
                    defaultValue={selectedAuthor}
                    onValueChange={setSelectedAuthor}
                    placeholder="Ai cũng được"
                    isCompact
                    disableFooter
                    showSelectedValue
                  />
                </div>

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

                <div className="flex flex-col gap-2">
                  <Label>
                    Dành cho
                    {selectedDemos.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedDemos.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`demos-${resetKey}`}
                    className="shadow-none"
                    placeholder="Mặc định"
                    isCompact
                    disableSearch
                    disableFooter
                    variant="secondary"
                    options={demosList}
                    onValueChange={setSelectedDemos}
                    defaultValue={selectedDemos}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>
                    Giới hạn nội dung
                    {selectedContent.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedContent.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`content-${resetKey}`}
                    className="shadow-none"
                    placeholder="Mặc định"
                    isCompact
                    disableSearch
                    disableFooter
                    variant="secondary"
                    options={contentList}
                    onValueChange={setSelectedContent}
                    defaultValue={selectedContent}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>
                    Ngôn ngữ gốc
                    {selectedOriginLanguage.length > 0 && (
                      <span className="font-light text-primary">
                        {" "}
                        +{selectedOriginLanguage.length}
                      </span>
                    )}
                  </Label>
                  <MultiSelect
                    key={`origin-language-${resetKey}`}
                    className="shadow-none"
                    placeholder="Mặc định"
                    isCompact
                    disableSearch
                    disableFooter
                    variant="secondary"
                    options={originLanguageList}
                    onValueChange={setSelectedOriginLanguage}
                    defaultValue={selectedOriginLanguage}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Năm phát hành</Label>
                  <div className="flex relative">
                    <Input
                      className="min-h-10 shadow-none font-medium text-sm pl-4 pr-14"
                      type="number"
                      placeholder="Mặc định"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    />
                    <div className="flex absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Button
                        className="h-10 w-5 bg-transparent hover:bg-transparent text-muted-foreground hover:text-primary"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (Number(selectedYear) <= 0) return;
                          setSelectedYear((prev) => String(Number(prev) - 1));
                        }}
                      >
                        <Minus />
                      </Button>
                      <Button
                        className="h-10 w-5 bg-transparent hover:bg-transparent text-muted-foreground hover:text-primary"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setSelectedYear((prev) => String(Number(prev) + 1))
                        }
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasAvailableChapter"
                      className="size-3.5 [&_svg]:size-3.5"
                      onCheckedChange={() =>
                        setHasAvailableChapter(!hasAvailableChapter)
                      }
                      checked={hasAvailableChapter}
                    />
                    <Label htmlFor="hasAvailableChapter">
                      Có bản dịch?
                      {selectedLanguage.length > 0 && (
                        <span className="font-light text-primary">
                          {" "}
                          +{selectedLanguage.length}
                        </span>
                      )}
                    </Label>
                  </div>

                  <MultiSelect
                    key={`translated-${resetKey}`}
                    disabled={!hasAvailableChapter}
                    className="shadow-none"
                    placeholder="Mặc định"
                    isCompact
                    disableSearch
                    disableFooter
                    variant="secondary"
                    options={languageList}
                    onValueChange={setSelectedLanguage}
                    defaultValue={selectedLanguage}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </div>
        </Collapsible>

        <div className="flex flex-wrap justify-end gap-2">
          <AdvancedSearchGuide />

          <Button
            className="bg-[#FF4040]/20 hover:bg-[#FF4040]/10 text-[#FF4040]"
            variant="default"
            onClick={resetFilter}
            disabled={
              query.length === 0 &&
              selectedStatus.length === 0 &&
              selectedDemos.length === 0 &&
              selectedContent.length === 0 &&
              selectedOriginLanguage.length === 0 &&
              selectedAuthor.length === 0 &&
              selectedInclude.length === 0 &&
              selectedExclude.length === 0 &&
              !hasAvailableChapter &&
              selectedLanguage.length === 0 &&
              selectedYear.length === 0
            }
          >
            <Eraser />
            Đặt lại
          </Button>

          <Button onClick={handleSearch} disabled={isMutating}>
            {isMutating ? <Loader2 className="animate-spin" /> : <Search />}
            Tìm kiếm
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <ResultTabs
          isLoading={isMutating}
          isError={error}
          mangas={data?.mangas}
        />

        {totalPages > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationPrevious
                className="w-8 h-8"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              />

              {totalPages <= 7 ? (
                // Show all pages if total is 7 or less
                Array.from({ length: totalPages }, (_, i) => (
                  <PaginationItem key={i + 1}>
                    <PaginationLink
                      className="w-8 h-8"
                      isActive={i + 1 === page}
                      onClick={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))
              ) : page <= 4 ? (
                // Near start: show 1, 2, 3, 4, 5, ..., lastPage
                <>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <PaginationItem key={num}>
                      <PaginationLink
                        className="w-8 h-8"
                        isActive={num === page}
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
              ) : page >= totalPages - 3 ? (
                // Near end: show 1, ..., lastPage-4, lastPage-3, lastPage-2, lastPage-1, lastPage
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
                        isActive={num === page}
                        onClick={() => handlePageChange(num)}
                      >
                        {num}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                </>
              ) : (
                // Middle: show 1, ..., page-1, page, page+1, ..., lastPage
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
                  {[page - 1, page, page + 1].map((num) => (
                    <PaginationItem key={num}>
                      <PaginationLink
                        className="w-8 h-8"
                        isActive={num === page}
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
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              />
            </PaginationContent>
          </Pagination>
        )}
      </section>
    </>
  );
}

function generateSearchParams({
  q,
  author,
  content,
  status,
  demos,
  include,
  exclude,
  origin,
  availableChapter,
  translated,
  page,
  limit,
  year,
}: AdvancedSearchProps) {
  const params = new URLSearchParams();

  // Add non-empty string parameters
  if (q) params.set("q", q);
  if (year) params.set("year", year);

  // Convert array values to comma-separated strings and add if not empty
  if (author) params.set("author", author);
  if (content) params.set("content", content);
  if (status) params.set("status", status);
  if (demos) params.set("demos", demos);
  if (include) params.set("include", include);
  if (exclude) params.set("exclude", exclude);
  if (origin) params.set("origin", origin);
  if (translated) params.set("translated", translated);

  // Add boolean parameter if true
  if (availableChapter) params.set("availableChapter", "true");

  // Add pagination parameters if they differ from defaults
  if (page && page !== 1) params.set("page", page.toString());
  if (limit && limit !== 30) params.set("limit", limit.toString());

  return params;
}
