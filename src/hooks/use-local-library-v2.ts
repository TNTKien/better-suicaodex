import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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

const localLibraryV2Atom = atomWithStorage<LocalLibraryV2>(
  STORAGE_KEY,
  {},
  {
    getItem: (key, initialValue) => {
      const stored = localStorage.getItem(key);
      if (!stored) return initialValue;
      try {
        return JSON.parse(stored) as LocalLibraryV2;
      } catch {
        return initialValue;
      }
    },
    setItem: (key, value) => {
      localStorage.setItem(key, JSON.stringify(limitLibrarySize(value)));
    },
    removeItem: (key) => localStorage.removeItem(key),
  },
);

export function useLocalLibraryV2() {
  const [library, setLibrary] = useAtom(localLibraryV2Atom);

  const addToLibrary = (
    mangaId: string,
    category: LocalLibraryCategory,
    meta: MangaLibraryMeta,
  ) => {
    setLibrary((current) => ({
      ...current,
      [mangaId]: { category, meta, addedAt: Date.now() },
    }));
  };

  const removeFromLibrary = (mangaId: string) => {
    setLibrary((current) => {
      const next = { ...current };
      delete next[mangaId];
      return next;
    });
  };

  const getCategoryOfId = (mangaId: string): LocalLibraryCategory | null =>
    library[mangaId]?.category ?? null;

  const getByCategory = (category: LocalLibraryCategory) =>
    Object.entries(library)
      .filter(([, entry]) => entry.category === category)
      .sort((a, b) => b[1].addedAt - a[1].addedAt);

  const clearLibrary = () => setLibrary({});

  return {
    library,
    addToLibrary,
    removeFromLibrary,
    getCategoryOfId,
    getByCategory,
    clearLibrary,
  };
}
