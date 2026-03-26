"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { cn, generateSlug } from "@/lib/utils";
import CompactCardWeebdex from "./compact-card-weebdex";
import { useGetManga } from "@/lib/weebdex/hooks/manga/manga";
import { parseMangaTitle } from "@/lib/weebdex/utils";

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

  const { data, isLoading, isError } = useGetManga(
    {
      title: debouncedTerm || undefined,
      limit: 10,
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

  const mangas = data?.status === 200 ? (data.data.data ?? []) : [];

  if (trimmedSearchTerm.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nhập từ khoá đi mới tìm được chứ...
      </p>
    );
  }

  if (debouncedTerm.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="w-[69px] h-5 rounded-sm bg-gray-500 mb-2" />
        <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
        <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
        <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="w-[69px] h-5 rounded-sm bg-gray-500 mb-2" />
        <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
        <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
        <Skeleton className="w-full h-24 rounded-sm bg-gray-500" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-muted-foreground">Lỗi mất rồi 😭</p>;
  }

  if (mangas.length === 0) {
    return <p className="text-muted-foreground">Không có kết quả</p>;
  }

  return (
    <>
      <div className="mb-2 flex justify-between items-center">
        <p className="font-black text-xl">Manga</p>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="hover:text-primary hover:bg-transparent hover:underline"
        >
          <Link href={`/advanced-search?q=${debouncedTerm}`} onClick={onClose}>
            Tìm kiếm nâng cao
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className={cn("grid gap-2 overflow-y-auto", maxHeight)}>
        {mangas.map((manga) => {
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
      </div>
    </>
  );
}
