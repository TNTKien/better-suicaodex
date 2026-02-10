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
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(
    new Set(),
  );
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const attemptedImagesRef = useRef<Set<string>>(new Set());

  const preloadImage = useCallback((src: string) => {
    // chỉ check Ref
    if (attemptedImagesRef.current.has(src)) return;

    attemptedImagesRef.current.add(src);

    const img = new Image();
    img.src = src;
    img.onload = () => {
      setPreloadedImages((prev) => new Set([...prev, src]));
    };
    img.onerror = () => {
      console.warn(`Failed to preload image: ${src}`);
      attemptedImagesRef.current.delete(src);
    };
  }, []);

  // Setup Intersection Observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const newVisibleImages = new Set(visibleImages);

        entries.forEach((entry) => {
          const index = parseInt(
            entry.target.getAttribute("data-image-index") || "0",
          );

          if (entry.isIntersecting) {
            newVisibleImages.add(index);
          } else {
            newVisibleImages.delete(index);
          }
        });

        setVisibleImages(newVisibleImages);
      },
      {
        threshold: visibilityThreshold,
        rootMargin: "100px 0px 400px 0px",
      },
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibilityThreshold, visibleImages]);

  useEffect(() => {
    if (visibleImages.size === 0) return;

    const maxVisibleIndex = Math.max(...Array.from(visibleImages));
    const imagesToPreload: string[] = [];

    for (let i = 1; i <= preloadCount; i++) {
      const nextIndex = maxVisibleIndex + i;
      if (nextIndex < images.length) {
        imagesToPreload.push(images[nextIndex]);
      }
    }

    imagesToPreload.forEach(preloadImage);
  }, [visibleImages, images, preloadCount, preloadImage]);

  const registerImageElement = (index: number, element: HTMLElement | null) => {
    if (!element || !observerRef.current) return;

    // Unobserve previous element if exists
    const previousElement = imageRefs.current.get(index);
    if (previousElement) {
      observerRef.current.unobserve(previousElement);
    }

    // Set data attribute and observe new element
    element.setAttribute("data-image-index", index.toString());
    imageRefs.current.set(index, element);
    observerRef.current.observe(element);
  };

  const markImageAsLoaded = (index: number) => {
    setLoadedImages((prev) => new Set([...prev, index]));
  };

  const isImageLoaded = (index: number) => {
    return loadedImages.has(index);
  };

  return {
    registerImageElement,
    markImageAsLoaded,
    isImageLoaded,
    preloadedImages,
    visibleImages,
  };
}
