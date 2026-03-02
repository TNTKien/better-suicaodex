import { createLoader, parseAsStringLiteral } from "nuqs/server";

export const LIBRARY_STORAGE_OPTIONS = ["local", "cloud"] as const;
export const LIBRARY_TAB_OPTIONS = [
  "following",
  "reading",
  "plan",
  "completed",
] as const;

export type LibraryStorage = (typeof LIBRARY_STORAGE_OPTIONS)[number];
export type LibraryTab = (typeof LIBRARY_TAB_OPTIONS)[number];

export const librarySearchParams = {
  storage: parseAsStringLiteral(LIBRARY_STORAGE_OPTIONS).withDefault("local"),
  tab: parseAsStringLiteral(LIBRARY_TAB_OPTIONS).withDefault("following"),
};

export const loadLibrarySearchParams = createLoader(librarySearchParams);
