"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Smile } from "lucide-react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/blur.css";
import { useIsMobile } from "@/hooks/use-mobile";
import { stickers, getCategories, getCategoryName } from "@/lib/stickers-fn";

interface StickerPickerProps {
  onSelectSticker: (stickerName: string) => void;
  buttonClassName?: string;
}

export function StickerPicker({
  onSelectSticker,
  buttonClassName,
}: StickerPickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const categories = getCategories();

  const handleSelectSticker = (stickerName: string) => {
    onSelectSticker(stickerName);
    setOpen(false);
  };

  const renderStickers = () => (
    <>
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b h-auto p-1 flex-wrap">
          <TabsTrigger value="all" className="capitalize text-xs">
            Tất cả
          </TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              className="text-xs"
            >
              {getCategoryName(category)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all" className="m-0">
          <ScrollArea className="h-[350px]">
            <div className="grid grid-cols-3 gap-2 p-2">
              {stickers.map((sticker) => (
                <button
                  key={sticker.title}
                  type="button"
                  onClick={() => handleSelectSticker(sticker.title)}
                  className="aspect-square rounded-none hover:rounded-lg hover:bg-primary/20 overflow-hidden transition-all"
                  title={sticker.title}
                >
                  <LazyLoadImage
                    src={sticker.url}
                    alt={sticker.title}
                    className="w-full h-full object-contain"
                    effect="blur"
                  />
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        {categories.map((category) => (
          <TabsContent key={category} value={category} className="m-0">
            <ScrollArea className="h-[350px]">
              <div className="grid grid-cols-3 gap-2 p-2">
                {stickers
                  .filter((s) => s.category === category)
                  .map((sticker) => (
                    <button
                      key={sticker.title}
                      type="button"
                      onClick={() => handleSelectSticker(sticker.title)}
                      className="aspect-square rounded-none hover:rounded-lg hover:bg-primary/20 overflow-hidden transition-all"
                      title={sticker.title}
                    >
                      <LazyLoadImage
                        src={sticker.url}
                        alt={sticker.title}
                        className="w-full h-full object-contain"
                        effect="blur"
                      />
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={buttonClassName || "h-8 w-8"}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader>
            <DrawerTitle>Không thấy sticker bạn thích?</DrawerTitle>
            <DrawerDescription>
              Đề xuất sticker mới{" "}
              <a
                className="text-primary underline"
                href="https://github.com/TNTKien/better-suicaodex/discussions/36"
                target="_blank"
                rel="noopener noreferrer"
              >
                tại đây
              </a>
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-2">{renderStickers()}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={buttonClassName || "h-8 w-8"}
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="end">
        <div className="flex flex-col gap-0 px-3 py-2 border-b">
          <p className="font-medium text-sm">Không thấy sticker bạn thích?</p>
          <span className="text-xs text-muted-foreground">
            Đề xuất thêm sticker mới{" "}
            <a
              className="text-primary underline"
              href="https://github.com/TNTKien/better-suicaodex/discussions/36"
              target="_blank"
              rel="noopener noreferrer"
            >
              tại đây
            </a>
          </span>
        </div>
        {renderStickers()}
      </PopoverContent>
    </Popover>
  );
}
