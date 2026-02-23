"use client";

import { type PageState } from "@/hooks/use-reader-images";
import MangaImage from "./manga-image";

interface SinglePageProps {
  pages: PageState[];
  currentIndex: number;
  retry: (index: number) => void;
  /** RTL: click trái = next, click phải = prev */
  rtl?: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

export default function SinglePage({
  pages,
  currentIndex,
  retry,
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

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-dvh cursor-pointer select-none"
      onClick={handleClick}
    >
      <span className="absolute top-2 text-xs text-muted-foreground z-10 bg-primary px-1 rounded opacity-25">
        {currentIndex + 1} / {pages.length}
      </span>
      <MangaImage
        page={page}
        alt={`Trang ${currentIndex + 1}`}
        onRetry={() => retry(currentIndex)}
      />
    </div>
  );
}
