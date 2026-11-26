import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import * as React from "react"
import { QueryClient } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { subMilliseconds } from "date-fns"

import type { ChapterDetail, ChapterSummary } from "../lib/api"
import type { ReaderMode } from "../lib/reader"

// Exercise the real reader handlers and shared dialog without browser automation.
const react = { ...React }
const hooks: unknown[] = []
const effects: (() => void | (() => void))[] = []
const layoutEffects: (() => void)[] = []
let cursor = 0
mock.module("react", () => ({
  ...react,
  useState: (initial: unknown) => {
    const index = cursor++
    if (!(index in hooks))
      hooks[index] = typeof initial === "function" ? initial() : initial
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
  useEffect: (effect: (typeof effects)[number]) => effects.push(effect),
  useLayoutEffect: (effect: () => void) => layoutEffects.push(effect),
}))
const client = new QueryClient()
mock.module("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => client,
  useQuery: (options: { queryKey: unknown[] }) => {
    assert.ok(
      !options.queryKey.includes("navigation-releases"),
      "Navigation lookup must not run on mount"
    )
    return { data: [] }
  },
}))
const pushes: string[] = []
let flushes = 0
mock.module("@bprogress/next/app", () => ({
  useRouter: () => ({ push: (href: string) => pushes.push(href) }),
}))
mock.module("../modules/reading/use-reader-progress", () => ({
  useReaderProgress: () => ({
    flush: () => {
      flushes++
    },
  }),
}))
mock.module("../modules/reading/use-chapter-view", () => ({
  useChapterView: () => undefined,
}))
mock.module("../modules/comments/comment-section", () => ({
  CommentSection: () => null,
}))
mock.module("../components/asset-image", () => ({
  AssetImage: () => <div role="img" aria-label="page" />,
}))
mock.module("@workspace/ui/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl: "https://api.example.test",
    status: "guest",
    user: null,
  }),
}))
mock.module("../modules/reading/local-history", () => ({
  accountReadingScope: () => "guest",
  useLocalReadingHistory: () => [{ chapterId: "alternate" }],
}))
let mode: ReaderMode = "classic"
let limitWidth = true
let currentPage = 0
let readerReady = false
mock.module("zustand", () => ({
  useStore: () => ({
    mode,
    limitWidth,
    chapterError: "",
    chapters: null,
    chromeVisible: true,
    currentPage,
    ready: readerReady,
    sheetOpen: false,
    hydrate: () => 0,
    setChromeVisible: () => undefined,
    setCurrentPage: () => undefined,
    setMode: (nextMode: ReaderMode) => {
      mode = nextMode
    },
    setLimitWidth: (nextLimit: boolean) => {
      limitWidth = nextLimit
    },
    setSheetOpen: () => undefined,
    toggleChrome: () => undefined,
    updateRequestState: () => undefined,
  }),
}))
type Control = React.ComponentProps<"button">
const controls: Control[] = []
const links: (React.ComponentProps<"a"> & { onNavigate?: () => void })[] = []
mock.module("@workspace/ui/components/button", () => ({
  buttonVariants: ({ className }: { className?: string }) => className ?? "",
  Button: ({
    children,
    size: _size,
    variant: _variant,
    ...props
  }: Control & { size?: string; variant?: string }) => {
    void _size
    void _variant
    controls.push({ ...props, children })
    return <button {...props}>{children}</button>
  },
}))
mock.module("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    onNavigate,
    ...props
  }: React.ComponentProps<"a"> & {
    prefetch?: boolean
    onNavigate?: () => void
  }) => {
    void _prefetch
    links.push({ ...props, onNavigate })
    return <a {...props}>{children}</a>
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
  DialogFooter: wrapper,
}))
mock.module("@workspace/ui/components/drawer", () => ({
  Drawer: () => null,
  DrawerContent: wrapper,
  DrawerHeader: wrapper,
  DrawerTitle: wrapper,
  DrawerClose: wrapper,
}))
let changeWidth: (checked: boolean) => void
mock.module("@workspace/ui/components/switch", () => ({
  Switch: ({
    checked,
    id,
    onCheckedChange,
  }: {
    checked: boolean
    id: string
    onCheckedChange: typeof changeWidth
  }) => {
    changeWidth = onCheckedChange
    return <button id={id} role="switch" aria-checked={checked} />
  },
}))
const notices: { type: string }[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: { add: (notice: (typeof notices)[number]) => notices.push(notice) },
}))
const { ReaderClient, ReaderModeDialog } =
  await import("../app/(reader)/chapter/[id]/reader-client")
const { canNavigateChapter, chapterNavigationOptions } =
  await import("../modules/reading/chapter-navigation")
const native: ChapterSummary = {
  id: "native",
  number: "11",
  volume: null,
  title: "Bản gốc",
  language: "vi",
  isDefault: true,
  pageCount: 1,
  publishedAt: "2026-10-02T00:00:00Z",
  groups: [],
  uploader: { id: "uploader", name: "Người đăng" },
  statistics: { views: 0, comments: 0 },
}
const alternate: ChapterSummary = {
  ...native,
  id: "alternate",
  title: "Bản khác",
}
type Choice = ChapterDetail["navigation"]["next"]
// The HTTP contract permits null; the generated Id intersection currently narrows it.
const boundary = {
  state: "boundary",
  selectedChapterId: null,
  options: [],
} as unknown as Choice
const choice = {
  state: "choice-required",
  selectedChapterId: null,
  options: [native, alternate],
} as unknown as Choice
const ready: Choice = {
  state: "ready",
  selectedChapterId: native.id,
  options: [native, alternate],
}
let chapter: ChapterDetail = {
  ...native,
  id: "current",
  number: "10",
  pagesVersion: 1,
  manga: {
    id: "manga",
    slug: "manga",
    title: "Manga",
    isLongStrip: false,
    cover: null,
  },
  pages: [
    {
      position: 0,
      url: "https://images.example/page.webp",
      optimizedUrl: null,
      replicaUrl: null,
      width: 800,
      height: 1200,
      optimizedWidth: null,
      optimizedHeight: null,
    },
  ],
  navigation: { previous: boundary, next: choice, alternatives: [] },
  previous: null,
  next: null,
}
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const requests: { url: string; init?: RequestInit }[] = []
let result: ChapterSummary[] = [native, alternate]
let failed = false
let releaseRequest: (() => void) | undefined
const trigger = {} as HTMLElement
let onKeyDown: (event: KeyboardEvent) => void
globalThis.window = {
  addEventListener: (_type: string, handler: typeof onKeyDown) => {
    onKeyDown = handler
  },
  removeEventListener: () => undefined,
} as unknown as Window & typeof globalThis
globalThis.document = { activeElement: trigger } as unknown as Document
globalThis.fetch = async (input, init) => {
  requests.push({ url: String(input), init })
  if (releaseRequest)
    await new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
  return Response.json({ data: result }, { status: failed ? 429 : 200 })
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
let readerTree: React.ReactNode
function TestReader() {
  // eslint-disable-next-line react-hooks/globals -- Capture JSX only in this SSR harness to attach fake DOM refs before layout effects.
  readerTree = ReaderClient({
    apiBaseUrl: "https://api.example.test",
    chapter,
    header: <div>Header</div>,
  })
  return readerTree
}
function render() {
  cursor = 0
  controls.length = 0
  links.length = 0
  effects.length = 0
  layoutEffects.length = 0
  const html = renderToStaticMarkup(<TestReader />)
  effects.at(-1)!()
  return html
}
function click(label: "Chương sau" | "Chương trước") {
  const control = controls.find((c) => c["aria-label"] === label)!
  assert.ok(control)
  control.onClick!({
    currentTarget: trigger,
  } as React.MouseEvent<HTMLButtonElement>)
}
function key(value: string) {
  let prevented = false
  onKeyDown!({
    key: value,
    target: null,
    preventDefault: () => {
      prevented = true
    },
  } as unknown as KeyboardEvent)
  return prevented
}

type SettingsElement = React.ReactElement<{
  children?: React.ReactNode
  onClick?: () => void
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onModeChange?: (mode: ReaderMode) => void
  onLimitWidthChange?: (limitWidth: boolean) => void
  ref?: React.RefObject<HTMLElement | null>
  role?: string
  className?: string
}>
function settingsElements(node: React.ReactNode): SettingsElement[] {
  if (!react.isValidElement<SettingsElement["props"]>(node)) return []
  return [
    node,
    ...react.Children.toArray(node.props.children).flatMap(settingsElements),
  ]
}

const selectedModes: ReaderMode[] = []
const selectedWidths: boolean[] = []
const dialogOpenChanges: boolean[] = []
const settingsProps = {
  isLongStrip: false,
  limitWidth: false,
  mode: "classic" as ReaderMode,
  onLimitWidthChange: (checked: boolean) => selectedWidths.push(checked),
  onModeChange: (nextMode: ReaderMode) => selectedModes.push(nextMode),
  onOpenChange: (open: boolean) => dialogOpenChanges.push(open),
  open: true,
  finalFocus: { current: null },
}
const classicSettings = settingsElements(ReaderModeDialog(settingsProps))
const modeCards = classicSettings.filter((el) => el.type === "button")
assert.equal(modeCards.length, 2, "Mode selection has no confirmation button")
modeCards[1]!.props.onClick!()
assert.deepEqual(
  selectedModes,
  ["zen"],
  "Selecting a card immediately changes the mode"
)
assert.deepEqual(dialogOpenChanges, [], "Selecting a mode keeps settings open")
const widthSwitch = classicSettings.find((el) => el.props.onCheckedChange)!
assert.equal(widthSwitch.props.checked, false)
widthSwitch.props.onCheckedChange!(true)
assert.deepEqual(selectedWidths, [true])
assert.equal(
  settingsElements(ReaderModeDialog({ ...settingsProps, mode: "zen" })).some(
    (el) => el.props.onCheckedChange
  ),
  false,
  "Zen never exposes the width limit"
)
const longStripSettings = settingsElements(
  ReaderModeDialog({ ...settingsProps, isLongStrip: true })
)
assert.equal(longStripSettings.filter((el) => el.type === "button").length, 1)
assert(
  longStripSettings.some((el) => el.props.onCheckedChange),
  "Long strips still support Classic width settings"
)
try {
  assert.equal(canNavigateChapter(boundary), false)
  assert.equal(canNavigateChapter({ ...choice, state: "unordered" }), false)
  assert.equal(canNavigateChapter(choice), true)
  assert.equal(canNavigateChapter(ready), true)
  render()
  assert.ok(controls.find((c) => c["aria-label"] === "Cài đặt reader"))
  assert.equal(requests.length, 0)
  assert.equal(
    controls.find((c) => c["aria-label"] === "Chương sau")?.disabled,
    false
  )
  assert.equal(
    controls.find((c) => c["aria-label"] === "Chương trước")?.disabled,
    true
  )
  const introButton = controls.find(
    (c) => c.className === "w-full uppercase" && !c["aria-label"]
  )!
  introButton.onClick!({
    currentTarget: trigger,
  } as React.MouseEvent<HTMLButtonElement>)
  await tick()
  const dialog = render()
  assert.match(dialog, /Ch\. 11 - Bản gốc/)
  assert.match(dialog, /Ch\. 11 - Bản khác/)
  assert.match(dialog, /Người đăng/)
  assert.match(dialog, /data-read="true"/)
  assert.equal(finalFocus!.current, trigger)
  assert.equal(
    pushes.length,
    0,
    "Choosing must never auto-open the pinned default"
  )
  assert.equal(
    flushes,
    0,
    "Opening or cancelling must not navigate/flush progress"
  )
  assert.equal(
    key("PageUp"),
    false,
    "Hotkeys must not navigate behind the dialog"
  )
  links.find((link) => link.href === "/chapter/alternate")!.onNavigate!()
  assert.equal(flushes, 1, "Selecting a card flushes current progress")
  assert.doesNotMatch(render(), /role="dialog"/)
  assert.match(requests[0]!.url, /navigation-releases\?direction=next$/)
  assert.equal(requests[0]!.init?.cache, "no-store")
  click("Chương sau")
  await tick()
  render()
  closeDialog!()
  render()
  assert.equal(requests.length, 1, "Repeated choice reuses the memory cache")

  const options = chapterNavigationOptions(
    "https://api.example.test",
    chapter.id,
    "next"
  )
  client.setQueryData(options.queryKey, result, {
    updatedAt: subMilliseconds(Date.now(), 60_001).getTime(),
  })
  assert.equal(requests.length, 1)
  assert.equal(key("PageUp"), true)
  await tick()
  render()
  closeDialog!()
  render()
  assert.equal(requests.length, 2, "Expired choice fetches only on interaction")

  chapter = {
    ...chapter,
    navigation: {
      ...chapter.navigation,
      previous: { ...choice, options: [alternate] },
    },
  }
  mode = "zen"
  result = [alternate]
  render()
  assert.equal(
    controls.find((c) => c["aria-label"] === "Chương trước")?.children !==
      undefined,
    true
  )
  assert.equal(key("PageDown"), true)
  await tick()
  assert.match(render(), /role="dialog"/)
  assert.equal(
    pushes.length,
    0,
    "A single fallback still needs explicit lane confirmation"
  )
  assert.match(requests.at(-1)!.url, /direction=previous$/)
  closeDialog!()
  render()

  client.clear()
  releaseRequest = () => undefined
  click("Chương sau")
  await tick()
  const busy = render()
  assert.match(busy, /aria-busy="true"/)
  const beforeDuplicate = requests.length
  click("Chương trước")
  await tick()
  assert.equal(requests.length, beforeDuplicate)
  releaseRequest!()
  releaseRequest = undefined
  await tick()
  render()
  closeDialog!()
  render()

  client.clear()
  failed = true
  click("Chương sau")
  await tick()
  assert.equal(notices.at(-1)?.type, "error")
  assert.doesNotMatch(render(), /aria-busy="true"/)
  failed = false
  result = []
  click("Chương sau")
  await tick()
  assert.equal(notices.at(-1)?.type, "info")
  assert.doesNotMatch(render(), /role="dialog"/)

  chapter = { ...chapter, navigation: { ...chapter.navigation, next: ready } }
  const direct = render()
  assert.match(direct, /href="\/chapter\/native"/)
  const beforeReady = requests.length
  click("Chương sau")
  await tick()
  assert.deepEqual(pushes, ["/chapter/native"])
  assert.equal(requests.length, beforeReady, "Ready navigation needs no lookup")
  assert.equal(flushes, 2)
  mode = "classic"
  render()
  chapter = {
    ...chapter,
    navigation: { ...chapter.navigation, next: boundary },
  }
  render()
  assert.equal(key("PageUp"), false)

  assert.match(render(), /max-w-6xl/)
  const settingsButton = controls.find(
    (c) => c["aria-label"] === "Cài đặt reader"
  )!
  settingsButton.onClick!({} as React.MouseEvent<HTMLButtonElement>)
  assert.match(render(), /Giới hạn chiều rộng/)
  assert.equal(
    key("PageUp"),
    false,
    "Hotkeys are blocked while settings are open"
  )
  changeWidth!(false)
  const wideReader = render()
  assert.doesNotMatch(wideReader, /max-w-6xl/)
  assert.match(wideReader, /role="dialog"/, "Width changes keep settings open")
  mode = "zen"
  const zenSettings = render()
  assert.match(zenSettings, /role="dialog"/)
  assert.doesNotMatch(zenSettings, /Giới hạn chiều rộng/)
  closeDialog!()
  assert.doesNotMatch(render(), /role="dialog"/)

  chapter = { ...chapter, manga: { ...chapter.manga, isLongStrip: true } }
  render()
  controls.find((c) => c["aria-label"] === "Cài đặt reader")!.onClick!(
    {} as React.MouseEvent<HTMLButtonElement>
  )
  const longStripDialog = render()
  assert.match(longStripDialog, /role="dialog"/)
  assert.match(longStripDialog, /Giới hạn chiều rộng/)
  assert.doesNotMatch(longStripDialog, /Zen UI/)
  closeDialog!()
  render()

  chapter = {
    ...chapter,
    manga: { ...chapter.manga, isLongStrip: false },
    pages: Array.from({ length: 6 }, (_, position) => ({
      ...chapter.pages[0]!,
      position,
    })),
  }
  mode = "classic"
  currentPage = 4
  readerReady = true
  render()
  controls.find((c) => c["aria-label"] === "Cài đặt reader")!.onClick!(
    {} as React.MouseEvent<HTMLButtonElement>
  )
  render()
  const settings = () =>
    settingsElements(readerTree).find((el) => el.props.onLimitWidthChange)!
  const scrolls: { selector: string; options: ScrollIntoViewOptions }[] = []
  const pageRoot = {
    querySelector: (selector: string) => ({
      scrollIntoView: (options: ScrollIntoViewOptions) =>
        scrolls.push({ selector, options }),
    }),
  } as unknown as HTMLElement
  settings().props.onModeChange!("zen")
  assert.match(render(), /role="dialog"/)
  const zenRoot = settingsElements(readerTree).find(
    (el) => el.props.ref && el.props.className?.includes("snap-x")
  )!
  zenRoot.props.ref!.current = pageRoot
  layoutEffects.forEach((effect) => effect())
  assert.deepEqual(
    scrolls.at(-1),
    {
      selector: '[data-reader-page="4"]',
      options: { behavior: "instant", block: "nearest", inline: "center" },
    },
    "Classic to Zen must position page 5 before paint, while settings remain open"
  )
  settings().props.onModeChange!("classic")
  assert.match(render(), /role="dialog"/)
  const classicRoot = settingsElements(readerTree).find(
    (el) => el.props.role === "list"
  )!
  classicRoot.props.ref!.current = pageRoot
  layoutEffects.forEach((effect) => effect())
  assert.deepEqual(
    scrolls.at(-1),
    {
      selector: '[data-reader-page="4"]',
      options: { behavior: "instant" },
    },
    "Zen to Classic must position page 5 without waiting for dialog dismissal"
  )
  assert.equal(currentPage, 4)
  closeDialog!()
  render()
} finally {
  globalThis.fetch = originalFetch
  if (originalWindow) globalThis.window = originalWindow
  else Reflect.deleteProperty(globalThis, "window")
  if (originalDocument) globalThis.document = originalDocument
  else Reflect.deleteProperty(globalThis, "document")
  client.clear()
}
console.log("Reader adjacent chapter selection checks passed")
