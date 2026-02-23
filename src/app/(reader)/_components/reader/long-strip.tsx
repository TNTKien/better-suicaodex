"use client";

import { type PageState } from "@/hooks/use-reader-images";
import { useReaderStore } from "@/store/reader-store";
import { useEffect, useRef } from "react";
import MangaImage from "./manga-image";

interface LongStripProps {
  pages: PageState[];
  retry: (index: number) => void;
  /** Báo về Reader index mỗi khi trang hiển thị thay đổi (dùng để ưu tiên load) */
  onCurrentIndexChange: (index: number) => void;
}

export default function LongStrip({ pages, retry, onCurrentIndexChange }: LongStripProps) {
  const imageGap = useReaderStore((s) => s.imageGap);
  const itemRefs   = useRef<Map<number, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver - track trang hiện đang hiển thị nhiều nhất
  useEffect(() => {
    const visibleRatios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-page-index"));
          if (!Number.isNaN(idx)) visibleRatios.set(idx, entry.intersectionRatio);
        });

        let maxRatio = 0;
        let mostVisible = 0;
        visibleRatios.forEach((ratio, idx) => {
          if (ratio > maxRatio) { maxRatio = ratio; mostVisible = idx; }
        });
        if (maxRatio > 0) onCurrentIndexChange(mostVisible);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    observerRef.current = observer;
    itemRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registerRef = (index: number, el: HTMLElement | null) => {
    const prev = itemRefs.current.get(index);
    if (prev) observerRef.current?.unobserve(prev);
    if (el) {
      el.setAttribute("data-page-index", String(index));
      itemRefs.current.set(index, el);
      observerRef.current?.observe(el);
    } else {
      itemRefs.current.delete(index);
    }
  };

  return (
    <div className="flex flex-col items-center w-full" style={{ gap: `${imageGap}px` }}>
      {pages.map((page, index) => (
        <div
          key={index}
          ref={(el) => registerRef(index, el)}
          className="w-full flex justify-center"
          style={{ minHeight: page.isLoaded ? undefined : "500px" }}
        >
          <MangaImage
            page={page}
            alt={`Trang ${index + 1}`}
            onRetry={() => retry(index)}
          />
        </div>
      ))}
    </div>
  );
}
