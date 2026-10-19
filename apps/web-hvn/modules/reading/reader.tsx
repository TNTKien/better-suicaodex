"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { preconnect } from "react-dom"
import { ChevronDownIcon, InfoIcon } from "lucide-react"
import { loginHref } from "@workspace/account/api"
import { useReaderProgress } from "@workspace/account/reader-progress"
import { useChapterView } from "@workspace/account/chapter-view"
import {
  readerPageFromHash,
  saveReaderPage,
} from "@workspace/account/reader-position"
import {
  useAdjacentChapter,
  canNavigateChapter,
  type ChapterNavigationDirection,
} from "@workspace/account/reader-navigation"
import { readerImageSource } from "@workspace/catalog/images"
import { mangaDetailHref } from "@workspace/catalog/manga-routing"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Button } from "@workspace/ui/components/button"

import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import type { components } from "@/src/lib/generated/api"
import { BackToTop } from "@/components/back-to-top"
import { useAccount } from "@/modules/account/provider"
import { LazyCommentSection } from "@/modules/comments/lazy-comment-section"
import { ReaderChapterDialog } from "./reader-chapter-dialog"
import { ChapterReleaseDialog } from "./chapter-release-dialog"

type ChapterDetail = components["schemas"]["ChapterDetail"]
type AdjacentChapter = ReturnType<
  typeof useAdjacentChapter<components["schemas"]["ChapterSummary"]>
>
const countFormat = new Intl.NumberFormat("vi-VN")

function chapterTitle(chapter: Pick<ChapterDetail, "number" | "title">) {
  return `${chapter.number ? `Chap ${chapter.number}` : "Oneshot"}${chapter.title ? `: ${chapter.title}` : ""}`
}

function ChapterNavigation({
  chapter,
  adjacent,
  onOpenChapters,
}: {
  chapter: ChapterDetail
  adjacent: AdjacentChapter
  onOpenChapters: (element: HTMLElement) => void
}) {
  const arrow = (direction: ChapterNavigationDirection) => (
    <Button
      className="hvn-reader-arrow shrink-0"
      aria-label={direction === "previous" ? "Chương trước" : "Chương sau"}
      aria-busy={adjacent.loading === direction}
      disabled={
        adjacent.loading !== null ||
        !canNavigateChapter(chapter.navigation[direction])
      }
      onClick={(event) =>
        void adjacent.openAdjacentChapter(direction, event.currentTarget)
      }
    >
      {adjacent.loading === direction ? (
        <Spinner />
      ) : (
        <AssetImage
          src={
            direction === "previous" ? "/brand/prev.webp" : "/brand/next.webp"
          }
          alt=""
          width={32}
          height={32}
          eager
          className="size-8 object-contain"
        />
      )}
    </Button>
  )
  return (
    <nav
      aria-label="Chuyển chương"
      className="flex items-center justify-center gap-3 py-5"
    >
      {arrow("previous")}
      <Button
        className="hvn-reader-picker w-68 max-w-[calc(100%-7rem)] min-w-0 justify-between"
        aria-haspopup="dialog"
        onClick={(event) => onOpenChapters(event.currentTarget)}
      >
        <span className="truncate">{chapterTitle(chapter)}</span>
        <ChevronDownIcon data-icon="inline-end" />
      </Button>
      {arrow("next")}
    </nav>
  )
}

export function Reader({
  chapter,
  statistics,
}: {
  chapter: ChapterDetail
  statistics: Pick<
    components["schemas"]["MangaDetail"]["statistics"],
    "follows" | "comments"
  >
}) {
  const router = useRouter()
  const { apiBaseUrl, status, user } = useAccount()
  const pagesRef = useRef<HTMLDivElement>(null)
  const pickerTrigger = useRef<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pageCount = chapter.pages.length
  const hydrate = useCallback((_chapterId: string, count: number) => {
    const page = readerPageFromHash(window.location.hash, count)
    if (/^#page-\d+$/.test(window.location.hash)) {
      pagesRef.current
        ?.querySelector<HTMLElement>(`[data-reader-page="${page}"]`)
        ?.scrollIntoView()
    }
    saveReaderPage(count, page)
    setReady(true)
    return page
  }, [])
  const { flush } = useReaderProgress({
    apiBaseUrl,
    status,
    userId: status === "authenticated" ? (user?.id ?? null) : null,
    chapter,
    hydrate,
    ready,
  })
  const onNavigate = () => void flush(true)
  const navigate = useCallback(
    (id: string) => {
      void flush(true)
      router.push(`/chapter/${id}`)
    },
    [flush, router]
  )
  const adjacent = useAdjacentChapter<components["schemas"]["ChapterSummary"]>({
    apiBaseUrl,
    chapterId: chapter.id,
    navigation: chapter.navigation,
    navigate,
  })
  useChapterView({
    activePage: true,
    apiBaseUrl,
    chapterId: chapter.id,
    currentPage: 0,
    mode: "classic",
    pageCount,
    pagesRef,
    ready,
  })
  useEffect(() => {
    if (!ready) return
    const nodes =
      pagesRef.current?.querySelectorAll<HTMLElement>("[data-reader-page]")
    if (!nodes?.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible)
          saveReaderPage(
            pageCount,
            Number(visible.target.getAttribute("data-reader-page"))
          )
      },
      { rootMargin: "-50% 0px -49%", threshold: 0 }
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [pageCount, ready])
  const firstPage = chapter.pages[0]
  if (firstPage) preconnect(new URL(readerImageSource(firstPage).src).origin)
  const openChapters = (element: HTMLElement) => {
    pickerTrigger.current = element
    setPickerOpen(true)
  }
  const mangaHref = mangaDetailHref(chapter.manga)
  return (
    <article className="min-w-0">
      <nav aria-label="Breadcrumb" className="mb-2 px-2 text-sm text-[#00bfff]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:underline" onNavigate={onNavigate}>
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true" className="text-white">
            /
          </li>
          <li>
            <Link
              href="/latest"
              className="hover:underline"
              onNavigate={onNavigate}
            >
              Danh sách
            </Link>
          </li>
          <li aria-hidden="true" className="text-white">
            /
          </li>
          <li className="min-w-0 wrap-break-word">
            <Link
              href={mangaHref}
              className="hover:underline"
              prefetch={false}
              onNavigate={onNavigate}
            >
              {chapter.manga.title}
            </Link>
          </li>
          <li aria-hidden="true" className="text-white">
            /
          </li>
          <li aria-current="page" className="min-w-0 wrap-break-word">
            {chapterTitle(chapter)}
          </li>
        </ol>
      </nav>
      <h1 className="bg-[#795548] px-3 py-1 text-lg font-bold">
        Xem thông tin:{" "}
        <Link
          href={mangaHref}
          className="text-[#00bfff] hover:underline"
          prefetch={false}
          onNavigate={onNavigate}
        >
          {chapter.manga.title}
        </Link>
      </h1>
      <div className="flex flex-col items-center gap-4 px-2 pt-3">
        <Alert className="hvn-reader-notice w-fit max-w-full">
          <InfoIcon aria-hidden="true" />
          <AlertDescription>
            Nếu truyện tải chậm, lỗi ảnh thì hãy nhấn đổi{" "}
            <strong>Server 1 và 2</strong>. Nếu die ảnh thì nhấn Báo lỗi nhé!
          </AlertDescription>
        </Alert>
        <div
          className="flex flex-wrap justify-center gap-1.5"
          aria-label="Server ảnh và báo lỗi"
        >
          {["Server 1", "Server 2", "Server Full HD", "Báo lỗi"].map(
            (label) => (
              <Button
                key={label}
                className="hvn-reader-server px-3 py-1.5"
                aria-disabled="true"
              >
                {label}
              </Button>
            )
          )}
        </div>
      </div>
      <ChapterNavigation
        chapter={chapter}
        adjacent={adjacent}
        onOpenChapters={openChapters}
      />
      {pageCount ? (
        <div ref={pagesRef} role="list" aria-label="Các trang truyện">
          {chapter.pages.map((page, index) => (
            <div
              key={`${chapter.pagesVersion}:${page.url}`}
              role="listitem"
              data-reader-page={index}
              className={cn(
                "relative mx-auto flex w-full max-w-7xl justify-center",
                chapter.manga.isLongStrip ? "px-0" : "mb-6 px-2"
              )}
            >
              <AssetImage
                {...readerImageSource(page)}
                alt={`Trang ${index + 1} của ${chapterTitle(chapter)}`}
                className="h-auto max-w-full"
                eager={index === 0}
                loading={index < 2 ? "eager" : "lazy"}
                priority={index === 0 ? "high" : "auto"}
                retry
                fadeIn
                showSpinner={ready}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="py-16 text-center">
          Chapter chưa có trang ảnh. Hãy chọn một chapter khác.
        </p>
      )}
      <ChapterNavigation
        chapter={chapter}
        adjacent={adjacent}
        onOpenChapters={openChapters}
      />
      <div className="mb-6 flex flex-col items-center gap-4 px-2 text-center">
        <div className="flex items-center justify-center gap-6">
          {(["follows", "comments"] as const).map((kind) => (
            <span
              key={kind}
              className="flex items-center gap-1"
              title={kind === "follows" ? "Lượt theo dõi" : "Bình luận"}
            >
              <AssetImage
                src={
                  kind === "follows" ? "/brand/like.webp" : "/brand/dis.webp"
                }
                alt={kind === "follows" ? "Lượt theo dõi" : "Bình luận"}
                width={40}
                height={40}
                className="size-10 object-contain"
              />
              {statistics[kind] > 0
                ? countFormat.format(statistics[kind])
                : null}
            </span>
          ))}
        </div>
        <p>
          Xem truyện nếu thấy hay thì hãy theo dõi và bình luận để ủng hộ nhóm
          dịch!
          {status === "guest" ? (
            <>
              <br />•{" "}
              <Link
                href={loginHref(`/chapter/${chapter.id}`)}
                className="text-[#00bfff] hover:underline"
              >
                Đăng nhập
              </Link>{" "}
              để theo dõi truyện và bình luận.
            </>
          ) : null}
        </p>
      </div>
      <LazyCommentSection
        scope="chapter"
        targetId={chapter.id}
        key={chapter.id}
      />
      <BackToTop />
      <ReaderChapterDialog
        apiBaseUrl={apiBaseUrl}
        chapter={chapter}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        finalFocus={pickerTrigger}
        onChoose={(id) => {
          setPickerOpen(false)
          navigate(id)
        }}
      />
      {adjacent.choice ? (
        <ChapterReleaseDialog
          title={
            adjacent.choice.direction === "next" ? "Chương sau" : "Chương trước"
          }
          releases={adjacent.choice.releases}
          finalFocus={adjacent.trigger}
          onClose={() => adjacent.setChoice(null)}
          onNavigate={onNavigate}
        />
      ) : null}
    </article>
  )
}
