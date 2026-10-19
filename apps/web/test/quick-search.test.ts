import assert from "node:assert/strict"
import type { KeyboardEvent } from "react"
import { handleSearchKeys } from "@workspace/catalog/search"
import {
  onlineManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query"

import {
  MangaSearchError,
  mangaSearchOptions,
  normalizeSearchQuery,
} from "../modules/manga/search"

const origin = "https://api.example.test"
const client = new QueryClient()
const originalFetch = globalThis.fetch
const result = {
  data: [],
  meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
}

// Exercise keyboard behavior without a browser or DOM test dependency.
const originalElement = globalThis.HTMLElement
let focused = ""
let opened = ""
class SearchElement {
  constructor(readonly id: string) {}
  focus() {
    focused = this.id
  }
  blur() {
    focused = ""
  }
  click() {
    opened = this.id
  }
}
globalThis.HTMLElement = SearchElement as unknown as typeof HTMLElement
const input = new SearchElement("input")
const links = [new SearchElement("first"), new SearchElement("second")]
const press = (key: string, target: SearchElement, composing = false) => {
  let prevented = false
  handleSearchKeys({
    key,
    target,
    nativeEvent: { isComposing: composing },
    currentTarget: {
      querySelector: () => input,
      querySelectorAll: () => links,
    },
    preventDefault: () => {
      prevented = true
    },
  } as unknown as KeyboardEvent<HTMLElement>)
  return prevented
}
try {
  assert.equal(press("ArrowDown", input), true)
  assert.equal(focused, "first")
  press("ArrowDown", links[0]!)
  assert.equal(focused, "second")
  press("ArrowDown", links[1]!)
  assert.equal(focused, "second")
  press("ArrowUp", links[1]!)
  assert.equal(focused, "first")
  press("ArrowUp", links[0]!)
  assert.equal(focused, "input")
  assert.equal(press("Enter", input, true), false)
  assert.equal(opened, "")
  assert.equal(press("Enter", input), true)
  assert.equal(opened, "first")
  input.focus()
  press("Escape", input)
  assert.equal(focused, "")
} finally {
  globalThis.HTMLElement = originalElement
}

try {
  assert.equal(normalizeSearchQuery("  BÍ   MẬT  "), "bí mật")
  assert.equal(mangaSearchOptions(origin, " ").enabled, false)
  assert.equal(mangaSearchOptions(origin, "x".repeat(161)).enabled, false)
  assert.notDeepEqual(
    mangaSearchOptions(origin, "test").queryKey,
    mangaSearchOptions("https://other.example.test", "test").queryKey
  )

  let requests = 0
  globalThis.fetch = (async (input, init) => {
    requests++
    const url = new URL(String(input))
    assert.equal(url.origin, origin)
    assert.equal(url.pathname, "/v1/manga")
    assert.equal(url.searchParams.get("q"), "bí mật & mùa hè")
    assert.equal(url.searchParams.get("limit"), "5")
    assert.equal(init?.credentials, "omit")
    assert.ok(init?.signal instanceof AbortSignal)
    return Response.json(result)
  }) as typeof fetch

  assert.deepEqual(
    await client.fetchQuery(mangaSearchOptions(origin, "BÍ MẬT & Mùa Hè")),
    result
  )
  await client.fetchQuery(mangaSearchOptions(origin, "  bí  mật & mùa hè  "))
  assert.equal(requests, 1, "Equivalent queries reuse the cached response")

  globalThis.fetch = (async () =>
    Response.json(
      { error: { code: "RATE_LIMITED" } },
      { status: 429 }
    )) as typeof fetch
  await assert.rejects(
    client.fetchQuery(mangaSearchOptions(origin, "rate limited")),
    (error: unknown) =>
      error instanceof MangaSearchError &&
      error.status === 429 &&
      error.code === "RATE_LIMITED"
  )
  globalThis.fetch = (async () => new Response("not json")) as typeof fetch
  await assert.rejects(
    client.fetchQuery(mangaSearchOptions(origin, "invalid")),
    (error: unknown) =>
      error instanceof MangaSearchError && error.code === "INVALID_RESPONSE"
  )

  // Changing/clearing the input must abort the old fetch before a new debounce ends.
  let started!: (signal: AbortSignal) => void
  const pending = new Promise<AbortSignal>((resolve) => {
    started = resolve
  })
  globalThis.fetch = (async (_input, init) => {
    const signal = init!.signal!
    started(signal)
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      })
    })
  }) as typeof fetch
  const observer = new QueryObserver(client, mangaSearchOptions(origin, "old"))
  const unsubscribe = observer.subscribe(() => {})
  const signal = await pending
  observer.setOptions({ ...mangaSearchOptions(origin, "new"), enabled: false })
  assert.equal(signal.aborted, true)
  assert.equal(
    observer.getCurrentResult().data,
    undefined,
    "Never show the previous query's results"
  )
  observer.setOptions(mangaSearchOptions(origin, ""))
  assert.equal(observer.getCurrentResult().fetchStatus, "idle")
  unsubscribe()

  onlineManager.setOnline(false)
  const offline = new QueryObserver(
    client,
    mangaSearchOptions(origin, "offline")
  )
  const unsubscribeOffline = offline.subscribe(() => {})
  assert.equal(
    offline.getCurrentResult().isPaused,
    true,
    "An uncached offline query exposes a paused state instead of loading forever"
  )
  unsubscribeOffline()
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  onlineManager.setOnline(true)
}

console.log("Quick search checks passed")
