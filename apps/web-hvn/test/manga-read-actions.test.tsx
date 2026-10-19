import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import * as React from "react"
import { QueryClient } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

import type { components } from "../src/lib/generated/api"
type ChapterSummary = components["schemas"]["ChapterSummary"]

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
  useQueryClient: () => client,
}))
const pushes: string[] = []
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => pushes.push(href) }),
}))
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl: "https://api.example.test",
    status: "anonymous",
    user: null,
  }),
}))
mock.module("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    onNavigate: _onNavigate,
    ...props
  }: React.ComponentProps<"a"> & {
    prefetch?: boolean
    onNavigate?: () => void
  }) => {
    void _prefetch
    void _onNavigate
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
    className,
  }: {
    children: React.ReactNode
    finalFocus: typeof returnFocus
    className?: string
  }) => {
    returnFocus = finalFocus
    return <div className={className}>{children}</div>
  },
  DialogHeader: wrapper,
  DialogTitle: wrapper,
  DialogDescription: wrapper,
}))
const notices: { type: string; title: string }[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: { add: (notice: (typeof notices)[number]) => notices.push(notice) },
}))
const { MangaReadActions } =
  await import("../modules/reading/manga-read-actions")
const { mangaReadingEntryOptions } =
  await import("@workspace/account/reading-entry")
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
  groups: [{ id: "group", slug: "group", name: "Nhóm dịch thử" }],
  uploader: { id: "uploader", name: "Người đăng" },
  statistics: { views: 0, comments: 0 },
}
const alternate: ChapterSummary = {
  ...native,
  id: "alternate",
  title: "Bản khác",
  uploader: { id: "hidden", name: "Người đăng B" },
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
  return Response.json({ data: result }, { status: failed ? 503 : 200 })
}
function render(hasChapters = true) {
  cursor = 0
  clicks.length = 0
  return renderToStaticMarkup(
    <MangaReadActions hasChapters={hasChapters} mangaId="manga" />
  )
}
const button = {} as HTMLElement
try {
  const initial = render()
  assert.match(initial, /ĐỌC ONLINE/)
  assert.match(initial, /ĐỌC MỚI NHẤT/)
  assert.equal((initial.match(/doc-online.webp/g) ?? []).length, 2)
  assert.doesNotMatch(initial, /disabled=""|role="dialog"|Đọc tiếp/)
  assert.equal(
    requests.length,
    0,
    "Opening manga details must not fetch reading entries"
  )
  await clicks[0]!({ currentTarget: button })
  assert.deepEqual(pushes, ["/chapter/native"])
  assert.match(requests[0]!.url, /reading-entry\?position=first$/)
  assert.equal(requests[0]!.init?.credentials, "omit")
  assert.equal(requests[0]!.init?.cache, "no-store")
  assert.equal(requests[0]!.init?.redirect, "error")

  result = [native, alternate]
  render()
  await clicks[1]!({ currentTarget: button })
  assert.match(requests.at(-1)!.url, /reading-entry\?position=last$/)
  const multiple = render()
  assert.match(multiple, /role="dialog"/)
  assert.match(multiple, /hvn-reading-dialog/)
  assert.match(multiple, /Đọc mới nhất/)
  assert.match(multiple, /Chap 10: Bản gốc/)
  assert.match(multiple, /Chap 10: Bản khác/)
  assert.match(multiple, /Nhóm dịch thử/)
  assert.match(multiple, /Người đăng B/)
  assert.doesNotMatch(multiple, /data-read|lượt xem|bình luận/)
  for (const id of ["native", "alternate"])
    assert.ok(multiple.includes(`href="/chapter/${id}"`))
  assert.equal(pushes.length, 1, "Several releases require an explicit choice")
  assert.equal(returnFocus!.current, button)
  closeDialog!()
  assert.doesNotMatch(render(), /role="dialog"/)
  const beforeRepeat = requests.length
  await clicks[1]!({ currentTarget: button })
  assert.equal(
    requests.length,
    beforeRepeat,
    "Repeated clicks reuse the same one-minute cache"
  )
  render()
  closeDialog!()
  render()

  const firstKey = mangaReadingEntryOptions(
    "https://api.example.test",
    "manga",
    "first"
  ).queryKey
  await client.invalidateQueries({ queryKey: firstKey })
  releaseRequest = () => undefined
  const pending = clicks[0]!({ currentTarget: button })
  const busy = render()
  assert.match(busy, /aria-busy="true"/)
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 2)
  const beforeDuplicate = requests.length
  await clicks[1]!({ currentTarget: button })
  assert.equal(requests.length, beforeDuplicate)
  releaseRequest!()
  releaseRequest = undefined
  await pending
  render()
  closeDialog!()
  render()

  await client.invalidateQueries({ queryKey: firstKey })
  failed = true
  await clicks[0]!({ currentTarget: button })
  assert.equal(notices.at(-1)?.type, "error")
  assert.doesNotMatch(render(), /disabled=""|role="dialog"/)
  failed = false
  result = []
  await clicks[0]!({ currentTarget: button })
  assert.equal(notices.at(-1)?.type, "info")
  assert.equal(pushes.length, 1)
  const empty = render(false)
  assert.equal((empty.match(/disabled=""/g) ?? []).length, 2)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log(
  "HVN first/last entry buttons, shared cache, release dialog, busy guard and errors passed"
)
