import { createStore } from "zustand/vanilla"
import {
  clampReaderPage as clampPage,
  readerPageFromHash,
  saveReaderPage as saveCurrentPage,
} from "@workspace/account/reader-position"

import type { components } from "@/src/lib/generated/api"

type ChapterList = components["schemas"]["ChapterList"]

export { readerImageSource } from "@workspace/catalog/images"

export type ReaderMode = "classic" | "zen"
type ReaderState = {
  chapterError: string
  chapters: ChapterList | null
  chromeVisible: boolean
  currentPage: number
  mode: ReaderMode
  ready: boolean
  sheetOpen: boolean
}

type ReaderRequestState = Pick<ReaderState, "chapterError" | "chapters">

type ReaderStore = ReaderState & {
  hydrate: (chapterId: string, pageCount: number) => number
  setChromeVisible: (visible: boolean) => void
  setCurrentPage: (chapterId: string, pageCount: number, page: number) => void
  setMode: (mode: ReaderMode) => void
  setSheetOpen: (open: boolean) => void
  toggleChrome: () => void
  updateRequestState: (state: Partial<ReaderRequestState>) => void
}

const preferencesKey = "redive:reader:preferences:v1"
const defaultMode: ReaderMode = "classic"
const initialState: ReaderState = {
  chapterError: "",
  chapters: null,
  chromeVisible: true,
  currentPage: 0,
  mode: defaultMode,
  ready: false,
  sheetOpen: false,
}

function readPreferences(value: unknown) {
  const stored =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}
  if (stored.mode === "zen" || stored.mode === "single-page") return "zen"
  return "classic"
}

function defaultBrowserMode() {
  if (typeof navigator === "undefined") return defaultMode
  return /Mac OS X|iPhone|iPad|iPod/.test(navigator.userAgent)
    ? "classic"
    : "zen"
}

function saveMode(mode: ReaderMode) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(preferencesKey, JSON.stringify({ mode }))
  } catch {
    return
  }
}

export function createReaderStore() {
  return createStore<ReaderStore>((set) => ({
    ...initialState,
    hydrate: (_chapterId, pageCount) => {
      let currentPage = 0
      let mode = defaultMode

      if (typeof window !== "undefined") {
        try {
          const preferences = window.localStorage.getItem(preferencesKey)
          mode = preferences
            ? readPreferences(JSON.parse(preferences))
            : defaultBrowserMode()
          currentPage = readerPageFromHash(window.location.hash, pageCount)
        } catch {
          try {
            window.localStorage.removeItem(preferencesKey)
          } catch {
            // localStorage can be unavailable in privacy modes.
          }
        }
      }

      currentPage = clampPage(currentPage, pageCount)
      set({ currentPage, mode, ready: true })
      saveCurrentPage(pageCount, currentPage)
      return currentPage
    },
    setChromeVisible: (chromeVisible) => set({ chromeVisible }),
    setCurrentPage: (_chapterId, pageCount, page) => {
      const currentPage = clampPage(page, pageCount)
      set({ currentPage })
      saveCurrentPage(pageCount, currentPage)
    },
    setMode: (mode) => {
      set({ mode })
      saveMode(mode)
    },
    setSheetOpen: (sheetOpen) => set({ sheetOpen }),
    toggleChrome: () =>
      set(({ chromeVisible }) => ({ chromeVisible: !chromeVisible })),
    updateRequestState: (state) => set(state),
  }))
}

export function zenPreloadIndexes(pageCount: number, currentPage: number) {
  return [currentPage + 1, currentPage + 2, currentPage - 1].filter(
    (index) => index >= 0 && index < pageCount
  )
}

export function resolveReaderMode(mode: ReaderMode, isLongStrip: boolean) {
  return isLongStrip ? "classic" : mode
}

export function zenPageWidth(width: number, height: number) {
  if (width <= height) return undefined
  const viewportHeight = Number(((width / height) * 100).toFixed(4))
  return `min(100vw, ${viewportHeight}dvh)`
}

export function closestReaderPanelIndex(
  panels: ReadonlyArray<{ left: number; width: number }>,
  viewportCenter: number
) {
  let closest = -1
  let distance = Number.POSITIVE_INFINITY
  panels.forEach((panel, index) => {
    const nextDistance = Math.abs(panel.left + panel.width / 2 - viewportCenter)
    if (nextDistance < distance) {
      closest = index
      distance = nextDistance
    }
  })
  return closest
}
