"use client";

import { cn } from "@/lib/utils";
import type { PageState } from "@/hooks/use-reader-images";

import MoeMangaImage from "./moe-manga-image";

interface MoeDoublePageProps {
  pages: PageState[];
  spreadPages: [number] | [number, number];
  retry: (index: number) => void;
  markLoaded: (index: number) => void;
  markFailed: (index: number) => void;
  rtl?: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export default function MoeDoublePage({
  pages,
  spreadPages,
  retry,
  markLoaded,
  markFailed,
  rtl = false,
  onNavigatePrev,
  onNavigateNext,
}: MoeDoublePageProps) {
  const displayIndices = rtl ? [...spreadPages].reverse() : spreadPages;
  const isDouble = spreadPages.length === 2;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeft = event.clientX < rect.left + rect.width / 2;
    const goForward = rtl ? isLeft : !isLeft;

    if (goForward) {
      onNavigateNext();
    } else {
      onNavigatePrev();
    }
  };

  const pageLabel = isDouble
    ? `${spreadPages[0] + 1}-${spreadPages[1] + 1}`
    : `${spreadPages[0] + 1}`;

  const firstIndex = spreadPages[0];
  const lastIndex = spreadPages[spreadPages.length - 1];
  const prevBlob = pages[firstIndex - 1]?.blob;
  const nextBlob = pages[lastIndex + 1]?.blob;

  return (
    <div
      className="flex min-h-dvh flex-1 cursor-pointer select-none flex-col items-center justify-center"
      onClick={handleClick}
    >
      {prevBlob ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prevBlob}
          alt=""
          aria-hidden
          className="pointer-events-none absolute h-px w-px opacity-0"
          onLoad={() => markLoaded(firstIndex - 1)}
          onError={() => markFailed(firstIndex - 1)}
        />
      ) : null}
      {nextBlob ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nextBlob}
          alt=""
          aria-hidden
          className="pointer-events-none absolute h-px w-px opacity-0"
          onLoad={() => markLoaded(lastIndex + 1)}
          onError={() => markFailed(lastIndex + 1)}
        />
      ) : null}

      <span className="absolute top-2 z-10 rounded bg-primary px-1 text-xs text-muted-foreground opacity-25">
        {pageLabel} / {pages.length}
      </span>

      <div
        className={cn(
          "flex max-h-dvh w-full items-center justify-center",
          isDouble ? "gap-0" : "justify-center",
        )}
      >
        {displayIndices.map((index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-center overflow-hidden",
              isDouble ? "flex-1" : "w-auto",
            )}
          >
            <MoeMangaImage
              page={pages[index]}
              pageIndex={index}
              alt={`Trang ${index + 1}`}
              onRetry={() => retry(index)}
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
