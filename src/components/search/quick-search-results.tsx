"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useGetV1Manga } from "@/lib/moetruyen/hooks/manga/manga";
import { useGetManga } from "@/lib/weebdex/hooks/manga/manga";
import { cn, generateSlug } from "@/lib/utils";
import { parseMangaTitle } from "@/lib/weebdex/utils";

import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import CompactCardMoetruyen from "./compact-card-moetruyen";
import CompactCardWeebdex from "./compact-card-weebdex";

const RESULT_LIMIT = 4;

function QuickSearchSectionSkeleton({
  width = "w-[90px]",
}: {
  width?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn(width, "mb-2 h-5 rounded-sm bg-gray-500")} />
      <Skeleton className="h-24 w-full rounded-sm bg-gray-500" />
      <Skeleton className="h-24 w-full rounded-sm bg-gray-500" />
    </div>
  );
}

function SearchSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl font-black">{title}</p>
        {action}
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

interface QuickSearchResultsProps {
  searchTerm: string;
  debouncedTerm: string;
  maxHeight: string;
  r18Enabled: boolean;
  onClose?: () => void;
}

export default function QuickSearchResults({
  searchTerm,
  debouncedTerm,
  maxHeight,
  r18Enabled,
  onClose,
}: QuickSearchResultsProps) {
  const trimmedSearchTerm = searchTerm.trim();
  const contentRating = r18Enabled
    ? (["safe", "suggestive", "erotica", "pornographic"] as const)
    : (["safe", "suggestive", "erotica"] as const);

  const {
    data: weebdexData,
    isLoading: isWeebdexLoading,
    isError: isWeebdexError,
  } = useGetManga(
    {
      title: debouncedTerm || undefined,
      limit: RESULT_LIMIT,
      contentRating: [...contentRating],
      sort: "relevance",
    },
    {
      query: {
        enabled: debouncedTerm.length > 0,
        refetchOnWindowFocus: false,
      },
    },
  );

  const {
    data: moeData,
    isLoading: isMoeLoading,
    isError: isMoeError,
  } = useGetV1Manga(
    {
      q: debouncedTerm,
      limit: RESULT_LIMIT,
      // hasChapters: "1",
    },
    {
      query: {
        enabled: debouncedTerm.length > 0,
        refetchOnWindowFocus: false,
      },
    },
  );

  const weebdexMangas =
    weebdexData?.status === 200 ? (weebdexData.data.data ?? []) : [];
  const moeMangas = moeData?.status === 200 ? (moeData.data.data ?? []) : [];

  if (trimmedSearchTerm.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nhập từ khoá đi mới tìm được chứ...
      </p>
    );
  }

  if (debouncedTerm.length === 0 || isWeebdexLoading || isMoeLoading) {
    return (
      <div className={cn("grid gap-4 overflow-y-auto", maxHeight)}>
        <QuickSearchSectionSkeleton width="w-[98px]" />
        <QuickSearchSectionSkeleton width="w-[88px]" />
      </div>
    );
  }

  if (isWeebdexError && isMoeError) {
    return <p className="text-muted-foreground">Lỗi mất rồi 😭</p>;
  }

  if (weebdexMangas.length === 0 && moeMangas.length === 0) {
    return <p className="text-muted-foreground">Không có kết quả</p>;
  }

  return (
    <div className={cn("grid gap-4 overflow-y-auto", maxHeight)}>
      {weebdexMangas.length > 0 ? (
        <SearchSection
          title="Suicaodex"
          action={
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="hover:bg-transparent hover:text-primary hover:underline"
            >
              <Link
                href={`/advanced-search?q=${debouncedTerm}`}
                onClick={onClose}
              >
                Tìm kiếm nâng cao
                <ArrowRight />
              </Link>
            </Button>
          }
        >
          {weebdexMangas.map((manga) => {
            const { title } = parseMangaTitle(manga);

            return (
              <Link
                key={manga.id}
                href={`/manga/${manga.id}/${generateSlug(title)}`}
                onClick={onClose}
                prefetch={false}
              >
                <CompactCardWeebdex manga={manga} />
              </Link>
            );
          })}
        </SearchSection>
      ) : null}

      {moeMangas.length > 0 ? (
        <SearchSection title="MoeTruyen">
          {moeMangas.map((manga) => (
            <Link
              key={manga.id}
              href={`/moetruyen/manga/${manga.id}/${manga.slug}`}
              onClick={onClose}
              prefetch={false}
            >
              <CompactCardMoetruyen manga={manga} />
            </Link>
          ))}
        </SearchSection>
      ) : null}
    </div>
  );
}
