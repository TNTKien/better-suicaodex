"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutPanelLeft,
  MessageSquareText,
  PanelLeft,
  PanelRight,
  Settings,
  SquareSplitHorizontal,
  SquareSplitVertical,
} from "lucide-react";

import { useReaderConfig } from "@/hooks/use-reader-config";
import type { ReaderConfig } from "@/hooks/use-reader-config";
import { useReaderPages } from "./use-reader-pages";
import {
  getNextPageIndex,
  getPrevPageIndex,
  getSpreadPages,
  resolveClickDirection,
  type ReaderPage,
} from "./reader-utils";
import { cn, formatChapterTitle, generateSlug } from "@/lib/utils";
import { Chapter, ChapterAggregate } from "@/types/types";
import { getChapterAggregate } from "@/lib/mangadex/chapter";
import { fetchMangaDetail } from "@/lib/mangadex/manga";
import { useIsMobile } from "@/hooks/use-mobile";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import CommentList from "@/components/Comment/comment-list";
import CommentFormSimple from "@/components/Comment/comment-form-simple";
import { ChapterTitle } from "@/components/Chapter/ChapterReader/chapter-info";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NewReaderProps {
  chapter: Chapter;
}

const SCALE_OPTIONS = [
  {
    value: "original" as const,
    label: "Original",
    description: "Giữ nguyên kích thước ảnh gốc.",
  },
  {
    value: "limit" as const,
    label: "Limit All",
    description: "Giới hạn chiều rộng và chiều cao theo màn hình.",
  },
  {
    value: "limit-width" as const,
    label: "Limit Width",
    description: "Giới hạn theo chiều ngang (khuyến nghị).",
  },
  {
    value: "limit-height" as const,
    label: "Limit Height",
    description: "Giới hạn theo chiều dọc.",
  },
  {
    value: "stretch" as const,
    label: "Stretch All",
    description: "Kéo giãn cả ngang và dọc.",
  },
  {
    value: "stretch-width" as const,
    label: "Stretch Width",
    description: "Kéo giãn theo chiều ngang.",
  },
  {
    value: "stretch-height" as const,
    label: "Stretch Height",
    description: "Kéo giãn theo chiều dọc.",
  },
];

const PAGE_INDICATOR_THRESHOLD = 500;

export default function NewReader({ chapter }: NewReaderProps) {
  const router = useRouter();
  const params = useParams<{ id: string; page?: string }>();
  const isMobile = useIsMobile();
  const readerConfig = useReaderConfig();
  const setReaderConfig = readerConfig.setConfig;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commentsBlurred, setCommentsBlurred] = useState(true);
  const [miniVisible, setMiniVisible] = useState(true);

  const { pages, pageCount, isLoading, error, currentIndex, setCurrentIndex, retryPage } =
    useReaderPages(chapter.id, readerConfig.dataSaver);

  const [initialPageApplied, setInitialPageApplied] = useState(false);

  const initialPage = useMemo(() => {
    if (!params?.page) return 0;
    const parsed = Number(params.page);
    if (Number.isNaN(parsed) || parsed < 1) return 0;
    return parsed - 1;
  }, [params?.page]);

  useEffect(() => {
    if (!pageCount || initialPageApplied) return;
    const clamped = Math.min(Math.max(initialPage, 0), pageCount - 1);
    setCurrentIndex(clamped);
    setInitialPageApplied(true);
  }, [initialPage, initialPageApplied, pageCount, setCurrentIndex]);

  const { data: aggregate } = useSWR(
    ["aggregate", chapter.manga.id, chapter.language, chapter.group.map((group) => group.id)],
    ([, mangaId, language, groups]) => getChapterAggregate(mangaId, language, groups),
    { revalidateOnFocus: false }
  );

  const { data: mangaDetail } = useSWR(
    chapter.manga.id ? ["manga-detail", chapter.manga.id] : null,
    ([, mangaId]) => fetchMangaDetail(mangaId),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!mangaDetail?.tags?.length) return;
    const longStrip = mangaDetail.tags.some((tag) => tag.name.toLowerCase() === "long strip");
    if (!longStrip) return;

    setReaderConfig({
      direction: "scroll",
      doublePage: false,
      gaps: 0,
      scale: ["original", "limit-width", "stretch-width"].includes(readerConfig.scale)
        ? readerConfig.scale
        : "limit-width",
    });
  }, [mangaDetail?.tags, readerConfig.scale, setReaderConfig]);

  const spreads = useMemo(() => {
    if (!readerConfig.doublePage || readerConfig.direction === "scroll") return [];
    return getSpreadPages(pages, readerConfig.spreadOffset, readerConfig.direction);
  }, [pages, readerConfig.direction, readerConfig.doublePage, readerConfig.spreadOffset]);

  const currentSpread = useMemo(() => {
    if (!spreads.length) return [currentIndex];
    return spreads.find((spread) => spread.includes(currentIndex)) || [currentIndex];
  }, [currentIndex, spreads]);

  const pageRefs = useMemo(
    () => pages.map(() => ({ current: null as HTMLDivElement | null })),
    [pages.length]
  );

  useEffect(() => {
    if (readerConfig.direction !== "scroll" || !pages.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) {
          const index = Number((visible.target as HTMLElement).dataset.pageIndex || "0");
          setCurrentIndex(index);
        }
      },
      {
        root: null,
        rootMargin: "0px 0px -30% 0px",
        threshold: [0.2, 0.5, 0.8],
      }
    );

    pageRefs.forEach((ref, index) => {
      if (ref.current) {
        ref.current.dataset.pageIndex = String(index);
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, [pageRefs, pages.length, readerConfig.direction, setCurrentIndex]);

  useEffect(() => {
    if (readerConfig.direction !== "scroll" || !readerConfig.scrollNavigation || settingsOpen) {
      return;
    }

    let accumulated = 0;
    const onWheel = (event: WheelEvent) => {
      const atTop = window.scrollY <= 0;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;

      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        accumulated += event.deltaY;
        if (Math.abs(accumulated) >= PAGE_INDICATOR_THRESHOLD) {
          if (event.deltaY > 0) {
            goNextChapter();
          } else {
            goPrevChapter();
          }
          accumulated = 0;
        }
      } else {
        accumulated = 0;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [readerConfig.direction, readerConfig.scrollNavigation, settingsOpen]);

  useEffect(() => {
    if (!pageCount) return;

    const url = new URL(window.location.href);
    url.pathname = `/chapter/${chapter.id}/${currentIndex + 1}`;
    window.history.replaceState({}, "", url.toString());
  }, [chapter.id, currentIndex, pageCount]);

  useEffect(() => {
    if (currentIndex >= pageCount - 1) {
      setCommentsBlurred(false);
    }
  }, [currentIndex, pageCount]);

  const jumpToPage = useCallback(
    (index: number) => {
      if (Number.isNaN(index)) return;
      const clamped = Math.min(Math.max(index, 0), pageCount - 1);
      setCurrentIndex(clamped);

      if (readerConfig.direction === "scroll") {
        const ref = pageRefs[clamped]?.current;
        ref?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [pageCount, pageRefs, readerConfig.direction, setCurrentIndex]
  );

  const resolveNextIndex = useCallback(() => {
    if (!pageCount) return null;
    if (readerConfig.doublePage && readerConfig.direction !== "scroll") {
      return getNextPageIndex(spreads, currentIndex, readerConfig.direction);
    }

    if (readerConfig.direction === "rtl") {
      return currentIndex - 1;
    }

    return currentIndex + 1;
  }, [currentIndex, pageCount, readerConfig.direction, readerConfig.doublePage, spreads]);

  const resolvePrevIndex = useCallback(() => {
    if (!pageCount) return null;
    if (readerConfig.doublePage && readerConfig.direction !== "scroll") {
      return getPrevPageIndex(spreads, currentIndex, readerConfig.direction);
    }

    if (readerConfig.direction === "rtl") {
      return currentIndex + 1;
    }

    return currentIndex - 1;
  }, [currentIndex, pageCount, readerConfig.direction, readerConfig.doublePage, spreads]);

  const goNextPage = useCallback(() => {
    const next = resolveNextIndex();
    if (next === null || next >= pageCount) {
      if (readerConfig.chapterNavigation) {
        goNextChapter();
      }
      return;
    }
    if (next < 0) {
      if (readerConfig.chapterNavigation) {
        goPrevChapter();
      }
      return;
    }
    jumpToPage(next);
  }, [jumpToPage, pageCount, readerConfig.chapterNavigation, resolveNextIndex]);

  const goPrevPage = useCallback(() => {
    const prev = resolvePrevIndex();
    if (prev === null || prev < 0) {
      if (readerConfig.chapterNavigation) {
        goPrevChapter();
      }
      return;
    }
    if (prev >= pageCount) {
      if (readerConfig.chapterNavigation) {
        goNextChapter();
      }
      return;
    }
    jumpToPage(prev);
  }, [jumpToPage, pageCount, readerConfig.chapterNavigation, resolvePrevIndex]);

  const flatChapters = useMemo(() => {
    if (!aggregate) return [];
    const list: ChapterAggregate["chapters"] = [];
    aggregate.forEach((volume) => {
      list.push(...volume.chapters);
    });
    return list;
  }, [aggregate]);

  const currentChapterIndex = useMemo(() => {
    if (!flatChapters.length) return -1;
    return flatChapters.findIndex(
      (entry) => entry.id === chapter.id || entry.other?.includes(chapter.id)
    );
  }, [chapter.id, flatChapters]);

  const goToChapterByIndex = useCallback(
    (index: number) => {
      if (!flatChapters[index]) return;
      const entry = flatChapters[index];
      const targetId = entry.id || entry.other?.[0];
      if (!targetId) return;
      router.push(`/chapter/${targetId}`);
    },
    [flatChapters, router]
  );

  const goNextChapter = useCallback(() => {
    if (currentChapterIndex === -1) return;
    const nextIndex = currentChapterIndex - 1;
    if (nextIndex < 0) {
      router.push(`/manga/${chapter.manga.id}/${generateSlug(chapter.manga.title || "")}`);
      return;
    }
    goToChapterByIndex(nextIndex);
  }, [chapter.manga.id, chapter.manga.title, currentChapterIndex, goToChapterByIndex, router]);

  const goPrevChapter = useCallback(() => {
    if (currentChapterIndex === -1) return;
    const prevIndex = currentChapterIndex + 1;
    if (prevIndex >= flatChapters.length) {
      router.push(`/manga/${chapter.manga.id}/${generateSlug(chapter.manga.title || "")}`);
      return;
    }
    goToChapterByIndex(prevIndex);
  }, [chapter.manga.id, chapter.manga.title, currentChapterIndex, flatChapters.length, goToChapterByIndex, router]);

  const goFirstChapter = useCallback(() => {
    if (!flatChapters.length) return;
    goToChapterByIndex(flatChapters.length - 1);
  }, [flatChapters.length, goToChapterByIndex]);

  const goLastChapter = useCallback(() => {
    if (!flatChapters.length) return;
    goToChapterByIndex(0);
  }, [flatChapters.length, goToChapterByIndex]);

  useEffect(() => {
    if (settingsOpen) return;

    let scrollInterval: number | null = null;
    const stopScroll = () => {
      if (scrollInterval) {
        window.clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return;
      if (settingsOpen) return;
      if (["INPUT", "TEXTAREA"].includes((document.activeElement?.tagName || "").toUpperCase())) {
        return;
      }

      const key = event.key.toLowerCase();
      const rtl = readerConfig.direction === "rtl";

      if (["arrowup", "w", "i"].includes(key)) {
        if (readerConfig.direction === "scroll") {
          if (scrollInterval) return;
          scrollInterval = window.setInterval(() => {
            window.scrollBy({ top: -readerConfig.scrollSpeed, behavior: "auto" });
          }, 16);
        }
        return;
      }

      if (["arrowdown", "s", "k"].includes(key)) {
        if (readerConfig.direction === "scroll") {
          if (scrollInterval) return;
          scrollInterval = window.setInterval(() => {
            window.scrollBy({ top: readerConfig.scrollSpeed, behavior: "auto" });
          }, 16);
        }
        return;
      }

      if (["arrowleft", "a", "j"].includes(key)) {
        if (readerConfig.direction === "scroll" && !readerConfig.verticalKeyboardNavigation) {
          return;
        }
        event.preventDefault();
        rtl ? goNextPage() : goPrevPage();
        return;
      }

      if (["arrowright", "d", "l"].includes(key)) {
        if (readerConfig.direction === "scroll" && !readerConfig.verticalKeyboardNavigation) {
          return;
        }
        event.preventDefault();
        rtl ? goPrevPage() : goNextPage();
        return;
      }

      if (key === "/" || key === ".") {
        event.preventDefault();
        if ((key === "/" && !rtl) || (key === "." && rtl)) {
          jumpToPage(pageCount - 1);
        } else {
          jumpToPage(0);
        }
        return;
      }

      if (key === "q" || key === "[") {
        event.preventDefault();
        goPrevChapter();
        return;
      }

      if (key === "e" || key === "]") {
        event.preventDefault();
        goNextChapter();
        return;
      }

      if (key === ";" || key === "'") {
        event.preventDefault();
        if ((key === ";" && !rtl) || (key === "'" && rtl)) {
          goFirstChapter();
        } else {
          goLastChapter();
        }
        return;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "w", "i", "arrowdown", "s", "k"].includes(key)) {
        stopScroll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      stopScroll();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    goFirstChapter,
    goLastChapter,
    goNextChapter,
    goNextPage,
    goPrevChapter,
    goPrevPage,
    jumpToPage,
    pageCount,
    readerConfig.direction,
    readerConfig.scrollSpeed,
    settingsOpen,
  ]);

  const pageIndicator = useMemo(() => {
    if (!pageCount) return "";
    if (!readerConfig.doublePage || readerConfig.direction === "scroll") {
      return `${currentIndex + 1} / ${pageCount}`;
    }

    const spread = currentSpread.map((index) => index + 1);
    const sorted = readerConfig.direction === "rtl" ? spread.reverse() : spread;
    return `${sorted.join("-")} / ${pageCount}`;
  }, [currentIndex, currentSpread, pageCount, readerConfig.direction, readerConfig.doublePage]);

  const renderImage = (page: ReaderPage) => {
    const maxWidthStyle = readerConfig.scale.includes("width")
      ? { maxWidth: `${readerConfig.maxWidthPercent}%` }
      : undefined;

    const scaleClass = getScaleClass(readerConfig.scale);

    return (
      <div className="flex flex-col items-center" key={page.index}>
        <div
          className="relative flex w-full items-center justify-center"
          ref={(node) => {
            if (readerConfig.direction === "scroll") {
              pageRefs[page.index].current = node;
            }
          }}
        >
          {page.status === "failed" ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-muted-foreground">Tải trang thất bại</p>
              <Button size="sm" onClick={() => retryPage(page.index)}>
                Thử lại
              </Button>
            </div>
          ) : page.url ? (
            <img
              src={page.url}
              alt={page.name}
              className={cn("select-none", scaleClass)}
              style={maxWidthStyle}
            />
          ) : (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Đang tải...
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderScrollMode = () => (
    <div
      className="flex w-full flex-col items-center"
      style={{ gap: readerConfig.gaps }}
    >
      {pages.map((page) => renderImage(page))}
    </div>
  );

  const renderSingleMode = () => {
    const page = pages[currentIndex];
    if (!page) return null;
    return (
      <div className="flex w-full items-center justify-center">
        {renderImage(page)}
      </div>
    );
  };

  const renderDoubleMode = () => (
    <div className="flex w-full items-center justify-center gap-4">
      {currentSpread.map((index) => {
        const page = pages[index];
        if (!page) return null;
        return renderImage(page);
      })}
    </div>
  );

  const handleClickNavigation = (event: React.MouseEvent<HTMLDivElement>) => {
    if (readerConfig.direction === "scroll" && !readerConfig.verticalClickNavigation) {
      return;
    }

    const direction = resolveClickDirection(event, readerConfig.direction);
    direction === "next" ? goNextPage() : goPrevPage();
  };

  const commentListRef = useRef<{ mutate: () => void } | null>(null);
  const handleCommentPosted = () => {
    commentListRef.current?.mutate();
  };

  return (
    <div className="relative min-h-svh w-full bg-background">
      <ReaderHeader
        chapter={chapter}
        currentIndex={currentIndex}
        pageCount={pageCount}
        onJump={jumpToPage}
        onOpenSettings={() => setSettingsOpen(true)}
        onTogglePanel={() =>
          setReaderConfig({ panelOpen: !readerConfig.panelOpen })
        }
        panelOpen={readerConfig.panelOpen}
        isMobile={isMobile}
      />

      <div
        className={cn(
          "relative mx-auto flex min-h-[70vh] w-full max-w-6xl flex-1 items-center justify-center px-2 py-6",
          readerConfig.direction !== "scroll" && "overflow-hidden"
        )}
        onClick={handleClickNavigation}
      >
        {isLoading && (
          <div className="flex h-40 w-full items-center justify-center text-sm text-muted-foreground">
            Đang tải trang...
          </div>
        )}
        {!isLoading && error && (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            {error}
            <Button size="sm" onClick={() => window.location.reload()}>
              Thử lại
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {readerConfig.direction === "scroll" && renderScrollMode()}
            {readerConfig.direction !== "scroll" && !readerConfig.doublePage && renderSingleMode()}
            {readerConfig.direction !== "scroll" && readerConfig.doublePage && renderDoubleMode()}
          </>
        )}
      </div>

      <ReaderPanel
        chapter={chapter}
        aggregate={aggregate}
        currentIndex={currentIndex}
        pageCount={pageCount}
        panelOpen={readerConfig.panelOpen}
        panelPosition={readerConfig.panelPosition}
        config={readerConfig}
        setConfig={setReaderConfig}
        onTogglePanel={() =>
            setReaderConfig({ panelOpen: !readerConfig.panelOpen })
        }
        onJump={jumpToPage}
        onSelectChapter={(id) => router.push(`/chapter/${id}`)}
        onSelectGroup={(id, name) =>
          router.push(`/group/${id}/${generateSlug(name || "group")}`)
        }
        commentsBlurred={commentsBlurred}
        onToggleComments={() => setCommentsBlurred((prev) => !prev)}
        commentListRef={commentListRef}
        onCommentPosted={handleCommentPosted}
      />

      {!readerConfig.panelOpen && (
        <PanelMini
          isMobile={isMobile}
          visible={miniVisible}
          onToggleVisible={() => setMiniVisible((prev) => !prev)}
          onOpenPanel={() =>
            setReaderConfig({ panelOpen: true })
          }
          onOpenSettings={() => setSettingsOpen(true)}
          mangaId={chapter.manga.id}
          mangaTitle={chapter.manga.title || ""}
        />
      )}

      {readerConfig.pageIndicator && pageIndicator && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-sm text-muted-foreground shadow">
          {pageIndicator}
        </div>
      )}

      <ReaderFooter
        direction={readerConfig.direction}
        doublePage={readerConfig.doublePage}
        onPrev={goPrevPage}
        onNext={goNextPage}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={readerConfig}
        setConfig={setReaderConfig}
      />
    </div>
  );
}

function ReaderHeader({
  chapter,
  currentIndex,
  pageCount,
  onJump,
  onOpenSettings,
  onTogglePanel,
  panelOpen,
  isMobile,
}: {
  chapter: Chapter;
  currentIndex: number;
  pageCount: number;
  onJump: (index: number) => void;
  onOpenSettings: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  isMobile: boolean;
}) {
  return (
    <div className="sticky top-0 z-30 flex w-full flex-wrap items-center justify-between gap-2 border-b bg-background/80 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onTogglePanel}>
          {panelOpen ? <PanelLeft className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold line-clamp-1">{chapter.manga.title}</span>
          <span className="text-xs text-muted-foreground line-clamp-1">
            {ChapterTitle(chapter)}
          </span>
        </div>
      </div>

      {!isMobile && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="w-20"
            min={1}
            max={pageCount}
            value={pageCount ? currentIndex + 1 : 1}
            onChange={(event) => onJump(Number(event.target.value) - 1)}
          />
          <span className="text-xs text-muted-foreground">/ {pageCount}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ReaderFooter({
  direction,
  doublePage,
  onPrev,
  onNext,
  onOpenSettings,
}: {
  direction: "scroll" | "ltr" | "rtl";
  doublePage: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
}) {
  if (direction === "scroll") return null;

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="secondary" onClick={onPrev}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Trang trước</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="secondary" onClick={onNext}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Trang sau</TooltipContent>
      </Tooltip>

      {doublePage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" onClick={onOpenSettings}>
              <SquareSplitHorizontal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tuỳ chỉnh spread</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function ReaderPanel({
  chapter,
  aggregate,
  currentIndex,
  pageCount,
  panelOpen,
  panelPosition,
  config,
  setConfig,
  onTogglePanel,
  onJump,
  onSelectChapter,
  onSelectGroup,
  commentsBlurred,
  onToggleComments,
  commentListRef,
  onCommentPosted,
}: {
  chapter: Chapter;
  aggregate?: ChapterAggregate[];
  currentIndex: number;
  pageCount: number;
  panelOpen: boolean;
  panelPosition: "left" | "right";
  config: ReaderConfig;
  setConfig: (partial: Partial<ReaderConfig>) => void;
  onTogglePanel: () => void;
  onJump: (index: number) => void;
  onSelectChapter: (id: string) => void;
  onSelectGroup: (id: string, name: string) => void;
  commentsBlurred: boolean;
  onToggleComments: () => void;
  commentListRef: React.RefObject<{ mutate: () => void } | null>;
  onCommentPosted: () => void;
}) {
  const isRight = panelPosition === "right";
  const chapters = aggregate?.flatMap((volume) => volume.chapters) ?? [];
  const chapterOptions = chapters.map((entry) => ({
    id: entry.id || entry.other?.[0],
    label: `Ch. ${entry.chapter}`,
  }));

  return (
    <div
      className={cn(
        "fixed top-16 z-30 hidden h-[calc(100vh-4rem)] w-[320px] flex-col border bg-background/95 shadow-sm backdrop-blur md:flex",
        panelOpen ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full",
        isRight ? "right-0" : "left-0"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">Bảng điều khiển</span>
        <Button variant="ghost" size="icon" onClick={onTogglePanel}>
          {isRight ? <PanelRight className="h-4 w-4" /> : <LayoutPanelLeft className="h-4 w-4" />}
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Đang đọc</p>
            <NoPrefetchLink
              href={`/manga/${chapter.manga.id}/${generateSlug(chapter.manga.title || "")}`}
              className="text-sm font-semibold hover:underline"
            >
              {chapter.manga.title}
            </NoPrefetchLink>
            <p className="text-xs text-muted-foreground">{ChapterTitle(chapter)}</p>
          </div>

          <div className="space-y-2">
            <Label>Shortcuts</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setConfig({
                    direction: config.direction === "scroll" ? "ltr" : "scroll",
                  })
                }
              >
                {config.direction === "scroll" ? "Scroll" : "LTR"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfig({ doublePage: !config.doublePage })}
              >
                {config.doublePage ? "2-Page" : "1-Page"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setConfig({
                    scale:
                      config.scale === "limit-width" ? "original" : "limit-width",
                  })
                }
              >
                {config.scale === "limit-width" ? "Fit" : "Original"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chương</Label>
            <Select onValueChange={onSelectChapter}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn chương" />
              </SelectTrigger>
              <SelectContent>
                {chapterOptions
                  .filter((option) => option.id)
                  .map((option) => (
                    <SelectItem key={option.id} value={option.id!}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trang</Label>
            <Select onValueChange={(value) => onJump(Number(value) - 1)}>
              <SelectTrigger>
                <SelectValue placeholder={`${currentIndex + 1} / ${pageCount}`} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: pageCount }).map((_, index) => (
                  <SelectItem key={index} value={String(index + 1)}>
                    Trang {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {chapter.group.length > 0 && (
            <div className="space-y-2">
              <Label>Nhóm dịch</Label>
              <div className="flex flex-wrap gap-2">
                {chapter.group.map((group) => (
                  <Badge
                    key={group.id}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => onSelectGroup(group.id, group.name)}
                  >
                    {group.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              <span className="text-sm font-semibold">Bình luận</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onToggleComments}>
              {commentsBlurred ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          <div className="relative">
            <div className={cn("transition", commentsBlurred && "blur-sm")}
            >
              <CommentList id={chapter.id} type="chapter" ref={commentListRef} />
            </div>
            {commentsBlurred && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button size="sm" onClick={onToggleComments}>
                  Hiện bình luận
                </Button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <CommentFormSimple
          id={chapter.id}
          title={chapter.manga.title || ""}
          type="chapter"
          onCommentPosted={onCommentPosted}
          chapterNumber={formatChapterTitle(chapter, false)}
        />
      </div>
    </div>
  );
}

function PanelMini({
  isMobile,
  visible,
  onToggleVisible,
  onOpenPanel,
  onOpenSettings,
  mangaId,
  mangaTitle,
}: {
  isMobile: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  onOpenPanel: () => void;
  onOpenSettings: () => void;
  mangaId: string;
  mangaTitle: string;
}) {
  if (!visible) {
    return (
      <Button
        variant="secondary"
        size="icon"
        className="fixed bottom-4 left-4 z-20"
        onClick={onToggleVisible}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-20 flex flex-col gap-2",
        isMobile ? "bottom-4 left-1/2 -translate-x-1/2" : "bottom-4 left-4"
      )}
    >
      <NoPrefetchLink
        href={`/manga/${mangaId}/${generateSlug(mangaTitle || "")}`}
        className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm shadow-sm"
      >
        Về trang truyện
      </NoPrefetchLink>
      <Button variant="secondary" size="icon" onClick={onOpenPanel}>
        <PanelLeft className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" onClick={onOpenSettings}>
        <Settings className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleVisible}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  config,
  setConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ReaderConfig;
  setConfig: (partial: Partial<ReaderConfig>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <Tabs defaultValue="reader">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reader">Reader</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
          </TabsList>

          <TabsContent value="reader" className="space-y-6">
            <div className="space-y-3">
              <Label>Page Fit</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {SCALE_OPTIONS.map((option) => (
                  <Tooltip key={option.value}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={config.scale === option.value ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => setConfig({ scale: option.value })}
                      >
                        {option.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{option.description}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {config.scale.includes("width") && (
              <div className="space-y-3">
                <Label>Maximum Page Width (%)</Label>
                <Slider
                  value={[config.maxWidthPercent]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={([value]) =>
                    setConfig({ maxWidthPercent: value })
                  }
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>Reader Layout</Label>
              <ToggleGroup
                type="single"
                value={config.direction}
                onValueChange={(value) =>
                  value && setConfig({ direction: value as ReaderConfig["direction"] })
                }
              >
                <ToggleGroupItem value="ltr">
                  <SquareSplitHorizontal className="h-4 w-4" />
                  LTR
                </ToggleGroupItem>
                <ToggleGroupItem value="scroll">
                  <SquareSplitVertical className="h-4 w-4" />
                  Scroll
                </ToggleGroupItem>
                <ToggleGroupItem value="rtl">
                  <SquareSplitHorizontal className="h-4 w-4" />
                  RTL
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {config.direction === "scroll" && (
              <div className="space-y-3">
                <Label>Vertical View Gaps (px)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.gaps}
                  onChange={(event) =>
                    setConfig({ gaps: Number(event.target.value || 0) })
                  }
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>2-Page Spread</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {config.doublePage ? "2 trang" : "1 trang"}
                </span>
                <Switch
                  checked={config.doublePage}
                  onCheckedChange={(checked) =>
                    setConfig({ doublePage: checked })
                  }
                />
              </div>
            </div>

            {config.doublePage && (
              <div className="space-y-3">
                <Label>2-Page Spread Offset</Label>
                <Slider
                  value={[config.spreadOffset]}
                  min={0}
                  max={3}
                  step={1}
                  onValueChange={([value]) =>
                    setConfig({ spreadOffset: value })
                  }
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>Panel Position</Label>
              <ToggleGroup
                type="single"
                value={config.panelPosition}
                onValueChange={(value) =>
                  value && setConfig({ panelPosition: value as ReaderConfig["panelPosition"] })
                }
              >
                <ToggleGroupItem value="left">
                  <ChevronLeft className="h-4 w-4" />
                  Left
                </ToggleGroupItem>
                <ToggleGroupItem value="right">
                  <ChevronRight className="h-4 w-4" />
                  Right
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-3">
              <Label>Page Indicator</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hiển thị số trang</span>
                <Switch
                  checked={config.pageIndicator}
                  onCheckedChange={(checked) =>
                    setConfig({ pageIndicator: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Data Saver</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ưu tiên ảnh nén</span>
                <Switch
                  checked={config.dataSaver}
                  onCheckedChange={(checked) =>
                    setConfig({ dataSaver: checked })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6">
            <div className="space-y-3">
              <Label>Keyboard Scroll Speed</Label>
              <Slider
                value={[config.scrollSpeed]}
                min={5}
                max={100}
                step={5}
                onValueChange={([value]) =>
                  setConfig({ scrollSpeed: value })
                }
              />
            </div>

            <div className="space-y-3">
              <Label>Click/Tap Pagination (Vertical View)</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bật click để chuyển trang</span>
                <Switch
                  checked={config.verticalClickNavigation}
                  onCheckedChange={(checked) =>
                    setConfig({ verticalClickNavigation: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Scroll Pagination</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lăn chuột đổi chapter</span>
                <Switch
                  checked={config.scrollNavigation}
                  onCheckedChange={(checked) =>
                    setConfig({ scrollNavigation: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Keyboard Pagination (Vertical View)</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bật phím điều hướng</span>
                <Switch
                  checked={config.verticalKeyboardNavigation}
                  onCheckedChange={(checked) =>
                    setConfig({ verticalKeyboardNavigation: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Auto-Advance Chapter on Last Page</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tự chuyển chương</span>
                <Switch
                  checked={config.chapterNavigation}
                  onCheckedChange={(checked) =>
                    setConfig({ chapterNavigation: checked })
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function getScaleClass(scale: ReaderConfig["scale"]) {
  switch (scale) {
    case "original":
      return "h-auto w-auto max-w-none";
    case "limit":
      return "max-h-dvh max-w-full object-contain";
    case "limit-width":
      return "w-full max-h-dvh object-contain";
    case "limit-height":
      return "h-dvh w-auto object-contain";
    case "stretch":
      return "h-dvh w-full object-fill";
    case "stretch-width":
      return "w-full h-auto object-fill";
    case "stretch-height":
      return "h-dvh w-auto object-fill";
    default:
      return "max-h-dvh max-w-full object-contain";
  }
}
