"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChapterAtHome } from "@/lib/mangadex/chapter";
import {
  buildPageSources,
  createInitialPages,
  getPriorityOrder,
  type ReaderPage,
} from "./reader-utils";

const MAX_PARALLEL = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

export function useReaderPages(chapterId: string, dataSaver: boolean) {
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const inFlight = useRef<Map<number, XMLHttpRequest>>(new Map());
  const queue = useRef<number[]>([]);
  const timeouts = useRef<Map<number, number>>(new Map());

  const pageCount = pages.length;

  const revokeUrl = useCallback((url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const updatePage = useCallback(
    (index: number, updates: Partial<ReaderPage>) => {
      setPages((prev) =>
        prev.map((page) => {
          if (page.index !== index) return page;
          if (updates.url && page.url && updates.url !== page.url) {
            revokeUrl(page.url);
          }
          return { ...page, ...updates };
        })
      );
    },
    [revokeUrl]
  );

  function processQueue() {
    if (!queue.current.length) return;

    while (inFlight.current.size < MAX_PARALLEL && queue.current.length) {
      const nextIndex = queue.current.shift();
      if (nextIndex === undefined) break;
      const page = pages[nextIndex];
      if (!page || page.status === "loaded" || page.status === "loading") {
        continue;
      }
      if (page.retries > MAX_RETRIES) continue;
      loadPage(nextIndex);
    }
  }

  function enqueueAroundCurrent(index: number) {
    const order = getPriorityOrder(index, pageCount);
    queue.current = order.filter((pageIndex) => {
      const page = pages[pageIndex];
      return page && page.status !== "loaded" && page.status !== "loading";
    });
    processQueue();
  }

  function handleError(index: number) {
    const page = pages[index];
    if (!page) return;

    const retries = page.retries + 1;
    updatePage(index, { status: "failed", retries });

    if (retries <= MAX_RETRIES) {
      const timeoutId = window.setTimeout(() => {
        updatePage(index, { status: "idle" });
        enqueueAroundCurrent(currentIndex);
      }, RETRY_DELAY);
      timeouts.current.set(index, timeoutId);
    }
  }

  function loadPage(index: number) {
    const page = pages[index];
    if (!page || page.status === "loaded" || page.status === "loading") {
      return;
    }

    updatePage(index, { status: "loading" });

    const xhr = new XMLHttpRequest();
    inFlight.current.set(index, xhr);

    xhr.open("GET", page.sourceUrl, true);
    xhr.responseType = "blob";

    xhr.onload = () => {
      inFlight.current.delete(index);
      if (xhr.status < 200 || xhr.status >= 300) {
        handleError(index);
        return;
      }

      const blob = xhr.response as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        updatePage(index, {
          url: blobUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          status: "loaded",
        });
      };
      img.onerror = () => {
        revokeUrl(blobUrl);
        handleError(index);
      };
      img.src = blobUrl;
    };

    xhr.onerror = () => {
      inFlight.current.delete(index);
      handleError(index);
    };

    xhr.send();
  }

  const retryPage = useCallback(
    (index: number) => {
      updatePage(index, { status: "idle", retries: 0 });
      enqueueAroundCurrent(index);
    },
    [updatePage]
  );

  const resetPages = useCallback(() => {
    setPages((prev) => {
      prev.forEach((page) => revokeUrl(page.url));
      return [];
    });
  }, [revokeUrl]);

  useEffect(() => {
    let mounted = true;
    const fetchPages = async () => {
      setIsLoading(true);
      setError(null);
      resetPages();

      try {
        const atHome = await getChapterAtHome(chapterId);
        const sources = buildPageSources(atHome, dataSaver);

        if (!sources.length) {
          throw new Error("Không có dữ liệu trang.");
        }

        if (!mounted) return;
        setPages(createInitialPages(sources));
        setIsLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Không thể tải trang.");
        setIsLoading(false);
      }
    };

    fetchPages();

    return () => {
      mounted = false;
    };
  }, [chapterId, dataSaver, resetPages]);

  useEffect(() => {
    if (!pageCount) return;
    enqueueAroundCurrent(currentIndex);
  }, [currentIndex, pageCount, pages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      processQueue();
    }, 200);

    return () => window.clearInterval(interval);
  }, [pages]);

  useEffect(() => {
    return () => {
      inFlight.current.forEach((xhr) => xhr.abort());
      timeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      resetPages();
    };
  }, [resetPages]);

  useEffect(() => {
    return () => {
      setPages((prev) => {
        prev.forEach((page) => revokeUrl(page.url));
        return prev;
      });
    };
  }, [revokeUrl]);

  const loadedCount = useMemo(
    () => pages.filter((page) => page.status === "loaded").length,
    [pages]
  );

  return {
    pages,
    pageCount,
    isLoading,
    error,
    loadedCount,
    currentIndex,
    setCurrentIndex,
    enqueueAroundCurrent,
    retryPage,
  };
}
