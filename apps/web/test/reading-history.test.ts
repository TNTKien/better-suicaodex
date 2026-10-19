import assert from "node:assert/strict"

import {
  createLocalReadingHistoryStore,
  type ReadingHistoryScope,
} from "../modules/reading/local-history"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const storage = new MemoryStorage()
const historyStore = createLocalReadingHistoryStore(storage)
await historyStore.persist.rehydrate()
assert.equal(historyStore.getState().hydrated, true)
const readHistory = (scope: ReadingHistoryScope) =>
  historyStore.getState().getEntries(scope)
const snapshot = {
  manga: {
    id: "manga-a",
    slug: "manga-a",
    title: "Manga A",
    cover: null,
  },
  chapter: {
    id: "chapter-a",
    volume: null,
    number: "1",
    title: null,
    language: "vi",
  },
}

const first = historyStore.getState().recordProgress("guest", {
  chapterId: "chapter-a",
  mangaId: "manga-a",
  readAt: "2026-09-09T00:00:00.000Z",
  snapshot,
})
const second = historyStore.getState().recordProgress("guest", {
  chapterId: "chapter-b",
  mangaId: "manga-b",
  readAt: "2026-09-09T01:00:00.000Z",
  snapshot: {
    ...snapshot,
    manga: { ...snapshot.manga, id: "manga-b" },
    chapter: { ...snapshot.chapter, id: "chapter-b" },
  },
})
assert.deepEqual(
  readHistory("guest").map(({ chapterId }) => chapterId),
  ["chapter-b", "chapter-a"]
)

const newerFirst = historyStore
  .getState()
  .recordProgress("guest", { ...first, readAt: "2026-09-09T02:00:00.000Z" })
historyStore
  .getState()
  .acknowledgeEntries("guest", [first], new Set([first.chapterId]))
assert.equal(readHistory("guest")[0]?.revision, newerFirst.revision)
historyStore
  .getState()
  .acknowledgeEntries(
    "guest",
    [newerFirst, second],
    new Set([newerFirst.chapterId, second.chapterId])
  )
assert.deepEqual(readHistory("guest"), [])

historyStore.getState().recordProgress("account:user-a", {
  chapterId: "chapter-a",
  mangaId: "manga-a",
  readAt: "2026-09-09T03:00:00.000Z",
  snapshot,
})
assert.equal(readHistory("guest").length, 0)
assert.equal(readHistory("account:user-a").length, 1)
assert.equal(readHistory("account:user-b").length, 0)

console.log("Local reading history checks passed")
