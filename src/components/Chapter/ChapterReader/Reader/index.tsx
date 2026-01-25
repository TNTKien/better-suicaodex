"use client";

import { Chapter } from "@/types/types";
import ChapterNav from "./chapter-nav";
import LongStrip from "./long-strip";
import { getChapterAggregate } from "@/lib/mangadex/chapter";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  File,
  GalleryVertical,
  Loader2,
  MoveHorizontal,
  MoveVertical,
  PanelTop,
  Repeat,
  Settings,
  Square,
} from "lucide-react";
import { ReactElement, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { useConfig } from "@/hooks/use-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import useSWRMutation from "swr/mutation";
import CommentSection from "@/components/Comment/comment-section";
import { LazyLoadComponent } from "react-lazy-load-image-component";
import SinglePage from "./single-page";

interface ReaderProps {
  images: string[];
  chapterData: Chapter;
}

export default function Reader({ images, chapterData }: ReaderProps) {
  const [config] = useConfig();
  const chapterNumber = chapterData.chapter
    ? `Ch. ${chapterData.chapter}`
    : "Oneshot";

  const [retryCount, setRetryCount] = useState(0);
  const [reachedMaxRetries, setReachedMaxRetries] = useState(false);
  const MAX_RETRIES = 3;

  const { data, isMutating, error, trigger } = useSWRMutation(
    [
      "aggregate",
      chapterData.manga.id,
      [chapterData.language],
      chapterData.group.map((group) => group.id),
    ],
    ([, mangaId, language, groups]) =>
      getChapterAggregate(mangaId, language, groups)
  );

  // Check if current chapter exists in the aggregate data
  const chapterExists = data?.some((volume) =>
    volume.chapters.some(
      (chapter) =>
        chapter.id === chapterData.id ||
        chapter.other?.some((id) => id === chapterData.id)
    )
  );

  // Retry with exponential backoff
  useEffect(() => {
    if (!data) {
      // Initial load
      trigger();
      return;
    }

    if (!chapterExists && retryCount < MAX_RETRIES) {
      console.log(
        `Chapter not found in aggregate data, retry ${
          retryCount + 1
        }/${MAX_RETRIES}...`
      );

      // Calculate delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 1s, 2s, 4s, 8s, max 10s

      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        trigger();
      }, delay);

      return () => clearTimeout(timer);
    }

    if (!chapterExists && retryCount >= MAX_RETRIES) {
      setReachedMaxRetries(true);
      console.log("Max retries reached. Stopping automatic retries.");
    }
  }, [data, chapterExists, retryCount, trigger]);

  // Reset retry count if chapter data changes
  useEffect(() => {
    setRetryCount(0);
    setReachedMaxRetries(false);
  }, [chapterData.id]);

  const handleManualRetry = () => {
    setRetryCount(0);
    setReachedMaxRetries(false);
    trigger();
  };

  if (isMutating || (data && !chapterExists && !reachedMaxRetries)) {
    return (
      <>
        <LongStrip images={images} />
        <LoadingNav
          button={
            <Button
              className="w-full md:min-w-48 justify-start whitespace-normal! break-all! shrink!"
              variant="outline"
            >
              <Loader2 className="animate-spin" />
              {retryCount > 0
                ? `Đang tải dữ liệu (${retryCount}/${MAX_RETRIES})`
                : "Đang tải dữ liệu..."}
            </Button>
          }
        />
      </>
    );
  }

  // Show error state when max retries reached
  if ((data && !chapterExists && reachedMaxRetries) || error) {
    return (
      <>
        <LongStrip images={images} />
        <LoadingNav
          button={
            <Button
              className="w-full md:min-w-48"
              variant="destructive"
              onClick={handleManualRetry}
            >
              {/* {error ? "Error. Retry?" : "Chapter data not found. Retry?"} */}
              {error
                ? "Lỗi. Thử lại?"
                : // : "Không tìm thấy dữ liệu chương. Thử lại?"}
                  "Không có dữ liệu. Thử lại?"}
            </Button>
          }
        />
      </>
    );
  }

  if (!data) return <LongStrip images={images} />;
  console.log("Chapter aggregate data:", data);

  return (
    <>
      {config.reader.type === "single" ? (
        <SinglePage images={images} />
      ) : (
        <LongStrip images={images} />
      )}
      <ChapterNav chapterData={chapterData} chapterAggregate={data} />
      {config.reader.type === "long-strip" && (
        <LazyLoadComponent>
          <CommentSection
            id={chapterData.id}
            type="chapter"
            title={chapterData.manga.title || ""}
            chapterNumber={chapterNumber}
          />
        </LazyLoadComponent>
      )}
    </>
  );
}

interface LoadingNavProps {
  button: ReactElement;
}

function LoadingNav({ button }: LoadingNavProps) {
  const scrollDirection = useScrollDirection();
  const { isAtBottom, isAtTop } = useScrollOffset();
  const [config, setConfig] = useConfig();
  return (
    <Card
      className={cn(
        "overflow-x-auto",
        `fixed bottom-0 left-1/2 transform -translate-x-1/2 md:-translate-x-[calc(50%+var(--sidebar-width-icon)/2)] z-10 transition-all duration-300`,
        "mx-auto flex w-full translate-y-0 items-center justify-center rounded-none bg-background border-none",
        "md:rounded-lg md:w-auto md:-translate-y-2",
        isAtBottom && "translate-y-full md:translate-y-full",
        scrollDirection === "down" &&
          !isAtBottom &&
          "translate-y-full md:translate-y-full"
      )}
    >
      <CardContent className="flex gap-2 p-2 md:gap-1.5 md:p-1.5 w-full">
        <Button
          disabled
          size="icon"
          className="shrink-0 disabled:cursor-not-allowed [&_svg]:size-5"
        >
          <ArrowLeft />
        </Button>

        {button}

        <Button
          disabled
          size="icon"
          className="shrink-0 disabled:cursor-not-allowed [&_svg]:size-5"
        >
          <ArrowRight />
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="icon" className="shrink-0 [&_svg]:size-5">
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
                      config.reader.type === "single" &&
                        "border-2 border-primary!"
                    )}
                    onClick={() => {
                      setConfig({
                        ...config,
                        reader: {
                          ...config.reader,
                          type: "single",
                        },
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
                        "border-2 border-primary!"
                    )}
                    onClick={() =>
                      setConfig({
                        ...config,
                        reader: {
                          ...config.reader,
                          type: "long-strip",
                        },
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
                      onClick={() => {
                        setConfig({
                          ...config,
                          reader: {
                            ...config.reader,
                            imageGap: 4,
                          },
                        });
                      }}
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
                        "border-2 border-primary!"
                    )}
                    onClick={() =>
                      setConfig({
                        ...config,
                        reader: {
                          ...config.reader,
                          imageFit: "height",
                        },
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
                        "border-2 border-primary!"
                    )}
                    onClick={() =>
                      setConfig({
                        ...config,
                        reader: {
                          ...config.reader,
                          imageFit: "width",
                        },
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
                      !config.reader.header && "border-2 border-primary!"
                    )}
                    onClick={() =>
                      setConfig({
                        ...config,
                        reader: {
                          ...config.reader,
                          header: false,
                        },
                      })
                    }
                  >
                    <Square />
                    <span>Ẩn</span>
                  </Button>

                  <Button
                    variant="outline"
                    className={cn(
                      !!config.reader.header && "border-2 border-primary!"
                    )}
                    onClick={() =>
                      setConfig({
                        ...config,
                        reader: {
                          ...config.reader,
                          header: true,
                        },
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

        <Button
          size="icon"
          disabled={isAtTop}
          className="shrink-0 [&_svg]:size-5"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronsUp />
        </Button>
      </CardContent>
    </Card>
  );
}
