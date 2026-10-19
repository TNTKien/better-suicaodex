"use client"

import { compareDesc, isValid, parseISO } from "date-fns"
import { useEffect } from "react"
import { useStore } from "zustand"
import { persist, type PersistStorage } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

export const localReadingHistoryStorageKey = "redive:reading-history:v2"
const maxEntries = 200

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">
type Cover = { url: string; width: number | null; height: number | null } | null

export type LocalReadingSnapshot = {
  manga: {
    id: string
    slug: string
    title: string
    cover: Cover
  }
  chapter: {
    id: string
    volume: string | null
    number: string | null
    title: string | null
    language: string
  }
}

export type LocalReadingHistoryEntry = {
  chapterId: string
  mangaId: string
  readAt?: string
  revision: number
  snapshot: LocalReadingSnapshot | null
}

type StoredHistory = {
  guest: LocalReadingHistoryEntry[]
  accounts: Record<string, LocalReadingHistoryEntry[]>
}

type LocalReadingHistoryStore = StoredHistory & {
  hydrated: boolean
  acknowledgeEntries: (
    scope: ReadingHistoryScope,
    sent: readonly LocalReadingHistoryEntry[],
    acknowledgedChapterIds: ReadonlySet<string>
  ) => void
  getEntries: (scope: ReadingHistoryScope) => LocalReadingHistoryEntry[]
  recordProgress: (
    scope: ReadingHistoryScope,
    input: Omit<LocalReadingHistoryEntry, "revision">
  ) => LocalReadingHistoryEntry
  removeEntry: (scope: ReadingHistoryScope, chapterId: string) => void
}

export type ReadingHistoryScope = "guest" | `account:${string}`

const emptyEntries: LocalReadingHistoryEntry[] = []

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function parseSnapshot(
  value: unknown
): LocalReadingSnapshot | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== "object") return undefined
  const { chapter, manga } = value as Partial<LocalReadingSnapshot>
  if (
    !chapter ||
    !manga ||
    typeof chapter.id !== "string" ||
    typeof chapter.language !== "string" ||
    !isStringOrNull(chapter.volume) ||
    !isStringOrNull(chapter.number) ||
    !isStringOrNull(chapter.title) ||
    typeof manga.id !== "string" ||
    typeof manga.slug !== "string" ||
    typeof manga.title !== "string" ||
    (manga.cover !== null &&
      (typeof manga.cover !== "object" || typeof manga.cover.url !== "string"))
  )
    return undefined
  return {
    manga: {
      id: manga.id,
      slug: manga.slug,
      title: manga.title,
      cover: manga.cover,
    },
    chapter: {
      id: chapter.id,
      volume: chapter.volume,
      number: chapter.number,
      title: chapter.title,
      language: chapter.language,
    },
  }
}

function parseEntry(value: unknown): LocalReadingHistoryEntry | null {
  if (!value || typeof value !== "object") return null
  const entry = value as Partial<LocalReadingHistoryEntry>
  const snapshot = parseSnapshot(entry.snapshot)
  if (
    typeof entry.chapterId !== "string" ||
    typeof entry.mangaId !== "string" ||
    !Number.isInteger(entry.revision) ||
    entry.revision! <= 0 ||
    (entry.readAt !== undefined &&
      (typeof entry.readAt !== "string" || !isValid(parseISO(entry.readAt)))) ||
    snapshot === undefined
  )
    return null
  return {
    chapterId: entry.chapterId,
    mangaId: entry.mangaId,
    ...(entry.readAt ? { readAt: entry.readAt } : {}),
    revision: entry.revision!,
    snapshot,
  }
}

function sortEntries(entries: LocalReadingHistoryEntry[]) {
  return [...entries].sort((left, right) => {
    if (!left.readAt) return right.readAt ? 1 : right.revision - left.revision
    if (!right.readAt) return -1
    return (
      compareDesc(parseISO(left.readAt), parseISO(right.readAt)) ||
      right.revision - left.revision
    )
  })
}

function parseEntries(value: unknown) {
  return Array.isArray(value)
    ? sortEntries(
        value
          .map(parseEntry)
          .filter((entry): entry is LocalReadingHistoryEntry => entry !== null)
      ).slice(0, maxEntries)
    : []
}

function parseStoredHistory(value: unknown): StoredHistory {
  if (!value || typeof value !== "object") return { guest: [], accounts: {} }
  const stored = value as Partial<StoredHistory>
  const accounts =
    stored.accounts && typeof stored.accounts === "object"
      ? Object.fromEntries(
          Object.entries(stored.accounts).map(([userId, entries]) => [
            userId,
            parseEntries(entries),
          ])
        )
      : {}
  return { guest: parseEntries(stored.guest), accounts }
}

function entriesFor(
  store: Pick<StoredHistory, "accounts" | "guest">,
  scope: ReadingHistoryScope
) {
  return scope === "guest"
    ? store.guest
    : (store.accounts[scope.slice("account:".length)] ?? emptyEntries)
}

function entriesPatch(
  store: StoredHistory,
  scope: ReadingHistoryScope,
  entries: LocalReadingHistoryEntry[]
): Partial<StoredHistory> {
  if (scope === "guest") return { guest: entries }
  const userId = scope.slice("account:".length)
  return { accounts: { ...store.accounts, [userId]: entries } }
}

function createPersistStorage(
  resolveStorage: () => StorageLike | null
): PersistStorage<StoredHistory> {
  return {
    getItem: (name) => {
      const storage = resolveStorage()
      if (!storage) return null
      try {
        const parsed = JSON.parse(storage.getItem(name) ?? "null") as unknown
        if (!parsed || typeof parsed !== "object") return null
        const envelope = parsed as { state?: unknown; version?: unknown }
        return {
          state: parseStoredHistory(
            "state" in envelope ? envelope.state : parsed
          ),
          version:
            "state" in envelope && typeof envelope.version === "number"
              ? envelope.version
              : 0,
        }
      } catch {
        return null
      }
    },
    removeItem: (name) => {
      try {
        resolveStorage()?.removeItem(name)
      } catch {
        // Storage may be unavailable in privacy modes.
      }
    },
    setItem: (name, value) => {
      try {
        resolveStorage()?.setItem(name, JSON.stringify(value))
      } catch {
        // Reading remains usable when persistence is unavailable.
      }
    },
  }
}

export function createLocalReadingHistoryStore(storage?: StorageLike) {
  const resolveStorage = () =>
    storage ?? (typeof window === "undefined" ? null : window.localStorage)

  return createStore<LocalReadingHistoryStore>()(
    persist(
      (set, get) => ({
        guest: [],
        accounts: {},
        hydrated: false,
        acknowledgeEntries: (scope, sent, acknowledgedChapterIds) => {
          const sentRevisions = new Map(
            sent.map(({ chapterId, revision }) => [chapterId, revision])
          )
          set((state) =>
            entriesPatch(
              state,
              scope,
              entriesFor(state, scope).filter(
                ({ chapterId, revision }) =>
                  !acknowledgedChapterIds.has(chapterId) ||
                  sentRevisions.get(chapterId) !== revision
              )
            )
          )
        },
        getEntries: (scope) => entriesFor(get(), scope),
        recordProgress: (scope, input) => {
          const entries = get().getEntries(scope)
          const previous = entries.find(
            ({ chapterId }) => chapterId === input.chapterId
          )
          const entry: LocalReadingHistoryEntry = {
            ...input,
            readAt: input.readAt ?? previous?.readAt,
            revision: (previous?.revision ?? 0) + 1,
            snapshot: input.snapshot ?? previous?.snapshot ?? null,
          }
          const next = sortEntries([
            entry,
            ...entries.filter(({ chapterId }) => chapterId !== input.chapterId),
          ]).slice(0, maxEntries)
          set((state) => entriesPatch(state, scope, next))
          return entry
        },
        removeEntry: (scope, chapterId) =>
          set((state) =>
            entriesPatch(
              state,
              scope,
              entriesFor(state, scope).filter(
                (entry) => entry.chapterId !== chapterId
              )
            )
          ),
      }),
      {
        name: localReadingHistoryStorageKey,
        partialize: ({ accounts, guest }) => ({ accounts, guest }),
        merge: (persisted, current) => ({
          ...current,
          ...(persisted ? parseStoredHistory(persisted) : {}),
          hydrated: true,
        }),
        skipHydration: true,
        storage: createPersistStorage(resolveStorage),
      }
    )
  )
}

export const localReadingHistoryStore = createLocalReadingHistoryStore()
let hydration: Promise<void> | null = null

export function rehydrateLocalReadingHistory() {
  hydration = Promise.resolve(localReadingHistoryStore.persist.rehydrate())
    .catch(() => undefined)
    .then(() => undefined)
  return hydration
}

function ensureLocalReadingHistoryHydrated() {
  if (typeof window !== "undefined" && !hydration)
    void rehydrateLocalReadingHistory()
}

export function accountReadingScope(userId: string | null) {
  return userId ? (`account:${userId}` as const) : ("guest" as const)
}

export function readLocalReadingHistory(scope: ReadingHistoryScope) {
  return localReadingHistoryStore.getState().getEntries(scope)
}

export function readLocalReadingEntry(
  scope: ReadingHistoryScope,
  chapterId: string
) {
  return readLocalReadingHistory(scope).find(
    (entry) => entry.chapterId === chapterId
  )
}

export function recordLocalReadingProgress(
  scope: ReadingHistoryScope,
  input: Omit<LocalReadingHistoryEntry, "revision">
) {
  return localReadingHistoryStore.getState().recordProgress(scope, input)
}

export function removeLocalReadingEntry(
  scope: ReadingHistoryScope,
  chapterId: string
) {
  localReadingHistoryStore.getState().removeEntry(scope, chapterId)
}

export function acknowledgeLocalReadingEntries(
  scope: ReadingHistoryScope,
  sent: readonly LocalReadingHistoryEntry[],
  acknowledgedChapterIds: ReadonlySet<string>
) {
  localReadingHistoryStore
    .getState()
    .acknowledgeEntries(scope, sent, acknowledgedChapterIds)
}

export function useLocalReadingHistory(scope: ReadingHistoryScope) {
  useEffect(ensureLocalReadingHistoryHydrated, [])
  return useStore(localReadingHistoryStore, (state) => entriesFor(state, scope))
}

export function useLocalReadingHistoryReady() {
  useEffect(ensureLocalReadingHistoryHydrated, [])
  return useStore(localReadingHistoryStore, (state) => state.hydrated)
}
