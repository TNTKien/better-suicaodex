"use client";

import NewReader from "@/components/Chapter/NewReader";
import { Skeleton } from "@/components/ui/skeleton";
import { getChapterDetail } from "@/lib/mangadex/chapter";
import useSWR from "swr";
import ChapterNotFound from "./chapter-notfound";
import MangaMaintain from "@/components/Manga/manga-maintain";
import useReadingHistory from "@/hooks/use-reading-history";
import { useEffect } from "react";

interface ChapterProps {
  id: string;
}

export default function Chapter({ id }: ChapterProps) {
  const { addHistory } = useReadingHistory();
  const { data, isLoading, error } = useSWR(
    ["chapter", id],
    ([, id]) => getChapterDetail(id),
    {
      refreshInterval: 1000 * 60 * 30,
      revalidateOnFocus: false,
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

  if (isLoading)
    return (
      <div className="grid grid-cols-1 gap-2 pb-2">
        <Skeleton className="w-1/2 md:w-1/5 h-5 bg-gray-500 rounded-sm" />
        <Skeleton className="w-3/4 md:w-1/3 h-5 bg-gray-500 rounded-sm" />
        <Skeleton className="w-1/4 h-5 bg-gray-500 rounded-sm" />
      </div>
    );
  if (error) {
    if (error.status === 404) return <ChapterNotFound />;
    if (error.status === 503) return <MangaMaintain />;
    // console.log(error)
    return <div>Lỗi mất rồi 😭</div>;
  }
  if (!data) return <div>Not found</div>;

  console.log("Chapter render", { id, data });

  return (
    <NewReader chapter={data} />
  );
}
