import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────────────────────────
/** Chế độ đọc */
export type ReaderMode =
  | "long-strip"   // Cuộn dọc (webtoon)
  | "single"       // Từng trang - LTR
  | "single-rtl"   // Từng trang - RTL (manga Nhật)
  | "double";      // 2 trang cạnh nhau - LTR

/** Tỉ lệ hiển thị ảnh - tương đương ReaderScale của weebdex */
export type ImageScale =
  | "original"      // Kích thước gốc
  | "limit-all"     // Vừa màn hình (max-w + max-h)
  | "limit-width"   // Vừa chiều ngang
  | "limit-height"  // Vừa chiều dọc
  | "stretch-width" // Kéo giãn theo chiều ngang
  | "stretch-height"; // Kéo giãn theo chiều dọc

// ── Helper ─────────────────────────────────────────────────────────────────
/** Trả về Tailwind classes cho <img> tương ứng với scale đang chọn */
export function getImageScaleClasses(scale: ImageScale): string {
  switch (scale) {
    case "original":      return "w-auto h-auto";
    case "limit-all":     return "w-auto h-auto max-w-full max-h-dvh";
    case "limit-width":   return "h-auto max-w-full";
    case "limit-height":  return "w-auto max-h-dvh";
    case "stretch-width": return "w-full h-auto";
    case "stretch-height":return "w-auto h-dvh";
  }
}

/** Labels tiếng Việt cho từng scale */
export const IMAGE_SCALE_LABELS: Record<ImageScale, string> = {
  "original":      "Kích thước gốc",
  "limit-all":     "Vừa màn hình",
  "limit-width":   "Vừa chiều ngang",
  "limit-height":  "Vừa chiều dọc",
  "stretch-width": "Kéo giãn ngang",
  "stretch-height":"Kéo giãn dọc",
};

/** Labels tiếng Việt cho từng mode */
export const READER_MODE_LABELS: Record<ReaderMode, string> = {
  "long-strip":  "Cuộn dọc",
  "single":      "Từng trang (LTR)",
  "single-rtl":  "Từng trang (RTL)",
  "double":      "2 trang",
};

// ── Store ──────────────────────────────────────────────────────────────────
interface ReaderState {
  mode: ReaderMode;
  scale: ImageScale;
  imageGap: number;    // khoảng cách (px) giữa ảnh trong long-strip
  header: boolean;     // hiện/ẩn header bar
  spreadOffset: number; // offset cho chế độ 2 trang (0-3)
}

interface ReaderActions {
  setMode: (mode: ReaderMode) => void;
  setScale: (scale: ImageScale) => void;
  setImageGap: (gap: number) => void;
  setHeader: (header: boolean) => void;
  setSpreadOffset: (offset: number) => void;
}

const DEFAULT_STATE: ReaderState = {
  mode: "long-strip",
  scale: "limit-width",
  imageGap: 4,
  header: false,
  spreadOffset: 0,
};

export const useReaderStore = create<ReaderState & ReaderActions>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      setMode:         (mode)   => set({ mode }),
      setScale:        (scale)  => set({ scale }),
      setImageGap:     (gap)    => set({ imageGap: gap }),
      setHeader:       (header) => set({ header }),
      setSpreadOffset: (offset) => set({ spreadOffset: offset }),
    }),
    { name: "reader-config" },
  ),
);
