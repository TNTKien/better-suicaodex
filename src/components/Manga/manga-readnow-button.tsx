"use client";

import { useConfig } from "@/hooks/use-config";
import { FirstChapters } from "@/lib/mangadex/manga";
import { getChapterAggregate } from "@/lib/mangadex/chapter";
import { useState, memo } from "react";
import { Button } from "../ui/button";
import { BookOpen, BookX, Loader2 } from "lucide-react";
import useReadingHistory from "@/hooks/use-reading-history";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { SingleCard } from "../Chapter/ChapterList/chapter-card";
import NoPrefetchLink from "../Custom/no-prefetch-link";

interface MangaReadNowButtonProps {
  id: string; //mangaid
  language: string[];
}

export function MangaReadNowButton({ id, language }: MangaReadNowButtonProps) {
  const [config] = useConfig();
  const [shouldFetch, setShouldFetch] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const router = useRouter();

  const { history } = useReadingHistory();
  const readingHistory = history[id];

  // Check if manga language matches config language
  const hasMatchingLanguage = language.length > 0 && 
    config.translatedLanguage.some(lang => language.includes(lang));

  // Fetch chapters using SWR
  const { data: chapters, isLoading } = useSWR(
    shouldFetch && !readingHistory && hasMatchingLanguage
      ? [`chapters-${id}`, config.translatedLanguage, config.r18]
      : null,
    async () => {
      // First get the chapter aggregate to find the oldest volume and chapter
      const aggregate = await getChapterAggregate(id, config.translatedLanguage);
      
      if (!aggregate || aggregate.length === 0) {
        return [];
      }

      // Get the oldest volume (last in the sorted array)
      const oldestVolume = aggregate[aggregate.length - 1];
      
      // Get the oldest chapter in that volume (last in the sorted array)
      const oldestChapter = oldestVolume.chapters[oldestVolume.chapters.length - 1];
      
      // Fetch chapters with the specific volume and chapter
      const result = await FirstChapters(
        id,
        config.r18,
        config.translatedLanguage,
        oldestVolume.vol,
        oldestChapter.chapter
      );
      return result;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (data) => {
        if (!data || data.length === 0) return;

        if (data.length === 1) {
          // Only one chapter available, navigate directly
          router.push(`/chapter/${data[0].id}`);
        } else {
          // Multiple chapters available, show dialog
          setShowDialog(true);
        }
      },
    },
  );

  const handleReadNow = () => {
    // If data is already available
    if (chapters && chapters.length > 0) {
      if (chapters.length === 1) {
        router.push(`/chapter/${chapters[0].id}`);
      } else {
        setShowDialog(true);
      }
    } else {
      // Otherwise, trigger fetch
      setShouldFetch(true);
    }
  };

  // If there's reading history
  if (readingHistory) {
    const label = readingHistory.chapter
      ? `Đọc tiếp Ch. ${readingHistory.chapter}`
      : `Đọc tiếp`;
    return (
      <Button
        variant="secondary"
        className="rounded-sm md:h-10 grow md:grow-0"
        asChild
      >
        <NoPrefetchLink href={`/chapter/${readingHistory.chapterId}`}>
          <BookOpen />
          {label}
        </NoPrefetchLink>
      </Button>
    );
  }

  // If no matching language or manga language is empty, show disabled BookX button
  if (!hasMatchingLanguage) {
    return (
      <Button
        variant="secondary"
        disabled
        className="rounded-sm md:h-10 grow md:grow-0"
      >
        <BookX />
        Đọc ngay
      </Button>
    );
  }

  // If no chapters available after fetch, BookX btn
  if (chapters && chapters.length === 0) {
    return (
      <Button
        variant="secondary"
        disabled
        className="rounded-sm md:h-10 grow md:grow-0"
      >
        <BookX />
        Đọc ngay
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        className="rounded-sm md:h-10 grow md:grow-0"
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

export default memo(MangaReadNowButton);