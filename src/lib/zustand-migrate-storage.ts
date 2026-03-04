import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Tạo storage có khả năng migrate từ format Jotai cũ sang Zustand mới.
 *
 * - Jotai `atomWithStorage` lưu trực tiếp: `{"theme":"doom",...}`
 * - Zustand `persist` lưu có wrapper: `{"state":{...},"version":0}`
 *
 * Khi phát hiện format cũ (không có key `state`), tự động wrap lại để
 * Zustand có thể đọc được, tránh reset dữ liệu của người dùng.
 */
export function createMigratingStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name): StorageValue<T> | null => {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        // Format Jotai: plain object, không có wrapper { state, version }
        if (!("state" in parsed)) {
          return { state: parsed as T, version: 0 };
        }
        return parsed as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      localStorage.setItem(name, JSON.stringify(value));
    },
    removeItem: (name) => {
      localStorage.removeItem(name);
    },
  };
}
