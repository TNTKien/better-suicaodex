"use client";

import type { PageState } from "@/hooks/use-reader-images";
import { useReaderStore } from "@/store/reader-store";
import { useEffect, useRef } from "react";

import MoeMangaImage from "./moe-manga-image";

interface MoeLongStripProps {
  pages: PageState[];
  retry: (index: number) => void;
  onCurrentIndexChange: (index: number) => void;
}

export default function MoeLongStrip({
  pages,
  retry,
  onCurrentIndexChange,
}: MoeLongStripProps) {
  const imageGap = useReaderStore((state) => state.imageGap);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const visibleRatios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-page-index"));

          if (!Number.isNaN(index)) {
            visibleRatios.set(index, entry.intersectionRatio);
          }
        });

        let maxRatio = 0;
        let mostVisible = 0;

        visibleRatios.forEach((ratio, index) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            mostVisible = index;
          }
        });

        if (maxRatio > 0) {
          onCurrentIndexChange(mostVisible);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    observerRef.current = observer;
    itemRefs.current.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [onCurrentIndexChange]);

  const registerRef = (index: number, element: HTMLElement | null) => {
    const previous = itemRefs.current.get(index);

    if (previous) {
      observerRef.current?.unobserve(previous);
    }

    if (element) {
      element.setAttribute("data-page-index", String(index));
      itemRefs.current.set(index, element);
      observerRef.current?.observe(element);
    } else {
      itemRefs.current.delete(index);
    }
  };

  return (
    <div
      className="flex w-full flex-col items-center"
      style={{ gap: `${imageGap}px` }}
    >
      {pages.map((page, index) => (
        <div
          key={index}
          ref={(element) => registerRef(index, element)}
          className="flex w-full justify-center"
          style={{ minHeight: page.isLoaded ? undefined : "500px" }}
        >
          <MoeMangaImage
            page={page}
            alt={`Trang ${index + 1}`}
            onRetry={() => retry(index)}
          />
        </div>
      ))}
    </div>
  );
}
