"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePreloadImagesOptions {
  images: string[];
  preloadCount?: number;
  visibilityThreshold?: number;
}

export function usePreloadImages({
  images,
  preloadCount = 5,
  visibilityThreshold = 0.1,
}: UsePreloadImagesOptions) {
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set());
  // đọc state mới nhất mà không cần reset Observer
  const visibleImagesRef = useRef<Set<number>>(new Set());

  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(
    new Set(),
  );
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const attemptedImagesRef = useRef<Set<string>>(new Set());

  // Sync State -> Ref (Luôn giữ ref mới nhất)
  useEffect(() => {
    visibleImagesRef.current = visibleImages;
  }, [visibleImages]);

  const preloadImage = useCallback((src: string) => {
    // chỉ check Ref
    if (attemptedImagesRef.current.has(src)) return;

    attemptedImagesRef.current.add(src);

    const img = new Image();
    img.src = src;
    img.onload = () => {
      // Dùng functional update để tránh dependency
      setPreloadedImages((prev) => {
        const next = new Set(prev); // Tạo ra một Set mới tinh ở địa chỉ mới (0x456)
        next.add(src);
        return next; // Trả về 0x456 state mới -> re-render
      });
    };

    img.onerror = () => {
      console.warn(`Failed to preload image: ${src}`);
      attemptedImagesRef.current.delete(src);
    };
  }, []);

  // Setup Intersection Observer
  useEffect(() => {
    // Check support SSR
    if (typeof window === "undefined" || !window.IntersectionObserver) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const currentVisible = new Set(visibleImagesRef.current);
        let hasChanges = false;

        entries.forEach((entry) => {
          const index = parseInt(
            entry.target.getAttribute("data-image-index") || "-1",
          );
          if (index === -1) return;

          if (entry.isIntersecting) {
            if (!currentVisible.has(index)) {
              currentVisible.add(index);
              hasChanges = true;
            }
          } else {
            if (currentVisible.has(index)) {
              currentVisible.delete(index);
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          setVisibleImages(currentVisible);
        }
      },
      {
        threshold: visibilityThreshold,
        rootMargin: "100px 0px 400px 0px",
      },
    );

    return () => observerRef.current?.disconnect();
  }, [visibilityThreshold]);

  useEffect(() => {
    if (visibleImages.size === 0) return;

    // tìm max thủ công nhanh hơn do không tạo ra một mảng khác
    let maxVisibleIndex = -1;
    for (const index of visibleImages) {
      if (index > maxVisibleIndex) maxVisibleIndex = index;
    }

    const imagesToPreload: string[] = [];
    for (let i = 1; i <= preloadCount; i++) {
      const nextIndex = maxVisibleIndex + i;
      if (nextIndex < images.length) {
        imagesToPreload.push(images[nextIndex]);
      }
    }

    imagesToPreload.forEach(preloadImage);
  }, [visibleImages, images, preloadCount, preloadImage]);

  const registerImageElement = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (!element || !observerRef.current) return;

      // Gán data attribute để Observer đọc lại được index
      element.setAttribute("data-image-index", index.toString());
      observerRef.current.observe(element);
    },
    [],
  );

  return {
    registerImageElement,
    markImageAsLoaded: useCallback((index: number) => {
      setLoadedImages((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    }, []),
    isImageLoaded: useCallback(
      (index: number) => loadedImages.has(index),
      [loadedImages],
    ),
    preloadedImages,
    visibleImages,
  };
}
