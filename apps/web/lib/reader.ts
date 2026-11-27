import { createStore } from "zustand/vanilla"
import {
  clampReaderPage as clampPage,
  readerPageFromHash,
  saveReaderPage as saveCurrentPage,
} from "@workspace/account/reader-position"

export { readerImageSource } from "@workspace/catalog/images"

export type ReaderMode = "classic" | "zen"
type ReaderState = {
  chromeVisible: boolean
  currentPage: number
  limitWidth: boolean
  mode: ReaderMode
  ready: boolean
  sheetOpen: boolean
}

type ReaderStore = ReaderState & {
  hydrate: (chapterId: string, pageCount: number) => number
  setChromeVisible: (visible: boolean) => void
  setCurrentPage: (chapterId: string, pageCount: number, page: number) => void
  setLimitWidth: (limitWidth: boolean) => void
  setMode: (mode: ReaderMode) => void
  setSheetOpen: (open: boolean) => void
  toggleChrome: () => void
}

const preferencesKey = "redive:reader:preferences:v1"
const defaultMode: ReaderMode = "classic"
const initialState: ReaderState = {
  chromeVisible: true,
  currentPage: 0,
  limitWidth: true,
  mode: defaultMode,
  ready: false,
  sheetOpen: false,
}

function readPreferences(
  value: unknown
): Pick<ReaderState, "mode" | "limitWidth"> {
  const stored =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}
  return {
    mode:
      stored.mode === "zen" || stored.mode === "single-page"
        ? "zen"
        : "classic",
    limitWidth:
      typeof stored.limitWidth === "boolean" ? stored.limitWidth : true,
  }
}

function defaultBrowserMode() {
  if (typeof navigator === "undefined") return defaultMode
  return /Mac OS X|iPhone|iPad|iPod/.test(navigator.userAgent)
    ? "classic"
    : "zen"
}

function savePreferences(
  preferences: Pick<ReaderState, "mode" | "limitWidth">
) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(preferencesKey, JSON.stringify(preferences))
  } catch {
    return
  }
}

export function createReaderStore() {
  return createStore<ReaderStore>((set, get) => ({
    ...initialState,
    hydrate: (_chapterId, pageCount) => {
      let currentPage = 0
      let mode = defaultMode
      let limitWidth = true

      if (typeof window !== "undefined") {
        try {
          const preferences = window.localStorage.getItem(preferencesKey)
          const stored = preferences
            ? readPreferences(JSON.parse(preferences))
            : { mode: defaultBrowserMode(), limitWidth: true }
          mode = stored.mode
          limitWidth = stored.limitWidth
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
      set({ currentPage, mode, limitWidth, ready: true })
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
      savePreferences({ mode, limitWidth: get().limitWidth })
    },
    setLimitWidth: (limitWidth) => {
      set({ limitWidth })
      savePreferences({ mode: get().mode, limitWidth })
    },
    setSheetOpen: (sheetOpen) => set({ sheetOpen }),
    toggleChrome: () =>
      set(({ chromeVisible }) => ({ chromeVisible: !chromeVisible })),
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
