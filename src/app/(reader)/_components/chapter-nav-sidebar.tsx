"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useConfig } from "@/hooks/use-config";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { useGetMangaIdAggregate } from "@/lib/weebdex/hooks/chapter/chapter";
import { cn, formatChapterTitle } from "@/lib/utils";
import { toReaderAggregate } from "@/lib/weebdex/utils";
import { Chapter } from "@/lib/weebdex/model";
import {
  IMAGE_SCALE_LABELS,
  READER_MODE_LABELS,
  type ImageScale,
  type ReaderMode,
  useReaderStore,
} from "@/store/reader-store";
import { useRouter } from "@bprogress/next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronsUp,
  FileInput,
  FileOutput,
  GalleryVertical,
  Image,
  MoveHorizontal,
  MoveVertical,
  PanelTop,
  Repeat,
  Settings,
  Square,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Wallpaper,
} from "lucide-react";
import Link from "next/link";
import { ReactElement, useEffect, useMemo, useState } from "react";

interface ChapterNavProps {
  chapter: Chapter;
}

const MAX_RETRIES = 3;

function ReaderSettingsDialog() {
  const {
    mode,
    setMode,
    scale,
    setScale,
    imageGap,
    setImageGap,
    header,
    setHeader,
    spreadOffset,
    setSpreadOffset,
  } = useReaderStore();

  const readingModes: {
    value: ReaderMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "long-strip",
      label: READER_MODE_LABELS["long-strip"],
      icon: <GalleryVertical />,
    },
    {
      value: "single",
      label: READER_MODE_LABELS["single"],
      icon: <FileInput />,
    },
    {
      value: "double",
      label: READER_MODE_LABELS["double"],
      icon: <BookOpen />,
    },
    {
      value: "single-rtl",
      label: READER_MODE_LABELS["single-rtl"],
      icon: <FileOutput />,
    },
  ];

  const imageScales: {
    value: ImageScale;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "original",
      label: IMAGE_SCALE_LABELS["original"],
      icon: <Image />,
    },
    {
      value: "limit-all",
      label: IMAGE_SCALE_LABELS["limit-all"],
      icon: <Wallpaper />,
    },
    {
      value: "limit-width",
      label: IMAGE_SCALE_LABELS["limit-width"],
      icon: <SquareSplitHorizontal />,
    },
    {
      value: "limit-height",
      label: IMAGE_SCALE_LABELS["limit-height"],
      icon: <SquareSplitVertical />,
    },
    {
      value: "stretch-width",
      label: IMAGE_SCALE_LABELS["stretch-width"],
      icon: <MoveHorizontal />,
    },
    {
      value: "stretch-height",
      label: IMAGE_SCALE_LABELS["stretch-height"],
      icon: <MoveVertical />,
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" className="size-8" variant="outline">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-none [&>button]:hidden max-w-full">
        <DialogHeader>
          <DialogTitle>Tùy chỉnh Reader (Beta)</DialogTitle>
          <DialogDescription>
            Các tùy chỉnh đang trong quá trình thử nghiệm, có thể lỗi hoặc mang
            lại trải nghiệm không mong muốn
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 transition-all duration-300">
          {/* Chế độ đọc */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Chế độ đọc</Label>
            <div className="grid grid-cols-2 gap-2">
              {readingModes.map(({ value, label, icon }) => (
                <Button
                  key={value}
                  variant="outline"
                  className={cn(
                    "gap-1.5",
                    mode === value && "border-2 border-primary!",
                  )}
                  onClick={() => setMode(value)}
                >
                  {icon}
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Khoảng cách ảnh (chỉ hiện khi long-strip) */}
          {mode === "long-strip" && (
            <div className="space-y-1.5">
              <Label className="font-semibold">
                Khoảng cách giữa các ảnh (px)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  defaultValue={imageGap}
                  autoFocus={false}
                  autoComplete="off"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const gap = parseInt(e.target.value);
                    setImageGap(Number.isNaN(gap) ? 4 : gap);
                  }}
                />
                <Button
                  variant="outline"
                  className="shrink-0"
                  size="icon"
                  onClick={() => setImageGap(4)}
                >
                  <Repeat />
                </Button>
              </div>
            </div>
          )}

          {/* Spread offset (chỉ hiện khi double) */}
          {mode === "double" && (
            <div className="space-y-1.5">
              <Label className="font-semibold">Offset 2 trang (0-3)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={3}
                  value={spreadOffset}
                  autoFocus={false}
                  autoComplete="off"
                  onChange={(e) => {
                    const v = Math.min(
                      3,
                      Math.max(0, parseInt(e.target.value) || 0),
                    );
                    setSpreadOffset(v);
                  }}
                />
                <Button
                  variant="outline"
                  className="shrink-0"
                  size="icon"
                  onClick={() => setSpreadOffset(0)}
                >
                  <Repeat />
                </Button>
              </div>
            </div>
          )}

          {/* Ảnh truyện */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Ảnh truyện</Label>
            <div className="grid grid-cols-2 gap-2">
              {imageScales.map(({ value, label, icon }) => (
                <Button
                  key={value}
                  variant="outline"
                  // size="sm"
                  className={cn(scale === value && "border-2 border-primary!")}
                  onClick={() => setScale(value)}
                >
                  {icon}
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Thanh Header */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Thanh Header</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={cn(!header && "border-2 border-primary!")}
                onClick={() => setHeader(false)}
              >
                <Square />
                <span>Ẩn</span>
              </Button>
              <Button
                variant="outline"
                className={cn(!!header && "border-2 border-primary!")}
                onClick={() => setHeader(true)}
              >
                <PanelTop />
                <span>Hiện</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ChapterNavSidebar({ chapter }: ChapterNavProps) {
  const [config] = useConfig();
  const router = useRouter();
  const { isAtTop } = useScrollOffset();

  const [retryCount, setRetryCount] = useState(0);
  const [reachedMaxRetries, setReachedMaxRetries] = useState(false);

  const mangaId = chapter.relationships?.manga?.id ?? "";
  const language = chapter.language ?? "";

  const {
    data: aggregateRes,
    isLoading,
    isFetching: isValidating,
    error,
    refetch: mutate,
  } = useGetMangaIdAggregate(
    mangaId,
    { tlang: language ? [language] : undefined },
    {
      query: {
        enabled: !!mangaId,
        refetchOnWindowFocus: false,
      },
    },
  );

  const chapterAggregate = useMemo(
    () =>
      aggregateRes?.data
        ? toReaderAggregate(aggregateRes.data, chapter.id)
        : undefined,
    [aggregateRes, chapter.id],
  );

  // Check if current chapter exists in the aggregate data
  const chapterId = chapter.id ?? "";
  const chapterExists = chapterAggregate?.some((volume) =>
    volume.chapters.some(
      (ch) => ch.id === chapterId || ch.other?.some((id) => id === chapterId),
    ),
  );

  useEffect(() => {
    if (isLoading || isValidating || !chapterAggregate) return;

    if (!chapterExists && retryCount < MAX_RETRIES) {
      console.log(
        `Chapter not found in aggregate data, retry ${retryCount + 1}/${MAX_RETRIES}...`,
      );

      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        mutate();
      }, delay);

      return () => clearTimeout(timer);
    }

    if (!chapterExists && retryCount >= MAX_RETRIES) {
      setReachedMaxRetries(true);
      console.log("Max retries reached. Stopping automatic retries.");
    }
  }, [
    chapterAggregate,
    chapterExists,
    isLoading,
    isValidating,
    retryCount,
    mutate,
  ]);

  // Reset retry state when chapter changes
  useEffect(() => {
    setRetryCount(0);
    setReachedMaxRetries(false);
  }, [chapter.id]);

  const handleManualRetry = () => {
    setRetryCount(0);
    setReachedMaxRetries(false);
    mutate();
  };

  if (
    isLoading ||
    isValidating ||
    (chapterAggregate && !chapterExists && !reachedMaxRetries)
  ) {
    return (
      <LoadingNav>
        <Button
          className="h-8 flex-1 justify-start whitespace-normal! break-all! shrink!"
          variant="outline"
        >
          <Spinner />
          {retryCount > 0
            ? `Đang tải (${retryCount}/${MAX_RETRIES})`
            : "Đang tải..."}
        </Button>
      </LoadingNav>
    );
  }

  if ((chapterAggregate && !chapterExists && reachedMaxRetries) || error) {
    return (
      <LoadingNav>
        <Button
          className="h-8 flex-1"
          variant="destructive"
          onClick={handleManualRetry}
        >
          {error ? "Lỗi. Thử lại?" : "Không có dữ liệu. Thử lại?"}
        </Button>
      </LoadingNav>
    );
  }

  if (!chapterAggregate) return null;

  let currentVolIndex = chapterAggregate.findIndex((aggregate) =>
    aggregate.chapters.some((ch) => ch.id === chapterId),
  );

  if (currentVolIndex === -1) {
    currentVolIndex = chapterAggregate.findIndex((aggregate) =>
      aggregate.chapters.some((ch) => ch.other?.some((id) => id === chapterId)),
    );
  }

  const currentChapterIndex = chapterAggregate[
    currentVolIndex
  ].chapters.findIndex((ch) => ch.id === chapterId);

  const prevChapter =
    chapterAggregate[currentVolIndex].chapters[currentChapterIndex + 1]?.id ??
    chapterAggregate[currentVolIndex + 1]?.chapters[0]?.id;

  const nextChapter =
    chapterAggregate[currentVolIndex].chapters[currentChapterIndex - 1]?.id ??
    chapterAggregate[currentVolIndex - 1]?.chapters.at(-1)?.id;

  return (
    <ButtonGroup className="h-8 w-full">
      <ButtonGroup className="h-8 flex-1">
        <Button
          asChild={!!prevChapter}
          disabled={!prevChapter}
          size="icon"
          className="size-8"
          variant="outline"
        >
          <Link href={prevChapter ? `/chapter/${prevChapter}` : "#"}>
            <ArrowLeft />
          </Link>
        </Button>

        <Select
          defaultValue={chapter.id}
          onValueChange={(id) => router.push(`/chapter/${id}`)}
        >
          <SelectTrigger className="flex-1 focus:ring-0 [&[data-state=open]>svg]:rotate-180 bg-card shadow-xs h-8">
            <SelectValue placeholder={formatChapterTitle(chapter)} />
          </SelectTrigger>
          <SelectContent
            position="popper"
            className={cn("max-h-[350px]", `theme-${config.theme}`)}
          >
            {chapterAggregate.map((vol) => (
              <SelectGroup key={vol.vol}>
                <div className="flex items-center pr-2">
                  <SelectLabel className="shrink-0">
                    {vol.vol !== "none" ? `Volume ${vol.vol}` : "No Volume"}
                  </SelectLabel>
                  <hr className="w-full" />
                </div>

                {vol.chapters.map((ch) => (
                  <SelectItem
                    key={ch.id}
                    value={ch.id}
                    disabled={ch.id === chapterId}
                  >
                    {ch.chapter !== "none" ? `Ch. ${ch.chapter}` : "Oneshot"}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Button
          asChild={!!nextChapter}
          disabled={!nextChapter}
          size="icon"
          className="size-8"
          variant="outline"
        >
          <Link href={nextChapter ? `/chapter/${nextChapter}` : "#"}>
            <ArrowRight />
          </Link>
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <ReaderSettingsDialog />
        <Button
          size="icon"
          disabled={isAtTop}
          className="size-8"
          variant="outline"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronsUp />
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  );
}

interface LoadingNavProps {
  children: ReactElement;
}

function LoadingNav({ children }: LoadingNavProps) {
  const { isAtTop } = useScrollOffset();
  return (
    <ButtonGroup className="h-8 w-full">
      <ButtonGroup className="h-8 flex-1">
        <Button disabled size="icon" className="size-8" variant="outline">
          <ArrowLeft />
        </Button>

        {children}

        <Button disabled size="icon" className="size-8" variant="outline">
          <ArrowRight />
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <ReaderSettingsDialog />
        <Button
          size="icon"
          disabled={isAtTop}
          className="size-8"
          variant="outline"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronsUp />
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  );
}
