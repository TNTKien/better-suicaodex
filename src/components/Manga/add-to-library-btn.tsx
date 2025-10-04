"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useConfig } from "@/hooks/use-config";
import { cn, getCoverImageUrl } from "@/lib/utils";
import { LibraryType, Manga } from "@/types/types";
import {
  Album,
  BellOff,
  BellRing,
  BookmarkCheck,
  CircleUser,
  CloudOff,
  ListCheck,
  ListPlus,
  Loader2,
  NotebookPen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose } from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { useLocalNotification } from "@/hooks/use-local-notification";
import { useSession } from "next-auth/react";
import { updateMangaCategory } from "@/lib/suicaodex/db";

interface AddToLibraryBtnProps {
  isMobile: boolean;
  manga: Manga;
}

export default function AddToLibraryBtn({
  isMobile,
  manga,
}: AddToLibraryBtnProps) {
  const { data: session } = useSession();
  const [config] = useConfig();
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  const {
    localLibrary,
    addToLocalCategory,
    removeFromLocalLibrary,
    getLocalCategoryOfId,
  } = useLocalLibrary();

  const {
    localNotification,
    addToLocalNotification,
    removeFromLocalNotification,
    isInLocalNotification,
  } = useLocalNotification();

  const [value, setValue] = useState<LibraryType | "none">(
    getLocalCategoryOfId(manga.id) || "none"
  );
  // Cập nhật giá trị mặc định của dropdown dựa trên danh mục hiện tại của truyện
  useEffect(() => {
    const currentCategory = getLocalCategoryOfId(manga.id);
    setValue(currentCategory || "none");
  }, [manga.id, localLibrary]);

  useEffect(() => {
    const isInNotification = isInLocalNotification(manga.id);
    setIsNotificationEnabled(isInNotification);
  }, [manga.id, localNotification]);

  const src = getCoverImageUrl(manga.id, manga.cover, "512");

  const options = [
    {
      value: "none",
      label: "Không",
      icon: <ListPlus />,
      btnLabel: "Thêm vào thư viện",
    },
    {
      value: "following",
      label: "Theo dõi",
      icon: <BookmarkCheck />,
      btnLabel: "Đang theo dõi",
    },
    {
      value: "reading",
      label: "Đang đọc",
      icon: <Album />,
      btnLabel: "Đang đọc",
    },
    {
      value: "plan",
      label: "Để dành đọc sau",
      icon: <NotebookPen />,
      btnLabel: "Để dành đọc sau",
    },
    {
      value: "completed",
      label: "Đã đọc xong",
      icon: <ListCheck />,
      btnLabel: "Đã đọc xong",
    },
  ];

  const handleLocalNotificationToggle = (
    v: LibraryType | "none",
    n: boolean
  ) => {
    if (v === "none" || !n) {
      return removeFromLocalNotification(manga.id);
    }
    addToLocalNotification(manga.id);
  };

  const handleLocalLibraryAdd = (v: LibraryType | "none") => {
    if (v === "none") {
      removeFromLocalLibrary(manga.id);
      return toast.success(`Đã xóa truyện khỏi thư viện!`);
    }

    addToLocalCategory(manga.id, v);
    return toast.success(
      `Đã thêm truyện vào: ${options.find((opt) => opt.value === v)?.label}!`
    );
  };

  const handleLibraryAdd = async (v: LibraryType | "none") => {
    if (!session || !session.user || !session.user.id) {
      toast.info("Bạn cần đăng nhập để sử dụng chức năng này!");
      return;
    }
    setIsLoading(true);
    try {
      const res = await updateMangaCategory(
        session.user.id,
        manga.id,
        v.toUpperCase() as any,
        manga.latestChapter || "none"
      );
      if (res.status === 200 || res.status === 201) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setIsLoading(false);

      return;
    }
  };

  const handleCancel = () => {
    // Reset value to default when dialog is closed
    setValue(getLocalCategoryOfId(manga.id) || "none");
    setIsNotificationEnabled(isInLocalNotification(manga.id));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size={isMobile ? "icon" : "lg"}
          className={cn("rounded-sm", isMobile && "grow-0")}
        >
          {options.find((opt) => opt.value === value)?.icon}
          {!isMobile && (
            <span>{options.find((opt) => opt.value === value)?.btnLabel}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "sm:max-w-[800px] sm:max-h-[calc(100vh-3rem)] overflow-auto",
          `theme-${config.theme}`
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Thêm vào thư viện</DialogTitle>
          <DialogDescription className="hidden">mẹ mày béo</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-row gap-4">
            <LazyLoadImage
              wrapperClassName={cn(
                "!block rounded-sm object-cover max-w-[250px] w-full h-auto",
                !loaded && "aspect-[5/7]"
              )}
              placeholderSrc="/images/place-doro.webp"
              className={cn(
                "h-auto w-full rounded-sm block object-cover shadow-md drop-shadow-md aspect-[5/7]"
              )}
              src={src}
              alt={`Ảnh bìa ${manga.title}`}
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                e.currentTarget.src = "/images/xidoco.webp";
              }}
            />

            <div className="flex flex-col gap-4 w-full">
              <p className="font-bold text-2xl line-clamp-4 sm:line-clamp-2">
                {manga.title}
              </p>

              <div className="hidden sm:flex flex-row gap-2 w-full">
                <Select
                  value={value}
                  onValueChange={(v) => setValue(v as LibraryType | "none")}
                >
                  <SelectTrigger className="h-10 font-semibold">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="hover:bg-secondary"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="icon"
                  variant={
                    value === "none"
                      ? "outline"
                      : isNotificationEnabled
                      ? "default"
                      : "outline"
                  }
                  className="shrink-0 size-10 [&_svg]:size-5"
                  onClick={() => setIsNotificationEnabled((prev) => !prev)}
                  disabled={value === "none"}
                >
                  {value === "none" ? (
                    <BellOff />
                  ) : isNotificationEnabled ? (
                    <BellRing className="animate-bell-shake" />
                  ) : (
                    <BellOff />
                  )}
                </Button>
              </div>
              <Label className="hidden sm:block" htmlFor="note">
                Hướng dẫn:
              </Label>
              <div className="hidden sm:block -mt-2 text-base text-muted-foreground">
                <p>- Chọn 1 trong các danh mục trên để thêm truyện.</p>
                <p>
                  - Chọn{" "}
                  <span className="font-semibold">&quot;Không&quot;</span> để
                  xoá truyện khỏi thư viện.
                </p>
                <p>- Nhấn chuông để nhận thông báo khi có chap mới.</p>
              </div>
            </div>
          </div>

          <div className="sm:hidden flex flex-col gap-4 w-full">
            <div className="flex flex-row gap-2 w-full">
              <Select
                value={value}
                onValueChange={(v) => setValue(v as LibraryType | "none")}
              >
                <SelectTrigger className="h-10 font-semibold">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="hover:bg-secondary"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="icon"
                variant={
                  value === "none"
                    ? "outline"
                    : isNotificationEnabled
                    ? "default"
                    : "outline"
                }
                className="shrink-0 size-10 [&_svg]:size-5"
                onClick={() => setIsNotificationEnabled((prev) => !prev)}
                disabled={value === "none"}
              >
                {value === "none" ? (
                  <BellOff />
                ) : isNotificationEnabled ? (
                  <BellRing className="animate-bell-shake" />
                ) : (
                  <BellOff />
                )}
              </Button>
            </div>
            <Label htmlFor="note">Hướng dẫn:</Label>
            <div className="-mt-2 text-base text-muted-foreground">
              <p>- Chọn 1 trong các danh mục trên để thêm truyện.</p>
              <p>
                - Chọn <span className="font-semibold">&quot;Không&quot;</span>{" "}
                để xoá truyện khỏi thư viện.
              </p>
              <p>- Nhấn chuông để nhận thông báo khi có chap mới.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-end flex flex-col-reverse sm:flex-row gap-2 !space-x-0">
          <DialogClose asChild>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleCancel}
            >
              Hủy
            </Button>
          </DialogClose>

          <DialogClose asChild>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                handleLocalLibraryAdd(value);
                handleLocalNotificationToggle(value, isNotificationEnabled);
              }}
            >
              <CloudOff />
              Cập nhật
            </Button>
          </DialogClose>

          <Button
            disabled={isLoading}
            className="w-full sm:w-auto"
            onClick={() => {
              if (!session) {
                toast.info("Bạn cần đăng nhập để sử dụng chức năng này!");
                return;
              }
              // toast.info("Chức năng đang phát triển!");
              handleLibraryAdd(value);
            }}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <CircleUser />}
            Cập nhật
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
