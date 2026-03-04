import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ChapterHistoryEntry = {
  chapterId: string;
  chapter: string | null;  // chapter number e.g. "66", "0.1", null for oneshot
  title: string | null;    // chapter title
  language: string | null; // "vi" | "en" etc.
  groups: { id: string; name: string }[];
  readAt: string;          // ISO timestamp
};

/** Cached manga display metadata stored alongside chapters. */
export type MangaMeta = {
  title: string;
  coverId: string | null; // cover.id used to build /covers/{mangaId}/{coverId}.256.webp
};

export type MangaHistoryRecord = {
  meta: MangaMeta;
  chapters: ChapterHistoryEntry[];
};

/** key = mangaId */
export type HistoryV2 = Record<string, MangaHistoryRecord>;

const STORAGE_KEY = "reading_history_v3";
const MAX_MANGA = 200;
const MAX_CHAPTERS_PER_MANGA = 20;

const useReadingHistoryV2Store = create<HistoryV2>()(
  persist(
    () => ({} as HistoryV2),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

const setHistory = useReadingHistoryV2Store.setState;

/**
 * Add or update a chapter entry for a manga.
 * - `meta` is saved/updated whenever provided (title + coverId from manga fetch).
 * - If chapterId already exists it is moved to front (re-read).
 * - Trims per-manga list to MAX_CHAPTERS_PER_MANGA.
 * - Trims oldest manga when total exceeds MAX_MANGA.
 */
export const addHistory = (mangaId: string, entry: ChapterHistoryEntry, meta?: MangaMeta) => {
  setHistory((prev) => {
    const existing = prev[mangaId];
    const existingChapters = existing?.chapters ?? [];

    const filtered = existingChapters.filter(
      (e) => e.chapterId !== entry.chapterId
    );
    const updatedChapters = [entry, ...filtered].slice(0, MAX_CHAPTERS_PER_MANGA);

    const updatedMeta: MangaMeta =
      meta ?? existing?.meta ?? { title: mangaId, coverId: null };

    const next: HistoryV2 = {
      ...prev,
      [mangaId]: { meta: updatedMeta, chapters: updatedChapters },
    };

    const mangaIds = Object.keys(next);
    if (mangaIds.length > MAX_MANGA) {
      const sorted = mangaIds.sort((a, b) => {
        const aTime = next[a]?.chapters[0]?.readAt ?? "";
        const bTime = next[b]?.chapters[0]?.readAt ?? "";
        return aTime < bTime ? -1 : 1;
      });
      const toRemove = sorted.slice(0, mangaIds.length - MAX_MANGA);
      toRemove.forEach((id) => delete next[id]);
    }

    return next;
  }, true);
};

/** Remove all history entries for a manga. */
export const removeHistory = (mangaId: string) => {
  setHistory((prev) => {
    const next = { ...prev };
    delete next[mangaId];
    return next;
  }, true);
};

/** Clear all history. */
export const clearHistory = () => setHistory({} as HistoryV2, true);

export default function useReadingHistoryV2() {
  const history = useReadingHistoryV2Store();

  /**
   * Sorted entries: [mangaId, MangaHistoryRecord][] DESC by chapters[0].readAt
   * (most recently read manga first)
   */
  const sortedEntries = useMemo((): [string, MangaHistoryRecord][] => {
    return Object.entries(history).sort(([, a], [, b]) => {
      const aTime = a.chapters[0]?.readAt ?? "";
      const bTime = b.chapters[0]?.readAt ?? "";
      return bTime > aTime ? 1 : -1;
    });
  }, [history]);

  return {
    history,
    sortedEntries,
    addHistory,
    removeHistory,
    clearHistory,
  };
}
