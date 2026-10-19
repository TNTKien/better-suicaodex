import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient } from "@tanstack/react-query"
import {
  chapter as fixture,
  release,
  importedRelease,
  boundary,
  needsChoice,
  type ChapterDetail,
  type ChapterSummary,
} from "./fixtures/reader"

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
        hooks[index] = typeof value === "function" ? value(hooks[index]) : value
      },
    ]
  },
  useRef: (initial: unknown) => {
    const index = cursor++
    if (!(index in hooks)) hooks[index] = { current: initial }
    return hooks[index]
  },
  useEffect: () => undefined,
}))
type ChapterList = {
  data: ChapterSummary[]
  meta: { page: number; totalPages: number }
}
type ListOptions = {
  enabled: boolean
  queryFn: (context: {
    pageParam: number
    signal: AbortSignal
  }) => Promise<ChapterList>
  getNextPageParam: (page: ChapterList) => number | undefined
}
const client = new QueryClient()
let listOptions: ListOptions
let pages: ChapterList[] = []
let listError: Error | null = null
let fetchingNext = false
let nextPageRequests = 0
mock.module("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => client,
  useInfiniteQuery: (options: ListOptions) => {
    listOptions = options
    return {
      data: pages.length ? { pages } : undefined,
      isPending: !pages.length && !listError,
      isError: Boolean(listError),
      error: listError,
      hasNextPage: pages.length
        ? options.getNextPageParam(pages.at(-1)!) !== undefined
        : false,
      isFetchingNextPage: fetchingNext,
      fetchNextPage: async () => {
        nextPageRequests++
      },
      refetch: async () => {
        listError = null
      },
    }
  },
}))
let status = "guest"
const pushes: string[] = []
let flushes = 0
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => pushes.push(href) }),
}))
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl: "https://api.example.test",
    status,
    user: status === "authenticated" ? { id: "reader" } : null,
  }),
}))
let progressInput: {
  chapter: ChapterDetail
  userId: string | null
  status: string
}
mock.module("@workspace/account/reader-progress", () => ({
  useReaderProgress: (props: typeof progressInput) => {
    progressInput = props
    return {
      flush: () => {
        flushes++
      },
    }
  },
}))
let viewInput: { mode: string; chapterId: string; pageCount: number }
mock.module("@workspace/account/chapter-view", () => ({
  useChapterView: (props: typeof viewInput) => {
    viewInput = props
  },
}))
mock.module("../modules/comments/lazy-comment-section", () => ({
  LazyCommentSection: ({
    scope,
    targetId,
  }: {
    scope: string
    targetId: string
  }) => <div data-lazy-comments={targetId} data-scope={scope} />,
}))
type ButtonProps = React.ComponentProps<"button">
const controls: ButtonProps[] = []
mock.module("@workspace/ui/components/button", () => ({
  Button: (props: ButtonProps) => {
    controls.push(props)
    return <button {...props} />
  },
}))
type LinkProps = React.ComponentProps<"a"> & {
  prefetch?: boolean
  onNavigate?: () => void
}
const links: LinkProps[] = []
mock.module("next/link", () => ({
  default: ({ prefetch, onNavigate, ...props }: LinkProps) => {
    links.push({ ...props, prefetch, onNavigate })
    return <a {...props} />
  },
}))
type ImageProps = React.ComponentProps<"img"> & {
  eager?: boolean
  fallbackSrc?: string | null
  fallbackTimeoutMs?: number
  priority?: string
  fadeIn?: boolean
  retry?: boolean
  showSpinner?: boolean
}
const images: ImageProps[] = []
mock.module("@workspace/ui/components/asset-image", () => ({
  AssetImage: (props: ImageProps) => {
    images.push(props)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Test double captures the real asset loader props.
      <img
        alt={props.alt}
        src={props.src}
        width={props.width}
        height={props.height}
        loading={props.loading}
      />
    )
  },
}))
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
)
let closeDialog: () => void
let finalFocus: React.RefObject<HTMLElement | null>
mock.module("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => {
    if (!open) return null
    closeDialog = () => onOpenChange(false)
    return <div role="dialog">{children}</div>
  },
  DialogContent: ({
    children,
    finalFocus: focus,
  }: {
    children: React.ReactNode
    finalFocus: typeof finalFocus
  }) => {
    finalFocus = focus
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
const { Reader } = await import("../modules/reading/reader")
let chapter = fixture
const releases = [release, importedRelease]
const originalFetch = globalThis.fetch
const requests: { url: URL; init?: RequestInit }[] = []
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  requests.push({ url, init })
  if (url.pathname.endsWith("navigation-releases"))
    return Response.json({ data: releases })
  assert.match(url.pathname, /manga\/.*\/chapters$/)
  assert.equal(url.searchParams.get("limit"), "100")
  return Response.json({
    data: [release, { ...importedRelease, volume: null }],
    meta: { page: Number(url.searchParams.get("page")), totalPages: 2 },
  })
}
const trigger = {} as HTMLElement
function render(statistics = { follows: 203, comments: 134 }) {
  cursor = 0
  controls.length = 0
  links.length = 0
  images.length = 0
  return renderToStaticMarkup(
    <Reader chapter={chapter} statistics={statistics} />
  )
}
function click(label: string) {
  const control = controls.find(
    (button) =>
      button["aria-label"] === label ||
      button.children === label ||
      (Array.isArray(button.children) && button.children.includes(label))
  )
  assert.ok(control, `Missing ${label}`)
  control.onClick!({
    currentTarget: trigger,
  } as React.MouseEvent<HTMLButtonElement>)
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
try {
  const initial = render()
  assert.match(initial, /Trang chủ/)
  assert.match(initial, /Danh sách/)
  assert.match(initial, /Xem thông tin:/)
  assert.match(initial, /Truyện đọc/)
  assert.match(initial, /Chap 10: Chương hiện tại/)
  assert.equal((initial.match(/aria-label="Chuyển chương"/g) ?? []).length, 2)
  assert.equal(
    images.filter((image) => image.src === "/brand/prev.webp").length,
    2
  )
  assert.equal(
    images.filter((image) => image.src === "/brand/next.webp").length,
    2
  )
  assert.match(initial, /like.webp/)
  assert.match(initial, /dis.webp/)
  assert.match(initial, /203/)
  assert.match(initial, /134/)
  assert.match(initial, /Đăng nhập/)
  assert.match(initial, /data-lazy-comments=/)
  assert.match(initial, /data-scope="chapter"/)
  assert.doesNotMatch(initial, /role="dialog"|Classic UI|Zen UI|drawer/)
  assert.equal(
    requests.length,
    0,
    "Initial render must not fetch navigation, picker or comments"
  )
  assert.equal(listOptions!.enabled, false)
  assert.equal(progressInput!.userId, null)
  assert.equal(viewInput!.mode, "classic")
  assert.equal(viewInput!.pageCount, 3)
  assert.equal(
    controls.find((button) => button["aria-label"] === "Chương trước")
      ?.disabled,
    true
  )
  assert.equal(
    controls.find((button) => button["aria-label"] === "Chương sau")?.disabled,
    false
  )
  const pageImages = images.filter((image) => image.alt?.startsWith("Trang "))
  assert.equal(pageImages.length, 3)
  assert.equal(pageImages[0]!.src, "https://images.test/1.webp")
  assert.equal(pageImages[0]!.fallbackSrc, "https://images.test/1.jpg")
  assert.equal(pageImages[0]!.width, 700)
  assert.equal(pageImages[0]!.loading, "eager")
  assert.equal(pageImages[0]!.priority, "high")
  assert.equal(pageImages[1]!.src, "https://replica.test/2.webp")
  assert.equal(pageImages[1]!.fallbackTimeoutMs, 15_000)
  assert.equal(pageImages[2]!.loading, "lazy")
  for (const label of ["Server 1", "Server 2", "Server Full HD", "Báo lỗi"]) {
    const button = controls.find((item) => item.children === label)!
    assert.equal(button.onClick, undefined)
    assert.equal(button["aria-disabled"], "true")
  }
  click("Chương sau")
  await tick()
  assert.match(render(), /role="dialog"/)
  assert.equal(pushes.length, 0, "Source changes require explicit selection")
  assert.equal(flushes, 0)
  assert.equal(finalFocus!.current, trigger)
  assert.match(requests[0]!.url.href, /navigation-releases\?direction=next$/)
  assert.equal(requests[0]!.init?.credentials, "omit")
  links.find((link) => link.href === "/chapter/imported")!.onNavigate!()
  assert.equal(flushes, 1)
  assert.doesNotMatch(render(), /role="dialog"/)
  click("Chương sau")
  await tick()
  render()
  closeDialog!()
  render()
  assert.equal(
    requests.length,
    1,
    "Adjacent choices reuse ReDive's one-minute cache"
  )
  chapter = {
    ...chapter,
    navigation: {
      ...chapter.navigation,
      next: { state: "ready", selectedChapterId: "ready", options: [release] },
    },
  }
  render()
  click("Chương sau")
  assert.deepEqual(pushes, ["/chapter/ready"])
  assert.equal(flushes, 2)

  const picker = controls.find(
    (button) => button["aria-haspopup"] === "dialog"
  )!
  picker.onClick!({
    currentTarget: trigger,
  } as React.MouseEvent<HTMLButtonElement>)
  assert.match(render(), /Đang tải danh sách chương/)
  assert.equal(listOptions!.enabled, true)
  assert.equal(finalFocus!.current, trigger)
  const first = await listOptions!.queryFn({
    pageParam: 1,
    signal: new AbortController().signal,
  })
  pages = [first]
  assert.equal(listOptions!.getNextPageParam(first), 2)
  const pickerHtml = render()
  assert.match(pickerHtml, /Volume 2/)
  assert.match(pickerHtml, /No Volume/)
  assert.match(pickerHtml, /Bản gốc/)
  assert.match(pickerHtml, /Bản nhập/)
  click("Tải thêm")
  assert.equal(nextPageRequests, 1)
  fetchingNext = true
  render()
  assert.equal(
    controls.find(
      (button) =>
        button.children instanceof Array && button.children.includes("Tải thêm")
    )?.disabled,
    true
  )
  fetchingNext = false
  const second = await listOptions!.queryFn({
    pageParam: 2,
    signal: new AbortController().signal,
  })
  assert.equal(listOptions!.getNextPageParam(second), undefined)
  assert.equal(requests.at(-1)!.url.searchParams.get("page"), "2")
  render()
  controls.find((button) => button.title?.includes("Bản nhập"))!.onClick!({
    currentTarget: trigger,
  } as React.MouseEvent<HTMLButtonElement>)
  assert.equal(pushes.at(-1), "/chapter/imported")
  assert.equal(listOptions!.enabled, true)
  render()
  assert.equal(listOptions!.enabled, false)
  listError = new Error("Không thể tải chương")
  controls.find((button) => button["aria-haspopup"] === "dialog")!.onClick!({
    currentTarget: trigger,
  } as React.MouseEvent<HTMLButtonElement>)
  assert.match(render(), /Không thể tải chương/)
  click("Thử lại")
  assert.equal(listError, null)
  closeDialog!()
  status = "authenticated"
  chapter = {
    ...chapter,
    pages: [],
    navigation: {
      ...chapter.navigation,
      previous: boundary,
      next: needsChoice,
    },
  }
  const empty = render({ follows: 0, comments: 0 })
  assert.match(empty, /Chapter chưa có trang ảnh/)
  assert.doesNotMatch(empty, /Đăng nhập/)
  assert.equal(progressInput!.userId, "reader")
  assert.equal(viewInput!.pageCount, 0)
  assert.ok(requests.every(({ url }) => !url.pathname.includes("comments")))
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log(
  "HVN vertical reader, adjacent release selection, chapter picker, images and history wiring checks passed"
)
