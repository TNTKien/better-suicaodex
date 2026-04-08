"use client";

import useKeyDown from "@/hooks/use-keydown";
import { useReaderImages } from "@/hooks/use-reader-images";
import type { GetV2ChaptersById200Data } from "@/lib/moetruyen/model/getV2ChaptersById200Data";
import { useReaderStore } from "@/store/reader-store";
import { useRouter } from "@bprogress/next";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import MoeChapterNav from "./moe-chapter-nav";
import MoeDoublePage from "./moe-double-page";
import MoeLongStrip from "./moe-long-strip";
import MoeSinglePage from "./moe-single-page";
import { getMoeChapterHref, type MoeChapterListItem } from "./moe-reader-utils";

type SpreadPages = [number] | [number, number];

interface MoeReaderProps {
  images: string[];
  chapterData: GetV2ChaptersById200Data;
  chapterList?: MoeChapterListItem[];
  isChapterListLoading?: boolean;
}

function makeSpreads(count: number, offset: number): SpreadPages[] {
  const result: SpreadPages[] = [];
  let index = 0;

  while (index < Math.min(offset, count)) {
    result.push([index]);
    index += 1;
  }

  while (index < count) {
    if (index + 1 < count) {
      result.push([index, index + 1]);
      index += 2;
    } else {
      result.push([index]);
      index += 1;
    }
  }

  return result;
}

export default function MoeReader({
  images,
  chapterData,
  chapterList,
  isChapterListLoading,
}: MoeReaderProps) {
  const router = useRouter();
  const { mode, spreadOffset } = useReaderStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { pages, retry, markLoaded, markFailed } = useReaderImages(
    images,
    currentIndex,
  );

  const spreads = useMemo(
    () => makeSpreads(images.length, spreadOffset),
    [images.length, spreadOffset],
  );

  const currentSpreadIndex = useMemo(
    () =>
      Math.max(
        0,
        spreads.findIndex((spread) => spread.includes(currentIndex)),
      ),
    [spreads, currentIndex],
  );

  const goPrevChapter = useCallback(() => {
    if (chapterData.prevChapter?.id) {
      toast.info("Đang chuyển chương...", {
        duration: 3000,
        closeButton: false,
      });
      router.push(getMoeChapterHref(chapterData.prevChapter.id));
    } else {
      toast.warning("Đây là chương đầu tiên mà!");
    }
  }, [chapterData.prevChapter, router]);

  const goNextChapter = useCallback(() => {
    if (chapterData.nextChapter?.id) {
      toast.info("Đang chuyển chương...", {
        duration: 3000,
        closeButton: false,
      });
      router.push(getMoeChapterHref(chapterData.nextChapter.id));
    } else {
      toast.warning("Đây là chương mới nhất rồi nha!");
    }
  }, [chapterData.nextChapter, router]);

  const goPrevPage = useCallback(() => {
    if (mode === "double") {
      if (currentSpreadIndex > 0) {
        setCurrentIndex(spreads[currentSpreadIndex - 1][0]);
      } else {
        goPrevChapter();
      }
      return;
    }

    if (currentIndex > 0) {
      setCurrentIndex((value) => value - 1);
    } else {
      goPrevChapter();
    }
  }, [mode, currentSpreadIndex, spreads, currentIndex, goPrevChapter]);

  const goNextPage = useCallback(() => {
    if (mode === "double") {
      if (currentSpreadIndex < spreads.length - 1) {
        setCurrentIndex(spreads[currentSpreadIndex + 1][0]);
      } else {
        goNextChapter();
      }
      return;
    }

    if (currentIndex < images.length - 1) {
      setCurrentIndex((value) => value + 1);
    } else {
      goNextChapter();
    }
  }, [
    mode,
    currentSpreadIndex,
    spreads,
    currentIndex,
    images.length,
    goNextChapter,
  ]);

  const handleLeft = useCallback(() => {
    if (mode === "long-strip") {
      goPrevChapter();
      return;
    }

    if (mode === "single-rtl") {
      goNextPage();
      return;
    }

    goPrevPage();
  }, [mode, goPrevChapter, goPrevPage, goNextPage]);

  const handleRight = useCallback(() => {
    if (mode === "long-strip") {
      goNextChapter();
      return;
    }

    if (mode === "single-rtl") {
      goPrevPage();
      return;
    }

    goNextPage();
  }, [mode, goNextChapter, goPrevPage, goNextPage]);

  useKeyDown("ArrowLeft", handleLeft);
  useKeyDown("ArrowRight", handleRight);

  const renderView = () => {
    switch (mode) {
      case "long-strip":
        return (
          <MoeLongStrip
            pages={pages}
            retry={retry}
            markLoaded={markLoaded}
            markFailed={markFailed}
            onCurrentIndexChange={setCurrentIndex}
          />
        );
      case "single":
        return (
          <MoeSinglePage
            pages={pages}
            currentIndex={currentIndex}
            retry={retry}
            markLoaded={markLoaded}
            markFailed={markFailed}
            onNavigatePrev={goPrevPage}
            onNavigateNext={goNextPage}
          />
        );
      case "single-rtl":
        return (
          <MoeSinglePage
            pages={pages}
            currentIndex={currentIndex}
            retry={retry}
            markLoaded={markLoaded}
            markFailed={markFailed}
            rtl
            onNavigatePrev={goPrevPage}
            onNavigateNext={goNextPage}
          />
        );
      case "double":
        return (
          <MoeDoublePage
            pages={pages}
            spreadPages={spreads[currentSpreadIndex] ?? [currentIndex]}
            retry={retry}
            markLoaded={markLoaded}
            markFailed={markFailed}
            onNavigatePrev={goPrevPage}
            onNavigateNext={goNextPage}
          />
        );
    }
  };

  return (
    <>
      {renderView()}
      <MoeChapterNav
        chapterData={chapterData}
        chapterList={chapterList}
        isChapterListLoading={isChapterListLoading}
      />
    </>
  );
}
