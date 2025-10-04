"use client";

import { useConfig } from "@/hooks/use-config";
import { getLatestManga } from "@/lib/mangadex/latest";
import useSWR from "swr";
import LatestMangaCard from "./latest-manga-card";
import { Chapter } from "@/types/types";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface LatestProps {
  page: number;
  limit: number;
}

export default function Latest({ page, limit }: LatestProps) {
  const router = useRouter();
  const offset = (page - 1) * limit;
  const [config] = useConfig();
  const { data, isLoading, error } = useSWR(
    ["latest_page", limit, offset, config.translatedLanguage, config.r18],
    ([, limit, offset, translatedLanguage, r18]) =>
      getLatestManga(limit, offset, translatedLanguage, r18)
  );
  if (isLoading)
    return (
      <DefaultTabs>
        <div className="mt-20">
          <Loader2 className="animate-spin" size={40} />
        </div>
      </DefaultTabs>
    );
  if (error || !data) {
    return (
      <DefaultTabs>
        <Card className="mt-4 rounded-sm justify-center items-center flex h-16 w-full">
          Lỗi mất rồi 😭
        </Card>
      </DefaultTabs>
    );
  }

  const formattedData = formatData(data.chapters);
  const totalPages = Math.ceil((data.total || 0) / limit);
  const handlePageChange = (newPage: number) => {
    router.push(`/latest?page=${newPage}`);
  };

  const compactView = (
    <div className="flex flex-col gap-3 w-full">
      {formattedData.map((item) => (
        <LatestMangaCard
          key={item.manga.id}
          manga={item.manga}
          chapters={item.chapters}
        />
      ))}
    </div>
  );

  const coverView = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 w-full">
      {formattedData.map((item) => (
        <LatestMangaCard
          key={item.manga.id}
          manga={item.manga}
          chapters={item.chapters}
          type="cover"
        />
      ))}
    </div>
  );

  return (
    <>
      <DefaultTabs compactView={compactView} coverView={coverView} />

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
    </>
  );
}

interface DefaultTabsProps {
  children?: React.ReactNode;
  compactView?: React.ReactNode;
  coverView?: React.ReactNode;
}

function DefaultTabs({ children, compactView, coverView }: DefaultTabsProps) {
  const tabValues = [
    { value: "compact", icon: <List /> },
    { value: "cover", icon: <LayoutGrid /> },
  ];

  return (
    <Tabs defaultValue="compact" className="w-full justify-items-end">
      <TabsList className="rounded-sm gap-1.5 h-10">
        {tabValues.map((tab) => (
          <TabsTrigger key={tab.value} className="rounded-sm" value={tab.value}>
            {tab.icon}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent className="w-full justify-items-center" value="compact">
        {compactView || children}
      </TabsContent>

      <TabsContent className="w-full justify-items-center" value="cover">
        {coverView || children}
      </TabsContent>
    </Tabs>
  );
}

function formatData(data: Chapter[]) {
  // Group chapters by manga ID
  const mangaMap = new Map<
    string,
    {
      manga: {
        id: string;
        title: string | undefined;
        cover: string | undefined;
      };
      chapters: Chapter[];
    }
  >();

  // Process each chapter
  data.forEach((chapter) => {
    const mangaId = chapter.manga.id;

    // If this manga ID doesn't exist in our map yet, create a new entry
    if (!mangaMap.has(mangaId)) {
      mangaMap.set(mangaId, {
        manga: {
          id: mangaId,
          title: chapter.manga.title,
          cover: chapter.manga.cover,
        },
        chapters: [],
      });
    }

    // Add the chapter to the appropriate manga group
    mangaMap.get(mangaId)?.chapters.push(chapter);
  });

  // Convert the map to an array of objects
  return Array.from(mangaMap.values());
}
