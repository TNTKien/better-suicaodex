"use client";

import { type PageState } from "@/hooks/use-reader-images";
import { cn } from "@/lib/utils";
import MangaImage from "./manga-image";

interface DoublePageProps {
  pages: PageState[];
  /** Indices của spread hiện tại - [left] hoặc [left, right] */
  spreadPages: [number] | [number, number];
  retry: (index: number) => void;
  markLoaded: (index: number) => void;
  markFailed: (index: number) => void;
  /** RTL: đảo thứ tự hiển thị */
  rtl?: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export default function DoublePage({
  pages,
  spreadPages,
  retry,
  markLoaded,
  markFailed,
  rtl = false,
  onNavigatePrev,
  onNavigateNext,
}: DoublePageProps) {
  // RTL đảo thứ tự: trang phải hiển thị trước (trang trái = số nhỏ hơn)
  const displayIndices = rtl
    ? ([...spreadPages].reverse() as typeof spreadPages)
    : spreadPages;
  const isDouble = spreadPages.length === 2;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    const goForward = rtl ? isLeft : !isLeft;
    if (goForward) onNavigateNext();
    else onNavigatePrev();
  };

  const pageLabel = isDouble
    ? `${spreadPages[0] + 1}-${(spreadPages as [number, number])[1] + 1}`
    : `${spreadPages[0] + 1}`;

  // Preload các trang ở spread trước/sau để browser decode sẵn
  const firstIdxInSpread = spreadPages[0];
  const lastIdxInSpread = spreadPages[spreadPages.length - 1] as number;
  const prevSpreadBlob = pages[firstIdxInSpread - 1]?.blob;
  const nextSpreadBlob = pages[lastIdxInSpread + 1]?.blob;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-dvh cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* Hidden preload imgs */}
      {prevSpreadBlob && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prevSpreadBlob}
          alt=""
          aria-hidden
          className="absolute w-px h-px opacity-0 pointer-events-none"
          onLoad={() => markLoaded(firstIdxInSpread - 1)}
          onError={() => markFailed(firstIdxInSpread - 1)}
        />
      )}
      {nextSpreadBlob && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nextSpreadBlob}
          alt=""
          aria-hidden
          className="absolute w-px h-px opacity-0 pointer-events-none"
          onLoad={() => markLoaded(lastIdxInSpread + 1)}
          onError={() => markFailed(lastIdxInSpread + 1)}
        />
      )}
      {/* page index */}
      <span className="absolute top-2 text-xs text-muted-foreground z-10 bg-primary px-1 rounded opacity-25">
        {pageLabel} / {pages.length}
      </span>

      {/* Spread */}
      <div
        className={cn(
          "flex items-center justify-center w-full max-h-dvh",
          isDouble ? "gap-0" : "justify-center",
        )}
      >
        {displayIndices.map((idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center justify-center overflow-hidden",
              isDouble ? "flex-1" : "w-auto",
            )}
          >
            <MangaImage
              page={pages[idx]}
              pageIndex={idx}
              alt={`Trang ${idx + 1}`}
              onRetry={() => retry(idx)}
              onLoad={markLoaded}
              onError={markFailed}
              isDouble={isDouble}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
