"use client";

import { useConfig } from "@/hooks/use-config";
import { FirstEnChapter, FirstViChapter } from "@/lib/mangadex/manga";
import { useEffect, useState, memo, useMemo } from "react";
import { Button } from "../ui/button";
import { BookOpen, BookX, Loader2 } from "lucide-react";
import { Chapter } from "@/types/types";
import Link from "next/link";
import useReadingHistory from "@/hooks/use-reading-history";

interface MangaReadButtonProps {
  id: string;
}

function MangaReadButtons({ id }: MangaReadButtonProps) {
  const [config] = useConfig();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chapter, setChapter] = useState<Chapter>();

  const { history } = useReadingHistory();
  const readingHistory = history[id];

  // Use primitive values instead of objects/arrays in dependencies
  const r18 = config.r18;
  const translatedLanguageKey = useMemo(
    () => JSON.stringify(config.translatedLanguage),
    [config.translatedLanguage]
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!!readingHistory) {
        setIsLoading(false);
        return;
      }
      try {
        if (translatedLanguageKey === JSON.stringify(["en"])) {
          const res = await FirstEnChapter(id, r18);
          setChapter(res);
        } else if (translatedLanguageKey === JSON.stringify(["vi"])) {
          const res = await FirstViChapter(id, r18);
          setChapter(res);
        } else {
          const vi = await FirstViChapter(id, r18);
          const en = await FirstEnChapter(id, r18);
          if (!!vi) {
            setChapter(vi);
          } else {
            setChapter(en);
          }
        }
      } catch (err) {
        setError(true);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, r18, translatedLanguageKey, readingHistory]);

  if (isLoading) {
    return (
      <Button
        variant="secondary"
        disabled
        className="rounded-sm md:h-10 grow md:grow-0"
      >
        <Loader2 className="animate-spin" />
      </Button>
    );
  }

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
        <Link href={`/chapter/${readingHistory.chapterId}`}>
          <BookOpen />
          {label}
        </Link>
      </Button>
    );
  }

  if (error) {
    return (
      <Button
        variant="secondary"
        disabled
        className="rounded-sm md:h-10 grow md:grow-0"
      >
        Lỗi mất rồi 😭
      </Button>
    );
  }

  if (!chapter) {
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
    <Button
      variant="secondary"
      className="rounded-sm md:h-10 grow md:grow-0"
      asChild
    >
      <Link href={`/chapter/${chapter.id}`}>
        <BookOpen />
        Đọc ngay
      </Link>
    </Button>
  );
}

export default memo(MangaReadButtons);
