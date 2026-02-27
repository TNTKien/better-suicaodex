"use client";

import { useQuery } from "@tanstack/react-query";
import { getMangaIdChaptersResponse } from "@/lib/weebdex/hooks/chapter/chapter";
import { GetMangaIdChaptersParams } from "@/lib/weebdex/model/getMangaIdChaptersParams";
import { Chapter } from "@/lib/weebdex/model";
import { useEffect, useState } from "react";
import { BugIcon, ListX, Loader2 } from "lucide-react";
import { useConfig } from "@/hooks/use-config";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { VolumeCard, VolumeGroup } from "./volume-card";
import { ChapterGroup } from "./chapter-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const LIMIT = 100;

function buildChaptersUrl(
  id: string,
  params: GetMangaIdChaptersParams,
): string {
  const url = new URL(`https://wd.memaydex.online/manga/${id}/chapters`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else {
      url.searchParams.append(key, value === null ? "null" : String(value));
    }
  });
  return url.toString();
}

function groupChaptersByVolume(chapters: Chapter[]): VolumeGroup[] {
  // Group by volume, preserving insertion order from the sorted API response
  const volumeMap = new Map<string, Map<string, Chapter[]>>();

  for (const chapter of chapters) {
    const volKey = chapter.volume ?? "__no_vol__";
    const chKey = chapter.chapter ?? "__oneshot__";

    if (!volumeMap.has(volKey)) {
      volumeMap.set(volKey, new Map());
    }
    const chMap = volumeMap.get(volKey)!;
    if (!chMap.has(chKey)) {
      chMap.set(chKey, []);
    }
    chMap.get(chKey)!.push(chapter);
  }

  return Array.from(volumeMap.entries()).map(([volKey, chMap]) => ({
    vol: volKey === "__no_vol__" ? undefined : volKey,
    chapters: Array.from(chMap.entries()).map(([chKey, group]) => ({
      chapter: chKey === "__oneshot__" ? undefined : chKey,
      group,
    })) as ChapterGroup[],
  }));
}

interface MangaChaptersListProps {
  mangaId: string;
  finalChapter?: string;
}

export function MangaChaptersList({
  mangaId,
  finalChapter,
}: MangaChaptersListProps) {
  const [config] = useConfig();
  const [currentPage, setCurrentPage] = useState(1);
  const [volumes, setVolumes] = useState<VolumeGroup[]>([]);
  const [totalPages, setTotalPages] = useState(0);

  const params: GetMangaIdChaptersParams = {
    limit: LIMIT,
    page: currentPage,
    tlang: config.translatedLanguage,
  };

  const { data, error, isLoading } = useQuery<getMangaIdChaptersResponse>({
    queryKey: [
      `weebdex-chapters-${mangaId}`,
      mangaId,
      currentPage,
      config.translatedLanguage,
    ],
    queryFn: async ({ signal }) => {
      const url = buildChaptersUrl(mangaId, params);
      const res = await fetch(url, { signal });
      const body = [204, 205, 304].includes(res.status)
        ? null
        : await res.text();
      const responseData = body ? JSON.parse(body) : {};
      return {
        data: responseData,
        status: res.status,
        headers: res.headers,
      } as getMangaIdChaptersResponse;
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (data?.status === 200 && data.data?.data) {
      setVolumes(groupChaptersByVolume(data.data.data));
      setTotalPages(Math.ceil((data.data.total ?? 0) / LIMIT));
    }
  }, [data]);

  if (isLoading)
    return (
      <div className="flex justify-center items-center w-full h-16">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );

  if (error || (data && data.status !== 200))
    return (
      <Empty className="bg-muted/30 h-full mt-2">
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

  if (!data?.data?.data || data.data.data.length === 0)
    return (
      <Empty className="bg-muted/30 h-full mt-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListX />
          </EmptyMedia>
          <EmptyTitle>Không tìm thấy chương nào</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Truyện này chưa có chương hoặc không có chương khớp với ngôn ngữ bạn
            chọn
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
    <>
      <div className="flex flex-col gap-0">
        {volumes.map((vol) => (
          <VolumeCard
            key={vol.vol ?? "__no_vol__"}
            volume={vol}
            finalChapter={finalChapter}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationPrevious
              className="w-8 h-8"
              onClick={() => setCurrentPage((prev) => prev - 1)}
              disabled={currentPage === 1}
            />

            {totalPages <= 7 ? (
              Array.from({ length: totalPages }, (_, i) => (
                <PaginationItem key={i + 1}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={currentPage === i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))
            ) : (
              <>
                {currentPage > 3 && (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        className="w-8 h-8"
                        onClick={() => setCurrentPage(1)}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {currentPage > 4 && <PaginationEllipsis />}
                  </>
                )}

                {Array.from({ length: 5 }, (_, i) => currentPage - 2 + i)
                  .filter((p) => p >= 1 && p <= totalPages)
                  .map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        className="w-8 h-8"
                        isActive={currentPage === p}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <PaginationEllipsis />}
                    <PaginationItem>
                      <PaginationLink
                        className="w-8 h-8"
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                )}
              </>
            )}

            <PaginationNext
              className="w-8 h-8"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage === totalPages}
            />
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}
