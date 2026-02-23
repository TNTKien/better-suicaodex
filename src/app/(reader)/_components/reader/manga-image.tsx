"use client";

import { type PageState } from "@/hooks/use-reader-images";
import { getImageScaleClasses, useReaderStore } from "@/store/reader-store";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface MangaImageProps {
  /** Trạng thái tải của trang này từ useReaderImages */
  page: PageState;
  alt: string;
  onRetry: () => void;
  /** Dùng trong chế độ 2 trang – căn ảnh vào giữa spread */
  isDouble?: boolean;
}

export default function MangaImage({ page, alt, onRetry, isDouble }: MangaImageProps) {
  const scale = useReaderStore((s) => s.scale);
  const imgClasses = getImageScaleClasses(scale);

  return (
    <div
      className={cn(
        "relative select-none",
        !page.isLoaded && !page.isFailed && "aspect-5/7 min-w-[200px]",
        !isDouble && "mx-auto",
        isDouble && "w-full",
      )}
    >
      {/* Ảnh chính – chỉ hiển thị khi blob đã sẵn sàng */}
      {page.blob && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.blob}
          alt={alt}
          className={cn(
            "object-contain block",
            imgClasses,
            !page.isLoaded && "opacity-0",
            isDouble && "mx-auto",
          )}
          loading="eager"
          onError={(e) => {
            e.currentTarget.src = "/images/xidoco.webp";
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
        <button
          className="absolute inset-0 w-full flex flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors rounded"
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
        >
          <RotateCcw className="size-5" />
          <span className="text-xs font-medium">Tải thất bại – nhấn để thử lại</span>
        </button>
      )}
    </div>
  );
}