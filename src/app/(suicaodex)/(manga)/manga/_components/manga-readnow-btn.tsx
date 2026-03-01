"use client";

import { useConfig } from "@/hooks/use-config";
import useReadingHistoryV2 from "@/hooks/use-reading-history-v2";
import { Chapter } from "@/lib/weebdex/model";
import { GetMangaIdChaptersOrder } from "@/lib/weebdex/model/getMangaIdChaptersOrder";
import { GetMangaIdChaptersSort } from "@/lib/weebdex/model/getMangaIdChaptersSort";
import { BookOpen, BookX, Loader2 } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SingleCard } from "./chapters-list/chapter-card";
import {
  getMangaIdAggregate,
  getMangaIdChapters,
} from "@/lib/weebdex/hooks/chapter/chapter";

interface MangaReadNowBtnProps {
  id: string;
}

//TODO: check history after
export function MangaReadNowBtn({ id }: MangaReadNowBtnProps) {
  const [config] = useConfig();
  const [shouldFetch, setShouldFetch] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  const { history } = useReadingHistoryV2();
  const readingHistory = history[id]?.chapters[0];

  const { data: chapters, isLoading } = useQuery({
    queryKey: [`wd-readnow-${id}`, config.translatedLanguage],
    queryFn: async (): Promise<Chapter[]> => {
      // Fetch aggregate to find the first (oldest) chapter number
      const aggregateRes = await getMangaIdAggregate(id, {
        tlang: config.translatedLanguage,
      });
      if (aggregateRes.status !== 200) return [];
      const aggregateChapters = aggregateRes.data.chapters ?? [];
      if (aggregateChapters.length === 0) return [];

      // Find the oldest chapter (first by chapter number ascending)
      const sorted = [...aggregateChapters].sort((a, b) => {
        const aNum = parseFloat(a.chapter ?? "Infinity");
        const bNum = parseFloat(b.chapter ?? "Infinity");
        if (isNaN(aNum) && isNaN(bNum)) return 0;
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return aNum - bNum;
      });

      const oldestChapterNum = sorted[0]?.chapter ?? null;

      // Fetch chapters sorted ascending, filtered by language
      const chaptersRes = await getMangaIdChapters(id, {
        tlang: config.translatedLanguage,
        order: GetMangaIdChaptersOrder.asc,
        sort: GetMangaIdChaptersSort.name,
        limit: 20,
      });
      if (chaptersRes.status !== 200) return [];
      const allChapters = chaptersRes.data.data ?? [];

      if (allChapters.length === 0) return [];

      // Filter to only chapters matching the oldest chapter number
      const firstChapters = allChapters.filter(
        (ch) => ch.chapter === oldestChapterNum,
      );

      return firstChapters.length > 0 ? firstChapters : [allChapters[0]];
    },
    enabled: shouldFetch && !readingHistory,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!shouldFetch || !chapters || chapters.length === 0) return;
    setShouldFetch(false);
    if (chapters.length === 1) {
      router.push(`/chapter/${chapters[0].id}`);
    } else {
      setShowDialog(true);
    }
  }, [shouldFetch, chapters, router]);

  const handleReadNow = () => {
    if (chapters && chapters.length > 0) {
      if (chapters.length === 1) {
        router.push(`/chapter/${chapters[0].id}`);
      } else {
        setShowDialog(true);
      }
    } else {
      setShouldFetch(true);
    }
  };

  if (readingHistory) {
    const label = readingHistory.chapter
      ? `Đọc tiếp Ch. ${readingHistory.chapter}`
      : `Đọc tiếp`;
    return (
      <Button variant="secondary" className="flex-1 md:flex-initial" asChild>
        <NoPrefetchLink href={`/chapter/${readingHistory.chapterId}`}>
          <BookOpen />
          {label}
        </NoPrefetchLink>
      </Button>
    );
  }

  if (chapters && chapters.length === 0) {
    return (
      <Button variant="secondary" disabled className="flex-1 md:flex-initial">
        <BookX />
        Đọc ngay
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        className="flex-1 md:flex-initial"
        onClick={handleReadNow}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="animate-spin" /> : <BookOpen />}
        Đọc ngay
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl!">
          <DialogHeader>
            <DialogTitle>Chọn chapter</DialogTitle>
            <DialogDescription>Chọn chapter bạn muốn đọc</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {chapters?.map((chapter) => (
              <SingleCard key={chapter.id} chapter={chapter} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default memo(MangaReadNowBtn);
