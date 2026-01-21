"use client";

import { create } from "zustand";
import type { StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ReaderDirection = "scroll" | "ltr" | "rtl";
export type ReaderScale =
  | "original"
  | "limit"
  | "limit-width"
  | "limit-height"
  | "stretch"
  | "stretch-width"
  | "stretch-height";
export type PanelPosition = "left" | "right";

export type ReaderConfig = {
  direction: ReaderDirection;
  scale: ReaderScale;
  maxWidthPercent: number;
  gaps: number;
  doublePage: boolean;
  spreadOffset: number;
  panelOpen: boolean;
  panelPosition: PanelPosition;
  pageIndicator: boolean;
  scrollSpeed: number;
  verticalClickNavigation: boolean;
  scrollNavigation: boolean;
  verticalKeyboardNavigation: boolean;
  chapterNavigation: boolean;
  headerVisible: boolean;
};

export type ReaderConfigState = ReaderConfig & {
  setConfig: (partial: Partial<ReaderConfig>) => void;
  resetConfig: () => void;
};

const defaultReaderConfig: ReaderConfig = {
  direction: "scroll",
  scale: "limit-width",
  maxWidthPercent: 100,
  gaps: 10,
  doublePage: false,
  spreadOffset: 0,
  panelOpen: true,
  panelPosition: "left",
  pageIndicator: true,
  scrollSpeed: 40,
  verticalClickNavigation: true,
  scrollNavigation: true,
  verticalKeyboardNavigation: true,
  chapterNavigation: true,
  headerVisible: false,
};

const createReaderConfig: StateCreator<ReaderConfigState> = (set) => ({
  ...defaultReaderConfig,
  setConfig: (partial) => set((state) => ({ ...state, ...partial })),
  resetConfig: () => set(defaultReaderConfig),
});

export const useReaderConfig = create<ReaderConfigState>()(
  persist(createReaderConfig, {
    name: "reader-config",
    storage: createJSONStorage(() => localStorage),
  })
);
