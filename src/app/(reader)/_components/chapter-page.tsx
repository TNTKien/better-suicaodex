"use client";

import Reader from "./reader";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetChapterId } from "@/lib/weebdex/hooks/chapter/chapter";
import ChapterNotFound from "./chapter-notfound";
import MangaMaintain from "@/components/Manga/manga-maintain";
import useReadingHistory from "@/hooks/use-reading-history";
import { useEffect } from "react";
import { type Chapter } from "@/lib/weebdex/model";
import { ReaderSidebar } from "./reader-sidebar";
import { ReaderHeader } from "./reader-header";
import { siteConfig } from "@/config/site";

interface ChapterProps {
  id: string;
  initialData?: Chapter;
}

export default function ChapterPage({ id, initialData }: ChapterProps) {
  const { addHistory } = useReadingHistory();
  const { data: res, isLoading, error } = useGetChapterId(id, {
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

  useEffect(() => {
    try {
      if (data && mangaId) {
        addHistory(mangaId, {
          chapterId: id,
          chapter: data.chapter ?? null,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(error);
      return;
    }
  }, [addHistory, data, id, mangaId]);

  if (error) {
    if ((error as any).status === 404) return <ChapterNotFound />;
    if ((error as any).status === 503) return <MangaMaintain />;
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
        {pages.length > 0 && <Reader key={data.id} images={pages} chapterData={data} />}
      </div>
      <ReaderSidebar chapter={data} side="right"/>
    </>
  );
}

