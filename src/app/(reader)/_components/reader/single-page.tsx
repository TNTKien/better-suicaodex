"use client";

import { type PageState } from "@/hooks/use-reader-images";
import MangaImage from "./manga-image";

interface SinglePageProps {
  pages: PageState[];
  currentIndex: number;
  retry: (index: number) => void;
  markLoaded: (index: number) => void;
  markFailed: (index: number) => void;
  /** RTL: click trái = next, click phải = prev */
  rtl?: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export default function SinglePage({
  pages,
  currentIndex,
  retry,
  markLoaded,
  markFailed,
  rtl = false,
  onNavigatePrev,
  onNavigateNext,
}: SinglePageProps) {
  const page = pages[currentIndex];
  if (!page) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    // RTL đảo chiều: trái = tiến, phải = lùi
    const goForward = rtl ? isLeft : !isLeft;
    if (goForward) onNavigateNext();
    else onNavigatePrev();
  };

  // Preload trang trước/sau
  const prevBlob = pages[currentIndex - 1]?.blob;
  const nextBlob = pages[currentIndex + 1]?.blob;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-dvh cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* Hidden preload imgs */}
      {prevBlob && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prevBlob}
          alt=""
          aria-hidden
          className="absolute w-px h-px opacity-0 pointer-events-none"
          onLoad={() => markLoaded(currentIndex - 1)}
          onError={() => markFailed(currentIndex - 1)}
        />
      )}
      {nextBlob && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nextBlob}
          alt=""
          aria-hidden
          className="absolute w-px h-px opacity-0 pointer-events-none"
          onLoad={() => markLoaded(currentIndex + 1)}
          onError={() => markFailed(currentIndex + 1)}
        />
      )}
      <span className="absolute top-2 text-xs text-muted-foreground z-10 bg-primary px-1 rounded opacity-25">
        {currentIndex + 1} / {pages.length}
      </span>
      <MangaImage
        page={page}
        pageIndex={currentIndex}
        alt={`Trang ${currentIndex + 1}`}
        onRetry={() => retry(currentIndex)}
        onLoad={markLoaded}
        onError={markFailed}
      />
    </div>
  );
}
