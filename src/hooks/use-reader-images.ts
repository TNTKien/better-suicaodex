"use client";

/**
 * `useReaderImages` - quản lý thứ tự kích hoạt ảnh reader qua URL trực tiếp.
 *
 * - Tối đa MAX_PARALLEL ảnh được kích hoạt tải đồng thời
 * - Hàng đợi ưu tiên: trang hiện tại trước, rồi lan dần ra hai phía
 * - Reader component sẽ báo ngược lại khi ảnh load xong / lỗi
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PageState {
  blob: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  isFailed: boolean;
}

const MAX_PARALLEL = 3;

export function useReaderImages(images: string[], currentIndex: number) {
  const [pages, setPages] = useState<PageState[]>(() =>
    images.map(() => ({
      blob: null,
      isLoaded: false,
      isLoading: false,
      isFailed: false,
    })),
  );

  // Ref mirror của state - không cần re-render để đọc
  const stateRef = useRef<PageState[]>(pages);
  const parallelRef = useRef(0);
  const queueRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  // Sync state → ref
  useEffect(() => {
    stateRef.current = pages;
  }, [pages]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updatePage = useCallback((index: number, patch: Partial<PageState>) => {
    if (!mountedRef.current) return;
    setPages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      stateRef.current = next;
      return next;
    });
  }, []);

  // Xây hàng đợi ưu tiên quanh currentIndex
  const buildQueue = useCallback(
    (cIdx: number): number[] => {
      const total = images.length;
      const seen = new Set<number>();
      const queue: number[] = [];

      const tryAdd = (i: number) => {
        if (i < 0 || i >= total || seen.has(i)) return;
        seen.add(i);
        const st = stateRef.current[i];
        if (!st.isLoaded && !st.isLoading && !st.isFailed) queue.push(i);
      };

      tryAdd(cIdx);
      for (let d = 1; d < total; d++) {
        tryAdd(cIdx + d);
        tryAdd(cIdx - d);
      }
      return queue;
    },
    [images.length],
  );

  // ── Core activator ───────────────────────────────────────────────────────

  const processQueue = useCallback(() => {
    while (queueRef.current.length > 0 && parallelRef.current < MAX_PARALLEL) {
      const idx = queueRef.current.shift()!;
      const page = stateRef.current[idx];
      if (!page || page.isLoaded || page.isLoading || page.isFailed) continue;

      parallelRef.current++;
      updatePage(idx, {
        blob: images[idx],
        isLoading: true,
        isLoaded: false,
        isFailed: false,
      });
    }
  }, [images, updatePage]);

  // ── Rebuild queue khi currentIndex thay đổi ──────────────────────────────

  useEffect(() => {
    // Thêm vào đầu queue các trang chưa load quanh currentIndex
    const priority = buildQueue(currentIndex);
    // Giữ lại những trang đang trong queue cũ nhưng không trùng
    const existingSet = new Set(priority);
    const remaining = queueRef.current.filter(
      (i) => !existingSet.has(i) && !stateRef.current[i]?.isLoaded,
    );
    queueRef.current = [...priority, ...remaining];
    processQueue();
  }, [currentIndex, buildQueue, processQueue]);

  // ── Retry thủ công ───────────────────────────────────────────────────────

  const retry = useCallback(
    (index: number) => {
      updatePage(index, {
        blob: null,
        isFailed: false,
        isLoading: false,
        isLoaded: false,
      });
      queueRef.current.unshift(index);
      processQueue();
    },
    [updatePage, processQueue],
  );

  const markLoaded = useCallback(
    (index: number) => {
      const page = stateRef.current[index];
      if (!mountedRef.current || !page || !page.isLoading) return;

      parallelRef.current = Math.max(0, parallelRef.current - 1);
      updatePage(index, { isLoaded: true, isLoading: false });
      processQueue();
    },
    [processQueue, updatePage],
  );

  const markFailed = useCallback(
    (index: number) => {
      const page = stateRef.current[index];
      if (!mountedRef.current || !page || !page.isLoading) return;

      parallelRef.current = Math.max(0, parallelRef.current - 1);
      updatePage(index, { isFailed: true, isLoading: false });
      processQueue();
    },
    [processQueue, updatePage],
  );

  // ── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { pages, retry, markLoaded, markFailed };
}
