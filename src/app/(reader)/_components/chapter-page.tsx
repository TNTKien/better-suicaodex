"use client";

import Reader from "./reader";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetChapterId } from "@/lib/weebdex/hooks/chapter/chapter";
import useReadingHistoryV2 from "@/hooks/use-reading-history-v2";
import { useEffect } from "react";
import { type Chapter } from "@/lib/weebdex/model";
import { ReaderSidebar } from "./reader-sidebar";
import { ReaderHeader } from "./reader-header";
import { siteConfig } from "@/config/site";
import { useGetMangaId } from "@/lib/weebdex/hooks/manga/manga";
import { parseMangaTitle } from "@/lib/weebdex/utils";
import ErrorPage from "@/components/error-page";

interface ChapterProps {
  id: string;
  initialData?: Chapter;
}

export default function ChapterPage({ id, initialData }: ChapterProps) {
  const { addHistory: addHistoryV2 } = useReadingHistoryV2();
  const {
    data: res,
    isLoading,
    error,
  } = useGetChapterId(id, {
    query: {
      initialData: initialData
        ? { data: initialData, status: 200 as const, headers: new Headers() }
        : undefined,
      refetchOnMount: !initialData,
      refetchInterval: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  const data = res?.data;

  const mangaId = data?.relationships?.manga?.id;

  const { data: mangaRes } = useGetMangaId(mangaId ?? "", {
    query: {
      enabled: !!mangaId,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  const mangaData = mangaRes?.status === 200 ? mangaRes.data : undefined;

  useEffect(() => {
    try {
      if (data && mangaId) {
        const now = new Date().toISOString();
        const meta = mangaData
          ? {
              title: parseMangaTitle(mangaData).title,
              coverId: mangaData.relationships?.cover?.id ?? null,
            }
          : undefined;
        addHistoryV2(
          mangaId,
          {
            chapterId: id,
            chapter: data.chapter ?? null,
            title: data.title ?? null,
            language: data.language ?? null,
            groups: (data.relationships?.groups ?? []).map((g) => ({
              id: g.id ?? "",
              name: g.name ?? "",
            })),
            readAt: now,
          },
          meta,
        );
      }
    } catch (error) {
      console.error(error);
      return;
    }
  }, [addHistoryV2, data, id, mangaData, mangaId]);

  if (error) {
    if ((error as any).status === 404) return <ErrorPage statusCode={404} />;
    if ((error as any).status === 503) return <ErrorPage statusCode={503} />;
    return <div>Lỗi mất rồi 😭</div>;
  }

  if (isLoading || !data)
    return (
      <div className="grid grid-cols-1 gap-2 pb-2">
        <Skeleton className="w-1/2 md:w-1/5 h-5 bg-gray-500 rounded-sm" />
        <Skeleton className="w-3/4 md:w-1/3 h-5 bg-gray-500 rounded-sm" />
        <Skeleton className="w-1/4 h-5 bg-gray-500 rounded-sm" />
      </div>
    );

  const pages = (data.data ?? [])
    .filter((p) => p.name)
    .map((p) => `${siteConfig.weebdex.proxyURL}/data/${id}/${p.name}`);

  return (
    <>
      <div className="border-grid flex flex-1 flex-col">
        <ReaderHeader />
        {pages.length > 0 && (
          <Reader key={data.id} images={pages} chapterData={data} />
        )}
      </div>
      <ReaderSidebar chapter={data} side="right" />
    </>
  );
}
