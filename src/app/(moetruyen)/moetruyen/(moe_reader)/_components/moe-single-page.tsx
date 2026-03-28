"use client";

import type { PageState } from "@/hooks/use-reader-images";

import MoeMangaImage from "./moe-manga-image";

interface MoeSinglePageProps {
  pages: PageState[];
  currentIndex: number;
  retry: (index: number) => void;
  rtl?: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export default function MoeSinglePage({
  pages,
  currentIndex,
  retry,
  rtl = false,
  onNavigatePrev,
  onNavigateNext,
}: MoeSinglePageProps) {
  const page = pages[currentIndex];

  if (!page) {
    return null;
  }

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

  const prevBlob = pages[currentIndex - 1]?.blob;
  const nextBlob = pages[currentIndex + 1]?.blob;

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
        />
      ) : null}
      {nextBlob ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nextBlob}
          alt=""
          aria-hidden
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      ) : null}

      <span className="absolute top-2 z-10 rounded bg-primary px-1 text-xs text-muted-foreground opacity-25">
        {currentIndex + 1} / {pages.length}
      </span>

      <MoeMangaImage
        page={page}
        alt={`Trang ${currentIndex + 1}`}
        onRetry={() => retry(currentIndex)}
      />
    </div>
  );
}
