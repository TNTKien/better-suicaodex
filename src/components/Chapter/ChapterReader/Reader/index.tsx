"use client";

import { Chapter } from "@/types/types";
import ChapterNav from "./chapter-nav";
import LongStrip from "./long-strip";
import { getChapterAggregate } from "@/lib/mangadex/chapter";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  Download,
  File,
  GalleryVertical,
  Loader2,
  MoveHorizontal,
  MoveVertical,
  PanelTop,
  Repeat,
  Settings,
  Square,
  Trash2,
  Wifi,
  WifiOff,
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
import { useOfflineChapter } from "@/hooks/use-offline-chapter";

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
  
  // Offline reading state
  const { 
    isChapterOffline, 
    saveChapter, 
    getOfflineChapter,
    deleteOfflineChapter,
    isLoading: isOfflineLoading 
  } = useOfflineChapter();
  const [isOffline, setIsOffline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [offlineAvailable, setOfflineAvailable] = useState(false);
  const [offlineImages, setOfflineImages] = useState<string[]>([]);
  
  // Kiểm tra xem chapter có sẵn offline không
  useEffect(() => {
    const checkOfflineStatus = async () => {
      const available = await isChapterOffline(chapterData.id);
      setOfflineAvailable(available);
    };
    
    if (!isOfflineLoading) {
      checkOfflineStatus();
    }
  }, [chapterData.id, isChapterOffline, isOfflineLoading]);
  
  // Lấy dữ liệu offline nếu đang ở chế độ offline
  useEffect(() => {
    const loadOfflineData = async () => {
      if (isOffline && offlineAvailable) {
        const offlineData = await getOfflineChapter(chapterData.id);
        if (offlineData) {
          setOfflineImages(offlineData.images);
        }
      }
    };
    
    loadOfflineData();
  }, [isOffline, offlineAvailable, chapterData.id, getOfflineChapter]);

  const { data, isMutating, error, trigger } = useSWRMutation(
    [
      "aggregate",
      chapterData.manga.id,
      chapterData.language,
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
              className="w-full md:min-w-48 justify-start"
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

  // Xử lý lưu chapter offline
  const handleSaveOffline = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      toast.info("Đang tải ảnh...", { duration: 2000 });
      
      // Thông báo cho service worker để theo dõi tiến trình
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_CHAPTER_IMAGES',
          chapterId: chapterData.id,
          images: images
        });
      }
      
      const success = await saveChapter(chapterData, images);
      if (success) {
        setOfflineAvailable(true);
        toast.success("Đã lưu chapter để đọc offline");
      } else {
        toast.error("Không thể lưu chapter");
      }
    } catch (error) {
      console.error("Error saving chapter:", error);
      toast.error("Lỗi khi lưu chapter: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };
  
  // Xử lý xóa chapter offline
  const handleDeleteOffline = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteOfflineChapter(chapterData.id);
      if (success) {
        setOfflineAvailable(false);
        if (isOffline) {
          setIsOffline(false);
        }
        toast.success("Đã xóa chapter khỏi bộ nhớ");
      } else {
        toast.error("Không thể xóa chapter");
      }
    } catch (error) {
      console.error("Error deleting chapter:", error);
      toast.error("Lỗi khi xóa chapter");
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Chuyển đổi giữa chế độ online và offline
  const toggleOfflineMode = () => {
    if (!offlineAvailable && !isOffline) {
      toast.error("Chapter này chưa được lưu để đọc offline");
      return;
    }
    setIsOffline(!isOffline);
    if (!isOffline) {
      toast.info("Đã chuyển sang chế độ đọc offline");
    } else {
      toast.info("Đã chuyển sang chế độ đọc online");
    }
  };

  if (!data) {
    return (
      <>
        <LongStrip images={images} />
        <LoadingNav
          button={
            <Button
              className="w-full md:min-w-48 justify-start"
              variant="outline"
            >
              <Loader2 className="animate-spin" />
              Đang tải dữ liệu...
            </Button>
          }
          isOffline={isOffline}
          offlineAvailable={offlineAvailable}
          isSaving={isSaving}
          isDeleting={isDeleting}
          toggleOfflineMode={toggleOfflineMode}
          handleSaveOffline={handleSaveOffline}
          handleDeleteOffline={handleDeleteOffline}
        />
      </>
    );
  }
  
  // Hiển thị hình ảnh dựa vào chế độ đọc (online/offline)
  const displayImages = isOffline && offlineAvailable ? offlineImages : images;

  return (
    <>
      {config.reader.type === "single" ? (
        <SinglePage images={displayImages} />
      ) : (
        <LongStrip images={displayImages} />
      )}
      <ChapterNav 
        chapterData={chapterData} 
        chapterAggregate={data}
        isOffline={isOffline}
        offlineAvailable={offlineAvailable}
        isSaving={isSaving}
        isDeleting={isDeleting}
        toggleOfflineMode={toggleOfflineMode}
        handleSaveOffline={handleSaveOffline}
        handleDeleteOffline={handleDeleteOffline}
      />
      {config.reader.type === "long-strip" && !isOffline && (
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
  isOffline?: boolean;
  offlineAvailable?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  toggleOfflineMode?: () => void;
  handleSaveOffline?: () => void;
  handleDeleteOffline?: () => void;
}

function LoadingNav({ 
  button, 
  isOffline = false, 
  offlineAvailable = false,
  isSaving = false,
  isDeleting = false,
  toggleOfflineMode = () => {},
  handleSaveOffline = () => {},
  handleDeleteOffline = () => {}
}: LoadingNavProps) {
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
        
        <Button
          size="icon"
          className="shrink-0 [&_svg]:size-5"
          onClick={toggleOfflineMode}
        >
          {isOffline ? <Wifi /> : <WifiOff />}
        </Button>
        
        {offlineAvailable ? (
          <Button
            size="icon"
            className="shrink-0 [&_svg]:size-5"
            onClick={handleDeleteOffline}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        ) : (
          <Button
            size="icon"
            className="shrink-0 [&_svg]:size-5"
            onClick={handleSaveOffline}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Download />}
          </Button>
        )}

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
                        "border-2 border-primary"
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
                        "border-2 border-primary"
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
                        "border-2 border-primary"
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
                        "border-2 border-primary"
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
                      !config.reader.header && "border-2 border-primary"
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
                      !!config.reader.header && "border-2 border-primary"
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
