"use client";

import Reader from "./reader";
import { Skeleton } from "@/components/ui/skeleton";
import { getChapterDetail } from "@/lib/mangadex/chapter";
import useSWR from "swr";
import ChapterNotFound from "./chapter-notfound";
import MangaMaintain from "@/components/Manga/manga-maintain";
import useReadingHistory from "@/hooks/use-reading-history";
import { useEffect } from "react";
import { type Chapter } from "@/types/types";
import { ReaderSidebar } from "./reader-sidebar";
import { ReaderHeader } from "./reader-header";

interface ChapterProps {
  id: string;
  initialData?: Chapter;
}

export default function ChapterPage({ id, initialData }: ChapterProps) {
  const { addHistory } = useReadingHistory();
  const { data, isLoading, error } = useSWR(
    [`chapter-${id}`, id],
    ([, id]) => getChapterDetail(id),
    {
      fallbackData: initialData, // Use server data as initial value
      revalidateOnMount: !initialData, // Only revalidate on mount if no initial data
      refreshInterval: 1000 * 60 * 30,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  useEffect(() => {
    try {
      if (data && data.manga) {
        addHistory(data.manga.id, {
          chapterId: id,
          chapter: data.chapter,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(error);
      return;
    }
  }, [addHistory, data, id]);

  if (error) {
    if (error.status === 404) return <ChapterNotFound />;
    if (error.status === 503) return <MangaMaintain />;
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

  return (
    <>
      <div className="border-grid flex flex-1 flex-col">
        <ReaderHeader />
        {!!data.pages && <Reader key={data.id} images={data.pages} chapterData={data} />}
      </div>
      <ReaderSidebar chapter={data} side="right"/>
    </>
  );
}
