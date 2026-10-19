import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import * as React from "react"
import { QueryClient } from "@tanstack/react-query"
import { subMilliseconds } from "date-fns"
import { renderToStaticMarkup } from "react-dom/server"

import type { ChapterSummary } from "../lib/api"

// Isolated hook/UI harness: exercise the real click handler without a browser.
const react = { ...React }
const hooks: unknown[] = []
let cursor = 0
mock.module("react", () => ({
  ...react,
  useState: (initial: unknown) => {
    const index = cursor++
    if (!(index in hooks)) hooks[index] = initial
    return [
      hooks[index],
      (value: unknown) => {
        hooks[index] = value
      },
    ]
  },
  useRef: (initial: unknown) => {
    const index = cursor++
    if (!(index in hooks)) hooks[index] = { current: initial }
    return hooks[index]
  },
}))
const client = new QueryClient()
mock.module("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (options: { queryKey: unknown[] }) => {
    assert.ok(
      !options.queryKey.includes("reading-entry"),
      "Entry queries must not be observed on mount"
    )
    return { data: [] }
  },
  useQueryClient: () => client,
}))
const pushes: string[] = []
mock.module("@bprogress/next/app", () => ({
  useRouter: () => ({ push: (href: string) => pushes.push(href) }),
}))
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl: "https://api.example.test",
    status: "anonymous",
    user: null,
  }),
}))
mock.module("../modules/reading/local-history", () => ({
  accountReadingScope: () => "guest",
  useLocalReadingHistory: () => [
    { mangaId: "manga", chapterId: "native", readAt: "2026-10-01T00:00:00Z" },
  ],
}))
mock.module("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => {
    void _prefetch
    return <a {...props}>{children}</a>
  },
}))
type Click = (event: { currentTarget: HTMLElement }) => Promise<void>
const clicks: Click[] = []
mock.module("@workspace/ui/components/button", () => ({
  buttonVariants: () => "read-button",
  Button: ({
    onClick,
    size: _size,
    children,
    ...props
  }: React.ComponentProps<"button"> & { size?: string }) => {
    void _size
    clicks.push(onClick as unknown as Click)
    return <button {...props}>{children}</button>
  },
}))
let closeDialog: () => void
let returnFocus: React.RefObject<HTMLElement | null>
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
)
mock.module("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
  }) => {
    closeDialog = () => onOpenChange(false)
    return <div role="dialog">{children}</div>
  },
  DialogContent: ({
    children,
    finalFocus,
  }: {
    children: React.ReactNode
    finalFocus: typeof returnFocus
  }) => {
    returnFocus = finalFocus
    return <div>{children}</div>
  },
  DialogHeader: wrapper,
  DialogTitle: wrapper,
  DialogDescription: wrapper,
}))
const notices: { type: string; title: string }[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: { add: (notice: (typeof notices)[number]) => notices.push(notice) },
}))
const { MangaReadActions, mangaReadingEntryOptions } =
  await import("../modules/reading/manga-read-actions")
const originalFetch = globalThis.fetch
const requests: { url: string; init: RequestInit | undefined }[] = []
const native: ChapterSummary = {
  id: "native",
  number: "10",
  title: "Bản gốc",
  volume: null,
  language: "vi",
  isDefault: true,
  pageCount: 1,
  publishedAt: "2026-10-01T00:00:00Z",
  groups: [],
  uploader: { id: "uploader", name: "Người đăng" },
  statistics: { views: 0, comments: 0 },
}
const alternate: ChapterSummary = {
  ...native,
  id: "alternate",
  title: "Bản khác",
  isDefault: false,
}
let result = [native]
let failed = false
let releaseRequest: (() => void) | undefined
globalThis.fetch = async (input, init) => {
  requests.push({ url: String(input), init })
  if (releaseRequest)
    await new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
  return Response.json({ data: result }, { status: failed ? 429 : 200 })
}
function render(hasChapters = true) {
  cursor = 0
  clicks.length = 0
  return renderToStaticMarkup(
    <MangaReadActions
      hasChapters={hasChapters}
      finalChapter="10"
      mangaId="manga"
    />
  )
}
const button = {} as HTMLElement
try {
  const initial = render()
  assert.match(initial, /Đọc từ đầu/)
  assert.match(initial, /Đọc mới nhất/)
  assert.match(initial, /href="\/chapter\/native"/)
  assert.doesNotMatch(initial, /role="dialog"/)
  assert.equal(requests.length, 0, "Render must not load an entry")
  await clicks[0]!({ currentTarget: button })
  assert.deepEqual(pushes, ["/chapter/native"])
  assert.match(requests[0]!.url, /reading-entry\?position=first$/)
  assert.equal(requests[0]!.init?.cache, "no-store")
  assert.equal(requests[0]!.init?.credentials, "omit")

  result = [native, alternate]
  render()
  await clicks[1]!({ currentTarget: button })
  const multiple = render()
  assert.match(multiple, /role="dialog"/)
  assert.match(multiple, /Ch\. 10 - Bản gốc/)
  assert.match(multiple, /Ch\. 10 - Bản khác/)
  assert.match(multiple, /Người đăng/)
  assert.match(multiple, /data-read="true"/)
  assert.match(multiple, /data-read="false"/)
  assert.match(multiple, /aria-label="Tiếng Việt"/)
  assert.equal(
    pushes.length,
    1,
    "Multiple releases must not auto-open the pinned default"
  )
  assert.equal(returnFocus!.current, button)
  closeDialog!()
  assert.doesNotMatch(render(), /role="dialog"/)
  const beforeRepeat = requests.length
  const entryOptions = mangaReadingEntryOptions(
    "https://api.example.test",
    "manga",
    "last"
  )
  assert.equal(entryOptions.staleTime, 60_000)
  assert.equal(entryOptions.gcTime, 5 * 60_000)
  client.setQueryData(entryOptions.queryKey, result, {
    updatedAt: subMilliseconds(Date.now(), 59_000).getTime(),
  })
  await clicks[1]!({ currentTarget: button })
  assert.equal(
    requests.length,
    beforeRepeat,
    "Repeat clicks within one minute reuse the entry"
  )
  render()
  closeDialog!()
  render()

  client.setQueryData(entryOptions.queryKey, result, {
    updatedAt: subMilliseconds(Date.now(), 60_001).getTime(),
  })
  assert.equal(requests.length, beforeRepeat, "Expiry alone must not fetch")
  await clicks[1]!({ currentTarget: button })
  assert.equal(
    requests.length,
    beforeRepeat + 1,
    "Expired entries fetch on click"
  )
  render()
  closeDialog!()
  render()

  await client.invalidateQueries({
    queryKey: mangaReadingEntryOptions(
      "https://api.example.test",
      "manga",
      "first"
    ).queryKey,
  })
  releaseRequest = () => undefined
  const pending = clicks[0]!({ currentTarget: button })
  const busy = render()
  assert.match(busy, /aria-busy="true"/)
  assert.equal([...busy.matchAll(/disabled=""/g)].length, 2)
  const beforeDuplicate = requests.length
  await clicks[1]!({ currentTarget: button })
  assert.equal(
    requests.length,
    beforeDuplicate,
    "Both buttons share an in-flight guard"
  )
  releaseRequest!()
  releaseRequest = undefined
  await pending
  render()
  closeDialog!()
  render()

  await client.invalidateQueries({
    queryKey: mangaReadingEntryOptions(
      "https://api.example.test",
      "manga",
      "first"
    ).queryKey,
  })
  failed = true
  await clicks[0]!({ currentTarget: button })
  assert.equal(notices.at(-1)?.type, "error")
  assert.doesNotMatch(render(), /disabled=""|role="dialog"/)
  failed = false
  result = []
  await clicks[0]!({ currentTarget: button })
  assert.equal(notices.at(-1)?.type, "info")
  assert.equal(pushes.length, 1)
  assert.doesNotMatch(render(false), /<button/)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log("Lazy manga read action checks passed")
