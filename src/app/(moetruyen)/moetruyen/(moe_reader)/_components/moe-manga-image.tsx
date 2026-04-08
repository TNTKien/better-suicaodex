"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PageState } from "@/hooks/use-reader-images";
import { cn } from "@/lib/utils";
import { getImageScaleClasses, useReaderStore } from "@/store/reader-store";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

interface MoeMangaImageProps {
  page: PageState;
  pageIndex: number;
  alt: string;
  onRetry: () => void;
  onLoad: (index: number) => void;
  onError: (index: number) => void;
  isDouble?: boolean;
}

export default function MoeMangaImage({
  page,
  pageIndex,
  alt,
  onRetry,
  onLoad,
  onError,
  isDouble,
}: MoeMangaImageProps) {
  const scale = useReaderStore((state) => state.scale);
  const imgClasses = getImageScaleClasses(scale);
  const [imgVisible, setImgVisible] = useState(false);

  useEffect(() => {
    setImgVisible(false);
  }, [page.blob]);

  return (
    <div
      className={cn(
        "relative select-none",
        !page.isLoaded && !page.isFailed && "aspect-5/7 min-w-[200px]",
        !isDouble && "mx-auto",
        isDouble && "w-full",
        page.isFailed && "flex items-center justify-center",
      )}
    >
      {page.blob ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.blob}
          alt={alt}
          className={cn(
            "block object-contain transition-opacity duration-150 ease-in-out",
            imgClasses,
            !imgVisible && "opacity-0",
            isDouble && "mx-auto",
          )}
          loading="eager"
          onLoad={() => {
            onLoad(pageIndex);
            setImgVisible(true);
          }}
          onError={(event) => {
            onError(pageIndex);
            event.currentTarget.src = "/images/xidoco.webp";
            setImgVisible(true);
          }}
        />
      ) : null}

      {!page.isLoaded && !page.isFailed ? (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-muted/20">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      ) : null}

      {page.isFailed ? (
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          variant="outline"
          size="sm"
        >
          <RotateCcw />
          Lỗi load ảnh, thử lại
        </Button>
      ) : null}
    </div>
  );
}
