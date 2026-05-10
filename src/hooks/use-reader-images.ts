"use client";

/**
 * `useReaderImages` - tải ảnh reader bằng Blob URL.
 *
 * - Tối đa MAX_PARALLEL ảnh được fetch đồng thời
 * - Hàng đợi ưu tiên: trang hiện tại trước, rồi lan dần ra hai phía
 * - Fetch thành công tạo `blob:` URL; component vẫn báo ngược khi ảnh decode xong / lỗi
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PageState {
  blob: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  isFailed: boolean;
}

const MAX_PARALLEL = 3;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

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

export function useReaderImages(images: string[], currentIndex: number) {
  const [pages, setPages] = useState<PageState[]>(() =>
    createInitialPages(images),
  );

  const stateRef = useRef<PageState[]>(pages);
  const parallelRef = useRef(0);
  const queueRef = useRef<number[]>([]);
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

  const enqueueIndex = useCallback(
    (index: number, front = false) => {
      if (index < 0 || index >= images.length) return;

      queueRef.current = queueRef.current.filter((queued) => queued !== index);

      if (front) {
        queueRef.current.unshift(index);
      } else {
        queueRef.current.push(index);
      }
    },
    [images.length],
  );

  const loadPage = useCallback(
    async (index: number) => {
      const source = images[index];

      if (!source) {
        updatePage(index, {
          blob: null,
          isFailed: true,
          isLoaded: false,
          isLoading: false,
        });
        parallelRef.current = Math.max(0, parallelRef.current - 1);
        processQueueRef.current();
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
        const response = await fetch(source, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Failed to fetch reader image: ${response.status}`);
        }

        const blob = await response.blob();

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

            enqueueIndex(index, true);
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

        parallelRef.current = Math.max(0, parallelRef.current - 1);

        if (mountedRef.current) {
          processQueueRef.current();
        }
      }
    },
    [enqueueIndex, images, revokePageBlob, updatePage],
  );

  const processQueue = useCallback(() => {
    while (queueRef.current.length > 0 && parallelRef.current < MAX_PARALLEL) {
      const index = queueRef.current.shift()!;

      if (!canStartLoad(index)) continue;

      parallelRef.current += 1;
      void loadPage(index);
    }
  }, [canStartLoad, loadPage]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const buildQueue = useCallback(
    (centerIndex: number): number[] => {
      const total = images.length;
      const seen = new Set<number>();
      const queue: number[] = [];

      const tryAdd = (index: number) => {
        if (index < 0 || index >= total || seen.has(index)) return;

        seen.add(index);

        if (canStartLoad(index)) {
          queue.push(index);
        }
      };

      tryAdd(centerIndex);

      for (let distance = 1; distance < total; distance++) {
        tryAdd(centerIndex + distance);
        tryAdd(centerIndex - distance);
      }

      return queue;
    },
    [canStartLoad, images.length],
  );

  useEffect(() => {
    const priority = buildQueue(currentIndex);
    const prioritySet = new Set(priority);
    const remaining = queueRef.current.filter(
      (index) => !prioritySet.has(index) && canStartLoad(index),
    );

    queueRef.current = [...priority, ...remaining];
    processQueue();
  }, [buildQueue, canStartLoad, currentIndex, processQueue]);

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

      enqueueIndex(index, true);
      processQueueRef.current();
    },
    [enqueueIndex, invalidateRequest, revokePageBlob, updatePage],
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

      controllers.forEach((controller) => controller.abort());
      controllers.clear();

      retryTimeouts.forEach((timeout) => clearTimeout(timeout));
      retryTimeouts.clear();
      pendingRetries.clear();

      stateRef.current.forEach((_, index) => {
        revokePageBlob(index);
      });
    };
  }, [revokePageBlob]);

  return { pages, retry, markLoaded, markFailed };
}
