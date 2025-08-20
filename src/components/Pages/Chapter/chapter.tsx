"use client";

import ChapterInfo from "@/components/Chapter/ChapterReader/chapter-info";
import Reader from "@/components/Chapter/ChapterReader/Reader";
import { Skeleton } from "@/components/ui/skeleton";
import { getChapterDetail } from "@/lib/mangadex/chapter";
import useSWR from "swr";
import ChapterNotFound from "./chapter-notfound";
import MangaMaintain from "@/components/Manga/manga-maintain";
import useReadingHistory from "@/hooks/use-reading-history";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/hooks/use-config";
import { usePathname } from "next/navigation";
import { DownloadButton } from "@/features/downloads/DownloadButton";

interface ChapterProps {
  id: string;
}

export default function Chapter({ id }: ChapterProps) {
  const [config] = useConfig();
  const pathName = usePathname();
  const { addHistory } = useReadingHistory();
  const { data, isLoading, error } = useSWR(
    ["chapter", id],
    ([, id]) => getChapterDetail(id),
    {
      refreshInterval: 1000 * 60 * 30,
      revalidateOnFocus: false,
    }
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

  useEffect(() => {
    if (pathName.includes("/chapter/") && config.reader.type === "single") {
      document.body.classList.add("page-no-padding");
      return () => document.body.classList.remove("page-no-padding");
    }
  }, [config.reader.type]);

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

  return (
    <div className={cn()}>
      <ChapterInfo chapter={data} />
      
      {/* Download Button */}
      <div className="px-4 py-2 border-b">
        <DownloadButton chapterId={id} showProgress={true} />
      </div>

      {!!data.pages && <Reader images={data.pages} chapterData={data} />}
    </div>
  );
}
