"use client";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  IMAGE_SCALE_LABELS,
  READER_MODE_LABELS,
  type ImageScale,
  type ReaderMode,
  useReaderStore,
} from "@/store/reader-store";
import {
  BookOpen,
  FileInput,
  FileOutput,
  GalleryVertical,
  ImageIcon,
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
import type { ReactNode } from "react";

interface ReaderOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

export default function MoeReaderSettingsDialog() {
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

  const readingModes: ReaderOption<ReaderMode>[] = [
    {
      value: "long-strip",
      label: READER_MODE_LABELS["long-strip"],
      icon: <GalleryVertical />,
    },
    {
      value: "single",
      label: READER_MODE_LABELS.single,
      icon: <FileInput />,
    },
    {
      value: "double",
      label: READER_MODE_LABELS.double,
      icon: <BookOpen />,
    },
    {
      value: "single-rtl",
      label: READER_MODE_LABELS["single-rtl"],
      icon: <FileOutput />,
    },
  ];

  const imageScales: ReaderOption<ImageScale>[] = [
    {
      value: "original",
      label: IMAGE_SCALE_LABELS.original,
      icon: <ImageIcon />,
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
      <DialogContent className="max-w-full border-none md:min-w-lg">
        <DialogHeader>
          <DialogTitle>Tùy chỉnh Reader (Beta)</DialogTitle>
          <DialogDescription>
            Các tùy chỉnh đang trong quá trình thử nghiệm, có thể lỗi hoặc mang
            lại trải nghiệm không mong muốn
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 transition-all duration-300">
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

          {mode === "long-strip" ? (
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
                  onChange={(event) => {
                    if (!event.target.value) {
                      return;
                    }

                    const gap = parseInt(event.target.value);
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
          ) : null}

          {mode === "double" ? (
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
                  onChange={(event) => {
                    const value = Math.min(
                      3,
                      Math.max(0, parseInt(event.target.value) || 0),
                    );
                    setSpreadOffset(value);
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
          ) : null}

          <div className="space-y-1.5">
            <Label className="font-semibold">Ảnh truyện</Label>
            <div className="grid grid-cols-2 gap-2">
              {imageScales.map(({ value, label, icon }) => (
                <Button
                  key={value}
                  variant="outline"
                  className={cn(scale === value && "border-2 border-primary!")}
                  onClick={() => setScale(value)}
                >
                  {icon}
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          </div>

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
                className={cn(header && "border-2 border-primary!")}
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
