"use client";

/**
 * `useMoeReaderImages` - tải ảnh MoeTruyen, bao gồm IMGX page-access/decode.
 *
 * - Cửa sổ ưu tiên quanh trang hiện tại được tải ngay
 * - Phần còn lại tải nền từng trang để tránh burst request toàn chapter
 * - Page-access vẫn được gom theo batch/cached trong `reader-image`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createMoetruyenPageAccessFetcher,
  loadMoetruyenReaderImage,
  MOETRUYEN_PAGE_ACCESS_BATCH_SIZE,
} from "@/lib/moetruyen/reader-image";
import { buildMoeReaderLoadQueues } from "@/lib/moetruyen/reader-queue";
import type { PageState } from "@/types/reader-image";

interface UseMoeReaderImagesOptions {
  chapterId: number;
}

const MAX_PARALLEL = 3;
const BACKGROUND_PARALLEL = 1;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;
const BACKGROUND_LOAD_DELAY_MS = 700;
const PRELOAD_BACKWARD = 3;

function createInitialPages(images: string[]): PageState[] {
  return images.map(() => ({
    blob: null,
    isLoaded: false,
    isLoading: false,
    isFailed: false,
  }));
}

function isBlobUrl(value: string | null): value is string {
  return typeof value === "string" && value.startsWith("blob:");
}

function noopProcessQueue() {
  return undefined;
}

export function useMoeReaderImages(
  images: string[],
  currentIndex: number,
  { chapterId }: UseMoeReaderImagesOptions,
) {
  const pageAccessFetcher = useMemo(
    () =>
      createMoetruyenPageAccessFetcher({
        chapterId,
        imageUrls: images,
      }),
    [chapterId, images],
  );
  const [pages, setPages] = useState<PageState[]>(() =>
    createInitialPages(images),
  );

  const stateRef = useRef<PageState[]>(pages);
  const parallelRef = useRef(0);
  const backgroundActiveRef = useRef(0);
  const urgentQueueRef = useRef<number[]>([]);
  const backgroundQueueRef = useRef<number[]>([]);
  const backgroundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const backgroundReadyRef = useRef(false);
  const mountedRef = useRef(true);
  const controllersRef = useRef<Map<number, AbortController>>(new Map());
  const pendingRetryRef = useRef<Set<number>>(new Set());
  const retryTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const attemptsRef = useRef<Map<number, number>>(new Map());
  const requestTokensRef = useRef<Map<number, number>>(new Map());
  const processQueueRef = useRef<() => void>(noopProcessQueue);

  useEffect(() => {
    stateRef.current = pages;
  }, [pages]);

  const updatePage = useCallback((index: number, patch: Partial<PageState>) => {
    if (!mountedRef.current) return;

    const current = stateRef.current;

    if (!current[index]) return;

    const next = [...current];
    next[index] = { ...next[index], ...patch };
    stateRef.current = next;
    setPages(next);
  }, []);

  const revokePageBlob = useCallback((index: number) => {
    const blobUrl = stateRef.current[index]?.blob ?? null;

    if (isBlobUrl(blobUrl)) {
      URL.revokeObjectURL(blobUrl);
    }
  }, []);

  const clearBackgroundTimer = useCallback(() => {
    if (backgroundTimeoutRef.current !== null) {
      clearTimeout(backgroundTimeoutRef.current);
      backgroundTimeoutRef.current = null;
    }

    backgroundReadyRef.current = false;
  }, []);

  const clearRetryTimer = useCallback((index: number) => {
    const timeout = retryTimeoutsRef.current.get(index);

    if (timeout !== undefined) {
      clearTimeout(timeout);
      retryTimeoutsRef.current.delete(index);
    }

    pendingRetryRef.current.delete(index);
  }, []);

  const invalidateRequest = useCallback(
    (index: number) => {
      requestTokensRef.current.set(
        index,
        (requestTokensRef.current.get(index) ?? 0) + 1,
      );
      controllersRef.current.get(index)?.abort();
      clearRetryTimer(index);
    },
    [clearRetryTimer],
  );

  const canStartLoad = useCallback((index: number) => {
    const page = stateRef.current[index];

    return (
      !!page &&
      !page.blob &&
      !page.isLoaded &&
      !page.isFailed &&
      !controllersRef.current.has(index) &&
      !pendingRetryRef.current.has(index)
    );
  }, []);

  const enqueueUrgentIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= images.length) return;

      urgentQueueRef.current = urgentQueueRef.current.filter(
        (queued) => queued !== index,
      );
      backgroundQueueRef.current = backgroundQueueRef.current.filter(
        (queued) => queued !== index,
      );
      urgentQueueRef.current.unshift(index);
      clearBackgroundTimer();
    },
    [clearBackgroundTimer, images.length],
  );

  const scheduleBackgroundQueue = useCallback(() => {
    if (
      !mountedRef.current ||
      backgroundTimeoutRef.current !== null ||
      backgroundReadyRef.current
    ) {
      return;
    }

    backgroundTimeoutRef.current = setTimeout(() => {
      backgroundTimeoutRef.current = null;
      backgroundReadyRef.current = true;
      processQueueRef.current();
    }, BACKGROUND_LOAD_DELAY_MS);
  }, []);

  const loadPage = useCallback(
    async (index: number, isBackground = false) => {
      const completeLoad = () => {
        if (isBackground) {
          backgroundActiveRef.current = Math.max(
            0,
            backgroundActiveRef.current - 1,
          );
        }

        parallelRef.current = Math.max(0, parallelRef.current - 1);

        if (mountedRef.current) {
          processQueueRef.current();
        }
      };

      const source = images[index];

      if (!source) {
        updatePage(index, {
          blob: null,
          isFailed: true,
          isLoaded: false,
          isLoading: false,
        });
        completeLoad();
        return;
      }

      const token = (requestTokensRef.current.get(index) ?? 0) + 1;
      requestTokensRef.current.set(index, token);

      const controller = new AbortController();
      controllersRef.current.set(index, controller);

      const attempt = (attemptsRef.current.get(index) ?? 0) + 1;
      attemptsRef.current.set(index, attempt);

      updatePage(index, {
        isFailed: false,
        isLoaded: false,
        isLoading: true,
      });

      try {
        const blob = await loadMoetruyenReaderImage({
          source,
          pageIndex: index,
          chapterId,
          signal: controller.signal,
          pageAccessFetcher,
        });

        if (
          !mountedRef.current ||
          requestTokensRef.current.get(index) !== token
        ) {
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        revokePageBlob(index);
        attemptsRef.current.delete(index);

        updatePage(index, {
          blob: blobUrl,
          isFailed: false,
          isLoaded: false,
          isLoading: false,
        });
      } catch {
        if (
          controller.signal.aborted ||
          !mountedRef.current ||
          requestTokensRef.current.get(index) !== token
        ) {
          return;
        }

        if (attempt < MAX_ATTEMPTS) {
          pendingRetryRef.current.add(index);

          const timeout = setTimeout(() => {
            retryTimeoutsRef.current.delete(index);
            pendingRetryRef.current.delete(index);

            if (!mountedRef.current) return;

            enqueueUrgentIndex(index);
            processQueueRef.current();
          }, RETRY_DELAY_MS);

          retryTimeoutsRef.current.set(index, timeout);
          return;
        }

        attemptsRef.current.delete(index);
        revokePageBlob(index);

        updatePage(index, {
          blob: null,
          isFailed: true,
          isLoaded: false,
          isLoading: false,
        });
      } finally {
        if (controllersRef.current.get(index) === controller) {
          controllersRef.current.delete(index);
        }

        completeLoad();
      }
    },
    [
      chapterId,
      enqueueUrgentIndex,
      images,
      pageAccessFetcher,
      revokePageBlob,
      updatePage,
    ],
  );

  const processQueue = useCallback(() => {
    while (
      urgentQueueRef.current.length > 0 &&
      parallelRef.current < MAX_PARALLEL
    ) {
      const index = urgentQueueRef.current.shift()!;

      if (!canStartLoad(index)) continue;

      parallelRef.current += 1;
      void loadPage(index);
    }

    if (
      urgentQueueRef.current.length > 0 ||
      parallelRef.current >= MAX_PARALLEL ||
      backgroundActiveRef.current >= BACKGROUND_PARALLEL ||
      backgroundQueueRef.current.length === 0
    ) {
      return;
    }

    if (!backgroundReadyRef.current) {
      scheduleBackgroundQueue();
      return;
    }

    backgroundReadyRef.current = false;

    let startedBackgroundLoads = 0;

    while (
      backgroundQueueRef.current.length > 0 &&
      startedBackgroundLoads < BACKGROUND_PARALLEL &&
      backgroundActiveRef.current < BACKGROUND_PARALLEL &&
      parallelRef.current < MAX_PARALLEL
    ) {
      const index = backgroundQueueRef.current.shift()!;

      if (!canStartLoad(index)) continue;

      parallelRef.current += 1;
      backgroundActiveRef.current += 1;
      startedBackgroundLoads += 1;
      void loadPage(index, true);
    }

    if (startedBackgroundLoads === 0 && backgroundQueueRef.current.length > 0) {
      scheduleBackgroundQueue();
    }
  }, [canStartLoad, loadPage, scheduleBackgroundQueue]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  useEffect(() => {
    const { urgent, background } = buildMoeReaderLoadQueues({
      total: images.length,
      currentIndex,
      preloadForward: MOETRUYEN_PAGE_ACCESS_BATCH_SIZE,
      preloadBackward: PRELOAD_BACKWARD,
      canStart: canStartLoad,
    });

    urgentQueueRef.current = urgent;
    backgroundQueueRef.current = background;
    clearBackgroundTimer();
    processQueue();
  }, [
    canStartLoad,
    clearBackgroundTimer,
    currentIndex,
    images.length,
    processQueue,
  ]);

  const retry = useCallback(
    (index: number) => {
      if (!stateRef.current[index]) return;

      invalidateRequest(index);
      attemptsRef.current.delete(index);
      revokePageBlob(index);

      updatePage(index, {
        blob: null,
        isFailed: false,
        isLoaded: false,
        isLoading: false,
      });

      enqueueUrgentIndex(index);
      processQueueRef.current();
    },
    [enqueueUrgentIndex, invalidateRequest, revokePageBlob, updatePage],
  );

  const markLoaded = useCallback(
    (index: number) => {
      const page = stateRef.current[index];

      if (!mountedRef.current || !page?.blob || page.isFailed) return;

      updatePage(index, { isLoaded: true, isLoading: false });
    },
    [updatePage],
  );

  const markFailed = useCallback(
    (index: number) => {
      const page = stateRef.current[index];

      if (!mountedRef.current || !page || page.isFailed) return;

      invalidateRequest(index);
      attemptsRef.current.delete(index);
      revokePageBlob(index);

      updatePage(index, {
        blob: null,
        isFailed: true,
        isLoaded: false,
        isLoading: false,
      });

      processQueueRef.current();
    },
    [invalidateRequest, revokePageBlob, updatePage],
  );

  useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    const retryTimeouts = retryTimeoutsRef.current;
    const pendingRetries = pendingRetryRef.current;

    return () => {
      mountedRef.current = false;

      clearBackgroundTimer();

      controllers.forEach((controller) => controller.abort());
      controllers.clear();

      retryTimeouts.forEach((timeout) => clearTimeout(timeout));
      retryTimeouts.clear();
      pendingRetries.clear();

      stateRef.current.forEach((_, index) => {
        revokePageBlob(index);
      });
    };
  }, [clearBackgroundTimer, revokePageBlob]);

  return { pages, retry, markLoaded, markFailed };
}
