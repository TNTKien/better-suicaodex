"use client";

/**
 * `useReaderImages` – tải ảnh reader qua XHR và quản lý blob URLs.
 *
 * Lấy cảm hứng từ weebdex-reader (Svelte):
 * - Tối đa MAX_PARALLEL XHR đồng thời
 * - Hàng đợi ưu tiên: trang hiện tại trước, rồi lan dần ra hai phía
 * - Retry tự động tối đa MAX_ATTEMPTS lần, delay 3 s mỗi lần
 * - Trả về blob URL; giải phóng URL khi unmount
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PageState {
  blob: string | null;    // blob URL khi đã tải xong
  isLoaded: boolean;
  isLoading: boolean;
  isFailed: boolean;
}

const MAX_PARALLEL = 3;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

export function useReaderImages(images: string[], currentIndex: number) {
  const [pages, setPages] = useState<PageState[]>(() =>
    images.map(() => ({ blob: null, isLoaded: false, isLoading: false, isFailed: false })),
  );

  // Ref mirror của state – không cần re-render để đọc
  const stateRef   = useRef<PageState[]>(pages);
  const parallelRef = useRef(0);
  const xhrsRef    = useRef<XMLHttpRequest[]>([]);
  const blobsRef   = useRef<(string | null)[]>(new Array(images.length).fill(null));
  const queueRef   = useRef<number[]>([]);
  const mountedRef = useRef(true);

  // Sync state → ref
  useEffect(() => { stateRef.current = pages; }, [pages]);

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
      const seen  = new Set<number>();
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

  // ── Core loader ──────────────────────────────────────────────────────────

  const processQueue = useCallback(() => {
    while (queueRef.current.length > 0 && parallelRef.current < MAX_PARALLEL) {
      const idx = queueRef.current.shift()!;
      const page = stateRef.current[idx];
      if (!page || page.isLoaded || page.isLoading || page.isFailed) continue;

      parallelRef.current++;
      updatePage(idx, { isLoading: true });

      const load = (attempt: number) => {
        const xhr = new XMLHttpRequest();
        xhrsRef.current.push(xhr);
        xhr.responseType = "blob";
        xhr.open("GET", images[idx]);

        xhr.addEventListener("load", () => {
          xhrsRef.current.splice(xhrsRef.current.indexOf(xhr), 1);
          if (blobsRef.current[idx]) URL.revokeObjectURL(blobsRef.current[idx]!);
          const blobUrl = URL.createObjectURL(xhr.response as Blob);
          blobsRef.current[idx] = blobUrl;
          updatePage(idx, { blob: blobUrl, isLoaded: true, isLoading: false });
          parallelRef.current--;
          processQueue();
        });

        xhr.addEventListener("error", () => {
          xhrsRef.current.splice(xhrsRef.current.indexOf(xhr), 1);
          if (attempt < MAX_ATTEMPTS - 1) {
            setTimeout(() => load(attempt + 1), RETRY_DELAY_MS);
          } else {
            updatePage(idx, { isFailed: true, isLoading: false });
            parallelRef.current--;
            processQueue();
          }
        });

        xhr.send();
      };

      load(0);
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
      if (blobsRef.current[index]) {
        URL.revokeObjectURL(blobsRef.current[index]!);
        blobsRef.current[index] = null;
      }
      updatePage(index, { blob: null, isFailed: false, isLoading: false, isLoaded: false });
      queueRef.current.unshift(index);
      processQueue();
    },
    [updatePage, processQueue],
  );

  // ── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      xhrsRef.current.forEach((xhr) => xhr.abort());
      blobsRef.current.forEach((b) => { if (b) URL.revokeObjectURL(b); });
    };
  }, []);

  return { pages, retry };
}
