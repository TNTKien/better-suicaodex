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
import { getChapterAggregate } from "@/lib/mangadex/chapter";
import { cn, formatChapterTitle } from "@/lib/utils";
import { Chapter } from "@/types/types";
import { useRouter } from "@bprogress/next";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  File,
  GalleryVertical,
  MoveHorizontal,
  MoveVertical,
  PanelTop,
  Repeat,
  Settings,
  Square,
} from "lucide-react";
import Link from "next/link";
import { ReactElement, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface ChapterNavProps {
  chapter: Chapter;
}

const MAX_RETRIES = 3;

function ReaderSettingsDialog() {
  const [config, setConfig] = useConfig();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" className="size-8" variant="outline">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-none [&>button]:hidden">
        <DialogHeader className="hidden">
          <DialogTitle>Reader Settings</DialogTitle>
          <DialogDescription>Tuỳ chỉnh linh tinh</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 transition-all duration-300">
          <div className="space-y-1.5">
            <Label className="font-semibold">Kiểu đọc</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={cn(
                  config.reader.type === "single" && "border-2 border-primary!",
                )}
                onClick={() => {
                  setConfig({
                    ...config,
                    reader: { ...config.reader, type: "single" },
                  });
                  return toast.info("Chức năng đang phát triển!");
                }}
              >
                <File />
                <span>Từng trang</span>
              </Button>

              <Button
                variant="outline"
                className={cn(
                  config.reader.type === "long-strip" &&
                    "border-2 border-primary!",
                )}
                onClick={() =>
                  setConfig({
                    ...config,
                    reader: { ...config.reader, type: "long-strip" },
                  })
                }
              >
                <GalleryVertical />
                <span>Trượt dọc</span>
              </Button>
            </div>
          </div>

          {config.reader.type === "long-strip" && (
            <div className="space-y-1.5">
              <Label className="font-semibold">
                Khoảng cách giữa các ảnh (px)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  defaultValue={config.reader.imageGap ?? 4}
                  autoFocus={false}
                  autoComplete="off"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const gap = parseInt(e.target.value);
                    setConfig({
                      ...config,
                      reader: {
                        ...config.reader,
                        imageGap: Number.isNaN(gap) ? 4 : gap,
                      },
                    });
                  }}
                />
                <Button
                  variant="outline"
                  className="shrink-0"
                  size="icon"
                  onClick={() =>
                    setConfig({
                      ...config,
                      reader: { ...config.reader, imageGap: 4 },
                    })
                  }
                >
                  <Repeat />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="font-semibold">Ảnh truyện</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={cn(
                  config.reader.imageFit === "height" &&
                    "border-2 border-primary!",
                )}
                onClick={() =>
                  setConfig({
                    ...config,
                    reader: { ...config.reader, imageFit: "height" },
                  })
                }
              >
                <MoveVertical />
                <span>Vừa chiều dọc</span>
              </Button>

              <Button
                variant="outline"
                className={cn(
                  config.reader.imageFit === "width" &&
                    "border-2 border-primary!",
                )}
                onClick={() =>
                  setConfig({
                    ...config,
                    reader: { ...config.reader, imageFit: "width" },
                  })
                }
              >
                <MoveHorizontal />
                <span>Vừa chiều ngang</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold">Thanh Header</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={cn(
                  !config.reader.header && "border-2 border-primary!",
                )}
                onClick={() =>
                  setConfig({
                    ...config,
                    reader: { ...config.reader, header: false },
                  })
                }
              >
                <Square />
                <span>Ẩn</span>
              </Button>

              <Button
                variant="outline"
                className={cn(
                  !!config.reader.header && "border-2 border-primary!",
                )}
                onClick={() =>
                  setConfig({
                    ...config,
                    reader: { ...config.reader, header: true },
                  })
                }
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

  const {
    data: chapterAggregate,
    isLoading,
    isValidating,
    error,
    mutate,
  } = useSWR(
    [
      `chapter-aggregate-${chapter.id}`,
      chapter.manga.id,
      chapter.language,
      chapter.group.map((group) => group.id),
    ],
    ([, mangaId, language, groups]) =>
      getChapterAggregate(mangaId, [language], groups),
    { revalidateOnFocus: false },
  );

  // Check if current chapter exists in the aggregate data
  const chapterExists = chapterAggregate?.some((volume) =>
    volume.chapters.some(
      (ch) => ch.id === chapter.id || ch.other?.some((id) => id === chapter.id),
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
            ? `Đang tải dữ liệu (${retryCount}/${MAX_RETRIES})`
            : "Đang tải dữ liệu..."}
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
    aggregate.chapters.some((ch) => ch.id === chapter.id),
  );

  if (currentVolIndex === -1) {
    currentVolIndex = chapterAggregate.findIndex((aggregate) =>
      aggregate.chapters.some((ch) =>
        ch.other?.some((id) => id === chapter.id),
      ),
    );
  }

  const currentChapterIndex = chapterAggregate[
    currentVolIndex
  ].chapters.findIndex((ch) => ch.id === chapter.id);

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
                    disabled={ch.id === chapter.id}
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
      </ButtonGroup>
    </ButtonGroup>
  );
}
