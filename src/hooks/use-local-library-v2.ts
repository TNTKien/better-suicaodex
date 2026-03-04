import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createMigratingStorage } from "@/lib/zustand-migrate-storage";

export type LocalLibraryCategory = "following" | "plan" | "reading" | "completed";

export type MangaLibraryMeta = {
  title: string;
  coverId: string | null;
};

export type MangaLibraryEntry = {
  category: LocalLibraryCategory;
  meta: MangaLibraryMeta;
  addedAt: number;
};

export type LocalLibraryV2 = Record<string, MangaLibraryEntry>;

const STORAGE_KEY = "local-library-v2";
const MAX_ITEMS = 500;

function limitLibrarySize(library: LocalLibraryV2): LocalLibraryV2 {
  const entries = Object.entries(library);
  if (entries.length <= MAX_ITEMS) return library;
  // keep the most recently added entries
  const sorted = entries.sort((a, b) => b[1].addedAt - a[1].addedAt);
  return Object.fromEntries(sorted.slice(0, MAX_ITEMS));
}

const useLocalLibraryV2Store = create<LocalLibraryV2>()(
  persist(
    () => ({} as LocalLibraryV2),
    {
      name: STORAGE_KEY,
      storage: createMigratingStorage<LocalLibraryV2>(),
    },
  ),
);

const setLibrary = useLocalLibraryV2Store.setState;

export function useLocalLibraryV2() {
  const library = useLocalLibraryV2Store();

  const addToLibrary = (
    mangaId: string,
    category: LocalLibraryCategory,
    meta: MangaLibraryMeta,
  ) => {
    setLibrary(
      (current) => limitLibrarySize({ ...current, [mangaId]: { category, meta, addedAt: Date.now() } }),
      true,
    );
  };

  const removeFromLibrary = (mangaId: string) => {
    setLibrary((current) => {
      const next = { ...current };
      delete next[mangaId];
      return next;
    }, true);
  };

  const getCategoryOfId = (mangaId: string): LocalLibraryCategory | null =>
    library[mangaId]?.category ?? null;

  const getByCategory = (category: LocalLibraryCategory) =>
    Object.entries(library)
      .filter(([, entry]) => entry.category === category)
      .sort((a, b) => b[1].addedAt - a[1].addedAt);

  const clearLibrary = () => setLibrary({} as LocalLibraryV2, true);

  return {
    library,
    addToLibrary,
    removeFromLibrary,
    getCategoryOfId,
    getByCategory,
    clearLibrary,
  };
}
