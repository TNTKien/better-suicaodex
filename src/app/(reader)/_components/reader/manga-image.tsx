"use client";

import { type PageState } from "@/hooks/use-reader-images";
import { getImageScaleClasses, useReaderStore } from "@/store/reader-store";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface MangaImageProps {
  /** Trạng thái tải của trang này từ useReaderImages */
  page: PageState;
  alt: string;
  onRetry: () => void;
  /** Dùng trong chế độ 2 trang - căn ảnh vào giữa spread */
  isDouble?: boolean;
}

export default function MangaImage({ page, alt, onRetry, isDouble }: MangaImageProps) {
  const scale = useReaderStore((s) => s.scale);
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
      {page.blob && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.blob}
          alt={alt}
          className={cn(
            "object-contain block transition-opacity duration-150 ease-in-out",
            imgClasses,
            !imgVisible && "opacity-0",
            isDouble && "mx-auto",
          )}
          loading="eager"
          onLoad={() => setImgVisible(true)}
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
            setImgVisible(true);
          }}
        />
      )}

      {/* Skeleton / loading */}
      {!page.isLoaded && !page.isFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      )}

      {/* Error + retry */}
      {page.isFailed && (
        <Button
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          variant="outline"
          size="sm"
        >
          <RotateCcw />
          Lỗi load ảnh, thử lại
        </Button>
      )}
    </div>
  );
}