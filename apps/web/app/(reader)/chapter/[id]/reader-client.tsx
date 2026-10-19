"use client"

import Link from "next/link"
import { useRouter } from "@bprogress/next/app"
import {
  ArrowUpIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  GalleryHorizontalIcon,
  GalleryVerticalIcon,
  MessagesSquareIcon,
  XIcon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { preconnect, preload } from "react-dom"
import { useStore } from "zustand"

import { AssetImage } from "@/components/asset-image"
import {
  chapterLabel,
  groupChaptersByVolume,
  readerChapterLabel,
} from "@/lib/catalog"
import {
  closestReaderPanelIndex,
  createReaderStore,
  readerImageSource,
  resolveReaderMode,
  zenPageWidth,
  zenPreloadIndexes,
  type ReaderMode,
} from "@/lib/reader"
import { CommentSection } from "@/modules/comments/comment-section"
import { useChapterView } from "@/modules/reading/use-chapter-view"
import { useReaderProgress } from "@/modules/reading/use-reader-progress"
import { ChapterReleaseDialog } from "@/modules/reading/chapter-release-dialog"
import {
  canNavigateChapter,
  useAdjacentChapter,
  loadReaderChapters,
  type ChapterNavigationDirection,
} from "@/modules/reading/chapter-navigation"
import type { components } from "@/src/lib/generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"

type ChapterDetail = components["schemas"]["ChapterDetail"]
type ChapterList = components["schemas"]["ChapterList"]
type ZenStage = "end" | "intro" | "page"

const chapterHref = (id: string) => `/chapter/${id}`
const readerConfirmedKey = "redive:reader:ui-confirmed:v1"
// ponytail: ChapterDetail has no reading-direction metadata; add it to the API before supporting LTR titles.
const zenDirection = "rtl"

function ReaderModePicker({
  isLongStrip,
  mode,
  onHelp,
  onModeChange,
}: {
  isLongStrip: boolean
  mode: ReaderMode
  onHelp: () => void
  onModeChange: (mode: ReaderMode) => void
}) {
  const modes: readonly ReaderMode[] = isLongStrip
    ? ["classic"]
    : ["classic", "zen"]

  return (
    <div className="flex items-center gap-2">
      <div
        aria-label="Chế độ đọc"
        className="flex overflow-hidden rounded-md border border-border bg-muted/50"
        role="group"
      >
        {modes.map((value) => (
          <Button
            aria-pressed={mode === value}
            className="w-28 rounded-none border-0"
            key={value}
            onClick={() => onModeChange(value)}
            size="sm"
            variant={mode === value ? "default" : "secondary"}
          >
            {value === "classic" ? "Classic UI" : "Zen UI"}
          </Button>
        ))}
      </div>
      {isLongStrip ? null : (
        <Button
          aria-label="Giới thiệu hai giao diện đọc"
          className="rounded-full"
          onClick={onHelp}
          size="icon-sm"
          variant="outline"
        >
          <CircleHelpIcon />
        </Button>
      )}
    </div>
  )
}

function ReaderModeDialog({
  mode,
  onConfirm,
  onOpenChange,
  open,
}: {
  mode: ReaderMode
  onConfirm: (mode: ReaderMode) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [selected, setSelected] = useState(mode)

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chọn giao diện đọc</DialogTitle>
          <DialogDescription>
            Thấy quen không? Đúng rồi đấy, giao diện này được &quot;ăn cắp&quot;
            từ Cứu Truyện
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            aria-pressed={selected === "classic"}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected === "classic"
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted"
            )}
            onClick={() => setSelected("classic")}
            type="button"
          >
            <GalleryVerticalIcon className="mb-4 size-7" />
            <span className="block font-heading text-lg font-semibold">
              Classic UI
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Cuộn dọc kiểu truyền thống, đi đâu cũng có.
              <br />
              Cổ điển, tôn trọng.
            </span>
          </button>
          <button
            aria-pressed={selected === "zen"}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected === "zen"
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted"
            )}
            onClick={() => setSelected("zen")}
            type="button"
          >
            <GalleryHorizontalIcon className="mb-4 size-7" />
            <span className="block font-heading text-lg font-semibold">
              Zen UI
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Đọc từng trang, chạm 2 cạnh hoặc dùng phím mũi tên ngang để chuyển
              trang.
              <br />
              Hiện đại, độc lạ.
            </span>
          </button>
        </div>
        <DialogFooter>
          <Button onClick={() => onConfirm(selected)}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReaderChapterLink({
  choice,
  className,
  children,
  variant = "default",
  disabled,
  loading,
  onChoose,
  onNavigate,
}: {
  choice: components["schemas"]["ChapterNavigationChoice"]
  className: string
  children: ReactNode
  variant?: "default" | "secondary"
  disabled: boolean
  loading: boolean
  onChoose: (trigger: HTMLElement) => void
  onNavigate: () => void
}) {
  if (choice.state === "ready" && choice.selectedChapterId && !disabled)
    return (
      <Link
        className={buttonVariants({ size: "lg", variant, className })}
        href={chapterHref(choice.selectedChapterId)}
        onClick={onNavigate}
      >
        {children}
      </Link>
    )
  return (
    <Button
      className={className}
      disabled={disabled || !canNavigateChapter(choice)}
      aria-busy={loading}
      onClick={(event) => onChoose(event.currentTarget)}
      size="lg"
      variant={variant}
    >
      {loading ? <Spinner data-icon="inline-start" /> : null}
      {children}
    </Button>
  )
}

function ReaderIntro({
  chapter,
  mode,
  onHelp,
  onModeChange,
  onNavigate,
  onAdjacentChapter,
  loadingDirection,
  zen = false,
}: {
  chapter: ChapterDetail
  mode: ReaderMode
  onHelp: () => void
  onModeChange: (mode: ReaderMode) => void
  onNavigate: () => void
  onAdjacentChapter: (
    direction: ChapterNavigationDirection,
    trigger: HTMLElement
  ) => void
  loadingDirection: ChapterNavigationDirection | null
  zen?: boolean
}) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-screen-sm flex-col px-2",
        zen && "h-full max-w-screen-md overflow-y-auto pt-12"
      )}
    >
      <div className="flex justify-center">
        <ReaderModePicker
          isLongStrip={chapter.manga.isLongStrip}
          mode={mode}
          onHelp={onHelp}
          onModeChange={onModeChange}
        />
      </div>
      <Link
        className="mt-12 block w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        href={`/manga/${chapter.manga.id}/${chapter.manga.slug}`}
        onClick={onNavigate}
      >
        {chapter.manga.title}
      </Link>
      <h1 className="mt-8 mb-6 font-heading text-xl font-semibold">
        {readerChapterLabel(chapter)}
      </h1>
      <div className="grid gap-2">
        <ReaderChapterLink
          choice={chapter.navigation.next}
          className="w-full uppercase"
          disabled={loadingDirection !== null}
          loading={loadingDirection === "next"}
          onChoose={(trigger) => onAdjacentChapter("next", trigger)}
          onNavigate={onNavigate}
        >
          Chương sau
        </ReaderChapterLink>
        <ReaderChapterLink
          choice={chapter.navigation.previous}
          className="w-full uppercase"
          variant="secondary"
          disabled={loadingDirection !== null}
          loading={loadingDirection === "previous"}
          onChoose={(trigger) => onAdjacentChapter("previous", trigger)}
          onNavigate={onNavigate}
        >
          Chương trước
        </ReaderChapterLink>
      </div>
    </section>
  )
}

function ClassicEnd({
  chapter,
  onNavigate,
  onAdjacentChapter,
  loadingDirection,
}: {
  chapter: ChapterDetail
  onNavigate: () => void
  onAdjacentChapter: (
    direction: ChapterNavigationDirection,
    trigger: HTMLElement
  ) => void
  loadingDirection: ChapterNavigationDirection | null
}) {
  return (
    <section className="mx-auto w-full max-w-screen-sm px-2 pt-8 pb-24">
      <ReaderChapterLink
        choice={chapter.navigation.next}
        className="w-full uppercase"
        disabled={loadingDirection !== null}
        loading={loadingDirection === "next"}
        onChoose={(trigger) => onAdjacentChapter("next", trigger)}
        onNavigate={onNavigate}
      >
        Chương sau
      </ReaderChapterLink>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <ReaderChapterLink
          choice={chapter.navigation.previous}
          className="uppercase"
          variant="secondary"
          disabled={loadingDirection !== null}
          loading={loadingDirection === "previous"}
          onChoose={(trigger) => onAdjacentChapter("previous", trigger)}
          onNavigate={onNavigate}
        >
          Chương trước
        </ReaderChapterLink>
      </div>
    </section>
  )
}

function ZenEnd({
  chapter,
  onNavigate,
  onAdjacentChapter,
  loadingDirection,
}: {
  chapter: ChapterDetail
  onNavigate: () => void
  onAdjacentChapter: (
    direction: ChapterNavigationDirection,
    trigger: HTMLElement
  ) => void
  loadingDirection: ChapterNavigationDirection | null
}) {
  return (
    <section className="mx-auto flex h-full w-full max-w-screen-md flex-col overflow-y-auto px-2 pt-12 pb-10">
      <Link
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        href={`/manga/${chapter.manga.id}/${chapter.manga.slug}`}
        onClick={onNavigate}
      >
        {chapter.manga.title}
      </Link>
      <div className="my-auto py-10">
        <p className="text-sm text-muted-foreground">Kết thúc</p>
        <h2 className="mt-2 font-heading text-xl font-semibold">
          {readerChapterLabel(chapter)}
        </h2>
      </div>
      <div className="grid gap-2">
        <ReaderChapterLink
          choice={chapter.navigation.next}
          className="w-full uppercase"
          disabled={loadingDirection !== null}
          loading={loadingDirection === "next"}
          onChoose={(trigger) => onAdjacentChapter("next", trigger)}
          onNavigate={onNavigate}
        >
          Chương sau
        </ReaderChapterLink>
        {canNavigateChapter(chapter.navigation.previous) ? (
          <ReaderChapterLink
            choice={chapter.navigation.previous}
            className="w-full uppercase"
            variant="secondary"
            disabled={loadingDirection !== null}
            loading={loadingDirection === "previous"}
            onChoose={(trigger) => onAdjacentChapter("previous", trigger)}
            onNavigate={onNavigate}
          >
            Chương trước
          </ReaderChapterLink>
        ) : null}
      </div>
    </section>
  )
}

export function ReaderClient({
  apiBaseUrl,
  chapter,
  header,
}: {
  apiBaseUrl: string
  chapter: ChapterDetail
  header: ReactNode
}) {
  const isMobile = useIsMobile()
  const router = useRouter()
  const classicPagesRef = useRef<HTMLDivElement>(null)
  const zenRef = useRef<HTMLDivElement>(null)
  const initialPageHashRef = useRef(false)
  const restoreClassicRef = useRef(false)
  const zenInitialTargetRef = useRef<"intro" | "page" | null>(null)
  const zenInitializedRef = useRef(false)
  const zenStageRef = useRef<ZenStage>("intro")
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [navigationVisible, setNavigationVisible] = useState(true)
  const [zenStage, setZenStage] = useState<ZenStage>("intro")
  const [readerStore] = useState(createReaderStore)
  const {
    chapterError,
    chapters,
    chromeVisible,
    currentPage,
    hydrate,
    mode: preferredMode,
    ready,
    setChromeVisible,
    setCurrentPage: setReaderPage,
    setMode,
    setSheetOpen,
    sheetOpen,
    toggleChrome,
    updateRequestState,
  } = useStore(readerStore)

  const pageCount = chapter.pages.length
  const mode = resolveReaderMode(preferredMode, chapter.manga.isLongStrip)

  useEffect(() => {
    initialPageHashRef.current = /^#page-\d+$/.test(window.location.hash)
    restoreClassicRef.current = initialPageHashRef.current
  }, [])

  const { flush: flushProgress } = useReaderProgress({
    chapter,
    hydrate,
    ready,
  })
  useChapterView({
    activePage: mode === "classic" || zenStage === "page",
    apiBaseUrl,
    chapterId: chapter.id,
    currentPage,
    mode,
    pageCount,
    pagesRef: classicPagesRef,
    ready,
  })

  useEffect(() => {
    if (!ready || chapter.manga.isLongStrip) return
    try {
      if (window.localStorage.getItem(readerConfirmedKey)) return
      const frame = requestAnimationFrame(() => setHelpOpen(true))
      return () => cancelAnimationFrame(frame)
    } catch {
      // Storage can be unavailable in privacy modes; reader still works.
    }
  }, [chapter.manga.isLongStrip, ready])

  const navigateChapter = useCallback(
    (id: string) => {
      void flushProgress(true)
      router.push(chapterHref(id))
    },
    [flushProgress, router]
  )

  const {
    loading: loadingDirection,
    choice: navigationChoice,
    setChoice: setNavigationChoice,
    trigger: navigationTrigger,
    openAdjacentChapter,
  } = useAdjacentChapter<components["schemas"]["ChapterSummary"]>({
    apiBaseUrl,
    chapterId: chapter.id,
    navigation: chapter.navigation,
    navigate: navigateChapter,
  })

  const scrollZenTarget = useCallback(
    (target: "end" | "intro" | number, behavior: ScrollBehavior = "smooth") => {
      const selector =
        typeof target === "number"
          ? `[data-reader-page="${target}"]`
          : `[data-zen-stage="${target}"]`
      zenRef.current?.querySelector<HTMLElement>(selector)?.scrollIntoView({
        behavior,
        block: "nearest",
        inline: "center",
      })
    },
    []
  )

  useEffect(() => {
    if (!ready || mode !== "classic") return
    const nodes =
      classicPagesRef.current?.querySelectorAll<HTMLElement>(
        "[data-reader-page]"
      )
    if (!nodes?.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(({ isIntersecting }) => isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible)
          setReaderPage(
            chapter.id,
            pageCount,
            Number(visible.target.getAttribute("data-reader-page"))
          )
      },
      { rootMargin: "-50% 0px -49%", threshold: 0 }
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [chapter.id, mode, pageCount, ready, setReaderPage])

  useEffect(() => {
    if (!ready || mode !== "classic" || !restoreClassicRef.current) return
    restoreClassicRef.current = false
    const frame = requestAnimationFrame(() => {
      classicPagesRef.current
        ?.querySelector<HTMLElement>(`[data-reader-page="${currentPage}"]`)
        ?.scrollIntoView()
    })
    return () => cancelAnimationFrame(frame)
  }, [currentPage, mode, ready])

  useEffect(() => {
    if (!ready || mode !== "zen") return
    const root = zenRef.current
    const nodes = root?.querySelectorAll<HTMLElement>(
      "[data-reader-page], [data-zen-stage]"
    )
    if (!root || !nodes?.length) return
    const observer = new IntersectionObserver(
      () => {
        const rootRect = root.getBoundingClientRect()
        const center = rootRect.left + rootRect.width / 2
        const rects = Array.from(nodes, (node) => node.getBoundingClientRect())
        const visibleIndex = closestReaderPanelIndex(rects, center)
        const visible = nodes[visibleIndex]
        const visibleRect = rects[visibleIndex]
        if (!visible || !visibleRect) return
        if (
          Math.abs(visibleRect.left + visibleRect.width / 2 - center) >
          rootRect.width / 2
        )
          return
        const page = visible.getAttribute("data-reader-page")
        if (page !== null) {
          const nextPage = Number(page)
          const changed =
            zenStageRef.current !== "page" ||
            readerStore.getState().currentPage !== nextPage
          zenStageRef.current = "page"
          setZenStage("page")
          setNavigationVisible(false)
          if (changed) {
            setChromeVisible(false)
          }
          setReaderPage(chapter.id, pageCount, nextPage)
          return
        }
        const nextStage = visible.getAttribute("data-zen-stage") as Exclude<
          ZenStage,
          "page"
        >
        zenStageRef.current = nextStage
        setZenStage(nextStage)
        setChromeVisible(true)
      },
      { root, threshold: [0, 0.25, 0.5, 0.75] }
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [
    chapter.id,
    mode,
    pageCount,
    readerStore,
    ready,
    setChromeVisible,
    setReaderPage,
  ])

  useEffect(() => {
    if (!ready) return
    if (mode !== "zen") {
      zenInitializedRef.current = false
      return
    }
    if (zenInitializedRef.current) return
    zenInitializedRef.current = true
    const target =
      zenInitialTargetRef.current ??
      (initialPageHashRef.current ? "page" : "intro")
    zenInitialTargetRef.current = null
    const frame = requestAnimationFrame(() =>
      scrollZenTarget(target === "page" ? currentPage : target, "auto")
    )
    return () => cancelAnimationFrame(frame)
  }, [currentPage, mode, ready, scrollZenTarget])

  const moveZenPage = useCallback(
    (delta: -1 | 1) => {
      const stage = zenStageRef.current
      if (stage === "intro") {
        if (delta === 1) scrollZenTarget(0)
        return
      }
      if (stage === "end") {
        if (delta === -1) scrollZenTarget(pageCount - 1)
        return
      }
      const page = readerStore.getState().currentPage + delta
      scrollZenTarget(page < 0 ? "intro" : page >= pageCount ? "end" : page)
    },
    [pageCount, readerStore, scrollZenTarget]
  )

  useEffect(() => {
    if (mode !== "zen") return
    const root = zenRef.current
    if (!root) return
    let lastMove = 0
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      if (performance.now() - lastMove < 100) return
      lastMove = performance.now()
      moveZenPage(event.deltaY > 0 ? 1 : -1)
    }
    root.addEventListener("wheel", onWheel, { passive: false })
    return () => root.removeEventListener("wheel", onWheel)
  }, [mode, moveZenPage])

  const scrollToStart = useCallback(() => {
    if (mode === "zen") {
      scrollZenTarget("intro")
      return
    }
    window.scrollTo({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      top: 0,
    })
  }, [mode, scrollZenTarget])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        chapterDialogOpen ||
        helpOpen ||
        sheetOpen ||
        navigationChoice ||
        loadingDirection
      )
        return
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable='true']"))
        return
      if (event.key.toLowerCase() === "t") {
        event.preventDefault()
        scrollToStart()
      } else if (mode === "zen" && event.key === "ArrowLeft") {
        event.preventDefault()
        moveZenPage(1)
      } else if (mode === "zen" && event.key === "ArrowRight") {
        event.preventDefault()
        moveZenPage(-1)
      } else if (
        event.key === "PageUp" &&
        canNavigateChapter(chapter.navigation.next)
      ) {
        event.preventDefault()
        void openAdjacentChapter("next")
      } else if (
        event.key === "PageDown" &&
        canNavigateChapter(chapter.navigation.previous)
      ) {
        event.preventDefault()
        void openAdjacentChapter("previous")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    chapter.navigation,
    chapterDialogOpen,
    helpOpen,
    sheetOpen,
    navigationChoice,
    loadingDirection,
    mode,
    moveZenPage,
    openAdjacentChapter,
    scrollToStart,
  ])

  function changeMode(nextMode: ReaderMode) {
    if (chapter.manga.isLongStrip && nextMode === "zen") return
    if (nextMode === mode) return
    if (nextMode === "classic") restoreClassicRef.current = true
    else zenInitialTargetRef.current = "page"
    setChromeVisible(true)
    setMode(nextMode)
  }

  function confirmMode(nextMode: ReaderMode) {
    changeMode(nextMode)
    try {
      window.localStorage.setItem(readerConfirmedKey, "true")
    } catch {
      // Storage can be unavailable in privacy modes.
    }
    setHelpOpen(false)
  }

  async function loadChapters(page = 1) {
    updateRequestState({ chapterError: "" })
    try {
      const result = await loadReaderChapters<ChapterList>(
        apiBaseUrl,
        chapter.manga.id,
        page
      )
      const current = readerStore.getState().chapters
      updateRequestState({
        chapters:
          page === 1
            ? result
            : { ...result, data: [...(current?.data ?? []), ...result.data] },
      })
    } catch (error) {
      updateRequestState({
        chapterError:
          error instanceof Error ? error.message : "Không thể tải chapter",
      })
    }
  }

  function openChapters() {
    setChapterDialogOpen(true)
    if (readerStore.getState().chapters === null) void loadChapters()
  }

  const primarySource = (page: ChapterDetail["pages"][number]) =>
    readerImageSource(page).src
  const firstSource = chapter.pages[0] && primarySource(chapter.pages[0])
  if (firstSource) preconnect(new URL(firstSource).origin)
  if (mode === "zen") {
    zenPreloadIndexes(pageCount, currentPage).forEach((index, preloadIndex) =>
      preload(primarySource(chapter.pages[index]!), {
        as: "image",
        fetchPriority: preloadIndex === 0 ? "high" : "low",
      })
    )
  }

  const controlsVisible =
    chromeVisible &&
    !chapterDialogOpen &&
    !helpOpen &&
    !sheetOpen &&
    !navigationChoice
  const controlsClass = controlsVisible
    ? "opacity-100"
    : "pointer-events-none opacity-0"
  const onNavigate = () => void flushProgress(true)
  const progress = pageCount ? ((currentPage + 1) / pageCount) * 100 : 0
  const leftDirection = mode === "zen" ? "next" : "previous"
  const rightDirection = mode === "zen" ? "previous" : "next"

  return (
    <article className="min-h-dvh bg-background text-foreground">
      <div
        className={cn(
          "top-0 z-40 transition-transform duration-200 motion-reduce:transition-none",
          mode === "zen" ? "fixed inset-x-0" : "sticky",
          !controlsVisible && "-translate-y-full"
        )}
      >
        {header}
      </div>

      {pageCount === 0 ? (
        <Empty className="min-h-[calc(100dvh-4rem)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Chapter chưa có trang ảnh</EmptyTitle>
            <EmptyDescription>Hãy chọn một chapter khác.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : mode === "classic" ? (
        <main className="my-12">
          <ReaderIntro
            chapter={chapter}
            mode={mode}
            onHelp={() => setHelpOpen(true)}
            onModeChange={changeMode}
            onNavigate={onNavigate}
            onAdjacentChapter={openAdjacentChapter}
            loadingDirection={loadingDirection}
          />
          <div className="mt-12" ref={classicPagesRef} role="list">
            {chapter.pages.map((page, index) => (
              <div
                className={cn(
                  "relative mx-auto flex w-full max-w-6xl justify-center",
                  chapter.manga.isLongStrip ? "px-0" : "mb-6 px-2"
                )}
                data-reader-page={index}
                key={page.url}
                role="listitem"
              >
                <AssetImage
                  key={`${chapter.pagesVersion}:${primarySource(page)}:${page.url}`}
                  {...readerImageSource(page)}
                  alt={`Trang ${index + 1} của ${chapterLabel(chapter)}`}
                  className={cn(
                    "h-auto max-w-full border-neutral-500/30",
                    chapter.manga.isLongStrip ? "border-x" : "border"
                  )}
                  eager={index === 0}
                  fadeIn
                  loading={index < 2 ? "eager" : "lazy"}
                  onActivate={toggleChrome}
                  priority={index === 0 ? "high" : "auto"}
                  retry
                  showSpinner={ready}
                />
              </div>
            ))}
          </div>
          <ClassicEnd
            chapter={chapter}
            onNavigate={onNavigate}
            onAdjacentChapter={openAdjacentChapter}
            loadingDirection={loadingDirection}
          />
        </main>
      ) : (
        <main className="relative h-dvh overflow-hidden select-none">
          <div
            className={cn(
              "flex h-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] lg:gap-6 [&::-webkit-scrollbar]:hidden",
              zenDirection === "rtl" ? "flex-row-reverse" : "flex-row"
            )}
            ref={zenRef}
          >
            <div
              aria-hidden="true"
              className="h-dvh w-0 shrink-0 lg:w-[calc(15vw-1.5rem)]"
            />
            <div
              className="h-dvh w-[90vw] shrink-0 snap-center pt-16 pb-10 md:pt-12 lg:w-[70vw]"
              data-zen-stage="intro"
            >
              <ReaderIntro
                chapter={chapter}
                mode={mode}
                onHelp={() => setHelpOpen(true)}
                onModeChange={changeMode}
                onNavigate={onNavigate}
                onAdjacentChapter={openAdjacentChapter}
                loadingDirection={loadingDirection}
                zen
              />
            </div>
            {chapter.pages.map((page, index) => {
              const active = zenStage === "page" && currentPage === index
              const panelWidth = zenPageWidth(
                readerImageSource(page).width,
                readerImageSource(page).height
              )
              return (
                <div
                  className={cn(
                    "relative flex h-dvh w-screen shrink-0 snap-center snap-always items-center justify-center overflow-hidden transition-[filter] duration-200 lg:w-[calc((100vw-3rem)/3)] lg:brightness-[.2]",
                    active && "z-10 lg:brightness-100 lg:drop-shadow-2xl"
                  )}
                  data-reader-page={index}
                  key={page.url}
                  onClick={() => {
                    if (!active) scrollZenTarget(index)
                    else toggleChrome()
                  }}
                  style={panelWidth ? { width: panelWidth } : undefined}
                >
                  <AssetImage
                    key={`${chapter.pagesVersion}:${primarySource(page)}:${page.url}`}
                    {...readerImageSource(page)}
                    alt={`Trang ${index + 1} của ${chapterLabel(chapter)}`}
                    className="pointer-events-none h-auto max-h-full max-w-full object-contain"
                    eager={index < 2}
                    fadeIn
                    loading={index < 2 ? "eager" : "lazy"}
                    priority={index === 0 ? "high" : "auto"}
                    retry
                    showSpinner={ready}
                  />
                </div>
              )
            })}
            <div
              className="h-dvh w-[90vw] shrink-0 snap-center pt-16 pb-10 md:pt-12 lg:w-[70vw]"
              data-zen-stage="end"
            >
              <ZenEnd
                chapter={chapter}
                onNavigate={onNavigate}
                onAdjacentChapter={openAdjacentChapter}
                loadingDirection={loadingDirection}
              />
            </div>
            <div
              aria-hidden="true"
              className="h-dvh w-0 shrink-0 lg:w-[calc(15vw-1.5rem)]"
            />
          </div>

          <button
            aria-label="Trang tiếp"
            className={cn(
              "absolute inset-y-0 left-0 z-20 flex w-[10vw] min-w-11 items-center justify-center bg-gradient-to-r from-primary/50 to-transparent text-xs font-medium tracking-wider uppercase transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset lg:hover:opacity-50",
              navigationVisible ? "animate-pulse opacity-70" : "opacity-0"
            )}
            onClick={() => moveZenPage(1)}
            type="button"
          >
            <span className="hidden -rotate-90 text-white lg:block lg:text-lg">
              Trang tiếp
            </span>
            <ChevronLeftIcon className="lg:hidden" />
          </button>
          <button
            aria-label="Trang trước"
            className={cn(
              "absolute inset-y-0 right-0 z-20 flex w-[10vw] min-w-11 items-center justify-center bg-gradient-to-l from-primary/50 to-transparent text-xs font-medium tracking-wider uppercase transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset lg:hover:opacity-50",
              navigationVisible ? "animate-pulse opacity-70" : "opacity-0"
            )}
            onClick={() => moveZenPage(-1)}
            type="button"
          >
            <span className="hidden rotate-90 text-white lg:block lg:text-lg">
              Trang trước
            </span>
            <ChevronRightIcon className="lg:hidden" />
          </button>
        </main>
      )}

      <nav
        aria-label="Điều khiển reader"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex min-h-11 overflow-hidden border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none md:inset-x-auto md:bottom-5 md:left-10 md:min-h-10 md:w-[min(32rem,calc(100vw-5rem))] md:rounded-md md:border md:pb-0",
          controlsClass
        )}
      >
        <Button
          aria-label="Bình luận"
          className="size-11 rounded-none md:size-10 md:rounded-l-md"
          onClick={() => setSheetOpen(true)}
          variant="default"
          size="icon-lg"
        >
          <MessagesSquareIcon />
        </Button>
        <Button
          aria-label={mode === "zen" ? "Chương sau" : "Chương trước"}
          className="size-11 rounded-none md:size-10"
          aria-busy={loadingDirection === leftDirection}
          disabled={
            loadingDirection !== null ||
            !canNavigateChapter(chapter.navigation[leftDirection])
          }
          onClick={(event) =>
            void openAdjacentChapter(leftDirection, event.currentTarget)
          }
          size="icon-lg"
          variant="secondary"
        >
          {loadingDirection === leftDirection ? (
            <Spinner />
          ) : (
            <ChevronLeftIcon />
          )}
        </Button>
        <Button
          className="relative h-11 min-w-0 flex-1 justify-center overflow-hidden rounded-none px-3 md:h-10"
          onClick={openChapters}
          variant="ghost"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 bg-primary/50"
            style={{ width: `${progress}%` }}
          />
          <span className="relative truncate">
            {readerChapterLabel(chapter)}
          </span>
        </Button>
        <Button
          aria-label={mode === "zen" ? "Chương trước" : "Chương sau"}
          className="size-11 rounded-none md:size-10"
          aria-busy={loadingDirection === rightDirection}
          disabled={
            loadingDirection !== null ||
            !canNavigateChapter(chapter.navigation[rightDirection])
          }
          onClick={(event) =>
            void openAdjacentChapter(rightDirection, event.currentTarget)
          }
          size="icon-lg"
          variant="secondary"
        >
          {loadingDirection === rightDirection ? (
            <Spinner />
          ) : (
            <ChevronRightIcon />
          )}
        </Button>
        <Button
          aria-label="Về đầu chapter"
          className="size-11 rounded-none md:size-10"
          onClick={scrollToStart}
          size="icon-lg"
          variant="secondary"
        >
          <ArrowUpIcon />
        </Button>
      </nav>

      {chapter.manga.isLongStrip ? null : (
        <ReaderModeDialog
          key={`${mode}-${helpOpen}`}
          mode={mode}
          onConfirm={confirmMode}
          onOpenChange={setHelpOpen}
          open={helpOpen}
        />
      )}

      {navigationChoice ? (
        <ChapterReleaseDialog
          title={
            navigationChoice.direction === "next"
              ? "Chương sau"
              : "Chương trước"
          }
          mangaId={chapter.manga.id}
          releases={navigationChoice.releases}
          finalFocus={navigationTrigger}
          onClose={() => setNavigationChoice(null)}
          onNavigate={() => {
            onNavigate()
            setNavigationChoice(null)
          }}
        />
      ) : null}

      <Dialog onOpenChange={setChapterDialogOpen} open={chapterDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Chọn chapter</DialogTitle>
            <DialogDescription>{chapter.manga.title}</DialogDescription>
          </DialogHeader>
          {chapterError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive">{chapterError}</p>
              <Button onClick={() => void loadChapters()} variant="outline">
                Thử lại
              </Button>
            </div>
          ) : chapters ? (
            <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto pr-1">
              {groupChaptersByVolume(chapters.data).map(
                ({ chapters: volumeChapters, volume }) => (
                  <section
                    className="flex flex-col gap-2"
                    key={volume ?? "none"}
                  >
                    <h3 className="font-heading text-sm font-semibold">
                      {volume ? `Volume ${volume}` : "No Volume"}
                    </h3>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {volumeChapters.map((item) => (
                        <Button
                          className="min-w-0"
                          key={item.id}
                          onClick={() => navigateChapter(item.id)}
                          title={readerChapterLabel(item)}
                          variant={
                            item.id === chapter.id ? "default" : "secondary"
                          }
                        >
                          {item.number ?? "Oneshot"}
                        </Button>
                      ))}
                    </div>
                  </section>
                )
              )}
              {chapters.meta.page < chapters.meta.totalPages ? (
                <Button
                  className="mt-4 w-full"
                  onClick={() => void loadChapters(chapters.meta.page + 1)}
                  variant="outline"
                >
                  Tải thêm
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          )}
        </DialogContent>
      </Dialog>

      <Drawer
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        showSwipeHandle={isMobile}
        swipeDirection={isMobile ? "down" : "left"}
      >
        <DrawerContent className="w-full md:w-120">
          <DrawerHeader className="relative flex w-full border-b pb-4 md:flex-row md:items-center md:justify-between">
            <DrawerTitle className="text-lg font-medium">Bình luận</DrawerTitle>
            <DrawerClose
              className="hidden justify-items-center md:block"
              render={
                <Button
                  aria-label="Đóng bình luận"
                  size="icon-sm"
                  variant="outline"
                />
              }
            >
              <XIcon />
            </DrawerClose>
          </DrawerHeader>
          <CommentSection drawer scope="chapter" targetId={chapter.id} />
        </DrawerContent>
      </Drawer>
    </article>
  )
}
