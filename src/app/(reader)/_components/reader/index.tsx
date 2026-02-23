"use client";

import useKeyDown from "@/hooks/use-keydown";
import { useReaderImages } from "@/hooks/use-reader-images";
import { getChapterAggregate } from "@/lib/mangadex/chapter";
import { cn } from "@/lib/utils";
import { useReaderStore } from "@/store/reader-store";
import { Chapter } from "@/types/types";
import { useRouter } from "@bprogress/next";
import { ArrowLeft, ArrowRight, ChevronsUp, PanelRightClose } from "lucide-react";
import { ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWRMutation from "swr/mutation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { useSidebar } from "@/components/ui/sidebar-2-reader";
import ChapterNav from "./chapter-nav";
import DoublePage from "./double-page";
import LongStrip from "./long-strip";
import SinglePage from "./single-page";

// ── Types ──────────────────────────────────────────────────────────────────
type SpreadPages = [number] | [number, number];

interface ReaderProps {
  images: string[];
  chapterData: Chapter;
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Chia pages thành các spreads cho chế độ 2 trang */
function makeSpreads(count: number, offset: number): SpreadPages[] {
  const result: SpreadPages[] = [];
  let i = 0;
  while (i < Math.min(offset, count)) { result.push([i]); i++; }
  while (i < count) {
    if (i + 1 < count) { result.push([i, i + 1]); i += 2; }
    else { result.push([i]); i++; }
  }
  return result;
}

const MAX_RETRIES = 3;

// ── Component ──────────────────────────────────────────────────────────────
export default function Reader({ images, chapterData }: ReaderProps) {
  const router = useRouter();
  const { mode, spreadOffset } = useReaderStore();

  // ── Page state ────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const { pages, retry } = useReaderImages(images, currentIndex);

  // Reset to page 0 only when the chapter itself changes, not on SWR background revalidation
  // (which may swap in a new array reference for the same chapter and would reset mid-session)
  useEffect(() => { setCurrentIndex(0); }, [chapterData.id]);

  // ── Spreads (double mode) ─────────────────────────────────────────────
  const spreads = useMemo(
    () => makeSpreads(images.length, spreadOffset),
    [images.length, spreadOffset],
  );

  const currentSpreadIdx = useMemo(
    () => Math.max(0, spreads.findIndex((s) => s.includes(currentIndex))),
    [spreads, currentIndex],
  );

  // ── Chapter aggregate ─────────────────────────────────────────────────
  const [retryCount, setRetryCount] = useState(0);
  const [reachedMaxRetries, setReachedMaxRetries] = useState(false);

  const { data: chapterAggregate, isMutating, error, trigger } = useSWRMutation(
    [`chapter-aggregate-${chapterData.id}`, chapterData.manga.id, [chapterData.language], chapterData.group.map((g) => g.id)],
    ([, mangaId, language, groups]) => getChapterAggregate(mangaId, language, groups),
  );

  const chapterExists = chapterAggregate?.some((vol) =>
    vol.chapters.some((ch) => ch.id === chapterData.id || ch.other?.includes(chapterData.id)),
  );

  useEffect(() => {
    if (!chapterAggregate) { trigger(); return; }
    if (!chapterExists && retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      const t = setTimeout(() => { setRetryCount((n) => n + 1); trigger(); }, delay);
      return () => clearTimeout(t);
    }
    if (!chapterExists && retryCount >= MAX_RETRIES) setReachedMaxRetries(true);
  }, [chapterAggregate, chapterExists, retryCount, trigger]);

  useEffect(() => { setRetryCount(0); setReachedMaxRetries(false); }, [chapterData.id]);

  const handleAggregateRetry = () => { setRetryCount(0); setReachedMaxRetries(false); trigger(); };

  // ── Chapter navigation ────────────────────────────────────────────────
  const { prevChapterId, nextChapterId } = useMemo(() => {
    if (!chapterAggregate || !chapterExists) return { prevChapterId: undefined, nextChapterId: undefined };
    let volIdx = chapterAggregate.findIndex((v) => v.chapters.some((c) => c.id === chapterData.id));
    if (volIdx === -1) volIdx = chapterAggregate.findIndex((v) => v.chapters.some((c) => c.other?.includes(chapterData.id)));
    const chIdx = chapterAggregate[volIdx]?.chapters.findIndex((c) => c.id === chapterData.id) ?? -1;
    const prev = chapterAggregate[volIdx]?.chapters[chIdx + 1]?.id ?? chapterAggregate[volIdx + 1]?.chapters[0]?.id;
    const next = chapterAggregate[volIdx]?.chapters[chIdx - 1]?.id ?? chapterAggregate[volIdx - 1]?.chapters.at(-1)?.id;
    return { prevChapterId: prev, nextChapterId: next };
  }, [chapterAggregate, chapterExists, chapterData.id]);

  const goPrevChapter = useCallback(() => {
    if (prevChapterId) { toast.loading("Đang chuyển chương...", {duration: 3000}); router.push(`/chapter/${prevChapterId}`); }
    else toast.warning("Đây là chương đầu tiên mà!");
  }, [prevChapterId, router]);

  const goNextChapter = useCallback(() => {
    if (nextChapterId) { toast.loading("Đang chuyển chương...", {duration: 3000}); router.push(`/chapter/${nextChapterId}`); }
    else toast.warning("Đây là chương mới nhất rồi nha!");
  }, [nextChapterId, router]);

  // ── Page navigation ───────────────────────────────────────────────────
  const goPrevPage = useCallback(() => {
    if (mode === "double") {
      if (currentSpreadIdx > 0) setCurrentIndex(spreads[currentSpreadIdx - 1][0]);
      else goPrevChapter();
    } else {
      if (currentIndex > 0) setCurrentIndex((i) => i - 1);
      else goPrevChapter();
    }
  }, [mode, currentIndex, currentSpreadIdx, spreads, goPrevChapter]);

  const goNextPage = useCallback(() => {
    if (mode === "double") {
      if (currentSpreadIdx < spreads.length - 1) setCurrentIndex(spreads[currentSpreadIdx + 1][0]);
      else goNextChapter();
    } else {
      if (currentIndex < images.length - 1) setCurrentIndex((i) => i + 1);
      else goNextChapter();
    }
  }, [mode, currentIndex, currentSpreadIdx, spreads, images.length, goNextChapter]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  // Long-strip: mũi tên = chuyển chương | page modes: mũi tên = chuyển trang
  const handleLeft  = useCallback(() => mode === "long-strip" ? goPrevChapter() : mode === "single-rtl" ? goNextPage() : goPrevPage(), [mode, goPrevChapter, goPrevPage, goNextPage]);
  const handleRight = useCallback(() => mode === "long-strip" ? goNextChapter() : mode === "single-rtl" ? goPrevPage() : goNextPage(), [mode, goNextChapter, goNextPage, goPrevPage]);

  useKeyDown("ArrowLeft",  handleLeft);
  useKeyDown("ArrowRight", handleRight);

  // ── Aggregate loading states ──────────────────────────────────────────
  const aggregateLoading = isMutating || (chapterAggregate && !chapterExists && !reachedMaxRetries);
  const aggregateError   = (chapterAggregate && !chapterExists && reachedMaxRetries) || !!error;

  // ── Render ────────────────────────────────────────────────────────────
  const renderView = () => {
    switch (mode) {
      case "long-strip":
        return <LongStrip pages={pages} retry={retry} onCurrentIndexChange={setCurrentIndex} />;
      case "single":
        return <SinglePage pages={pages} currentIndex={currentIndex} retry={retry} onNavigatePrev={goPrevPage} onNavigateNext={goNextPage} />;
      case "single-rtl":
        return <SinglePage pages={pages} currentIndex={currentIndex} retry={retry} rtl onNavigatePrev={goPrevPage} onNavigateNext={goNextPage} />;
      case "double":
        return (
          <DoublePage
            pages={pages}
            spreadPages={spreads[currentSpreadIdx] ?? [currentIndex]}
            retry={retry}
            onNavigatePrev={goPrevPage}
            onNavigateNext={goNextPage}
          />
        );
    }
  };

  const renderNav = () => {
    if (aggregateLoading)
      return (
        <LoadingNav
          button={
            <Button className="w-full md:min-w-48 justify-start whitespace-normal! break-all! shrink!" variant="outline">
              <Spinner />
              {retryCount > 0 ? `Đang tải (${retryCount}/${MAX_RETRIES})` : "Đang tải..."}
            </Button>
          }
        />
      );

    if (aggregateError)
      return (
        <LoadingNav
          button={
            <Button className="w-full md:min-w-48" variant="destructive" onClick={handleAggregateRetry}>
              {error ? "Lỗi. Thử lại?" : "Không có dữ liệu. Thử lại?"}
            </Button>
          }
        />
      );

    if (chapterAggregate && chapterExists)
      return (
        <ChapterNav
          chapterData={chapterData}
          chapterAggregate={chapterAggregate}
          prevChapterId={prevChapterId}
          nextChapterId={nextChapterId}
        />
      );

    return null;
  };

  return (
    <>
      {renderView()}
      {renderNav()}
    </>
  );
}

// ── LoadingNav ─────────────────────────────────────────────────────────────
interface LoadingNavProps {
  button: ReactElement;
}

function LoadingNav({ button }: LoadingNavProps) {
  const scrollDirection = useScrollDirection();
  const { isAtBottom, isAtTop } = useScrollOffset();
  const { state, isMobile, toggleSidebar } = useSidebar();

  return (
    <Card
      className={cn(
        "overflow-x-auto fixed bottom-0 left-1/2 transform -translate-x-1/2 md:-translate-x-[calc(50%+var(--sidebar-width-icon)/2)] z-10 transition-all duration-300",
        "mx-auto flex w-full translate-y-0 items-center justify-center rounded-none bg-background border-none",
        "md:rounded-lg md:w-auto md:-translate-y-2",
        !isMobile && state === "expanded" && "md:-translate-x-[calc(50%+var(--sidebar-width)/2)] translate-y-full md:translate-y-full",
        isAtBottom && "translate-y-full md:translate-y-full",
        scrollDirection === "down" && !isAtBottom && "translate-y-full md:translate-y-full",
      )}
    >
      <CardContent className="flex gap-2 p-2 md:gap-1.5 md:p-1.5 w-full">
        <Button disabled size="icon" className="shrink-0 [&_svg]:size-5"><ArrowLeft /></Button>
        {button}
        <Button disabled size="icon" className="shrink-0 [&_svg]:size-5"><ArrowRight /></Button>
        <Button size="icon" className="shrink-0 [&_svg]:size-5" onClick={toggleSidebar}><PanelRightClose /></Button>
        <Button size="icon" disabled={isAtTop} className="shrink-0 [&_svg]:size-5" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><ChevronsUp /></Button>
      </CardContent>
    </Card>
  );
}
