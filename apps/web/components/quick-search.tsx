"use client"

import { PrefetchLink } from "@workspace/ui/components/prefetch-link"

import Link from "next/link"
import { ChevronRightIcon, LoaderCircleIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import {
  handleSearchKeys,
  useMangaQuickSearch,
} from "@workspace/catalog/search"

import { AssetImage } from "@/components/asset-image"
import type { MangaList } from "@/lib/api"
import { cover256, mangaStatusLabel } from "@/lib/catalog"
import { MangaSearchError } from "@/modules/manga/search"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

function SearchField({
  autoFocus = false,
  controls,
  loading,
  query,
  setQuery,
  setComposing,
}: {
  autoFocus?: boolean
  controls: string
  loading: boolean
  query: string
  setQuery: (query: string) => void
  setComposing: (composing: boolean) => void
}) {
  return (
    <InputGroup className="h-8 bg-secondary focus-within:bg-background hover:bg-background">
      <InputGroupInput
        aria-controls={controls}
        aria-label="Tìm kiếm nhanh manga"
        autoCapitalize="none"
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={160}
        onChange={(event) => setQuery(event.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        placeholder="Tìm kiếm..."
        spellCheck={false}
        type="search"
        value={query}
      />
      <InputGroupAddon align="inline-end">
        {loading ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <SearchIcon aria-hidden="true" />
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

function SearchResults({
  hasQuery,
  query,
  loading,
  paused,
  error,
  onRetry,
  onResultClick,
  data,
}: {
  hasQuery: boolean
  query: string
  loading: boolean
  paused: boolean
  error: Error | null
  onRetry: () => void
  onResultClick?: () => void
  data: MangaList | undefined
}) {
  if (!hasQuery) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        Nhập gì đi mới tìm được chứ!!
      </p>
    )
  }

  if (paused || error) {
    return (
      <Empty className="gap-3 px-2 py-4">
        <EmptyHeader>
          <EmptyDescription>
            {paused
              ? "Bạn đang ngoại tuyến. Kết nối mạng để tiếp tục tìm kiếm."
              : error instanceof MangaSearchError
                ? error.message
                : "Có lỗi xảy ra, vui lòng thử lại sau."}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          onClick={(event) => {
            event.currentTarget
              .closest("[data-quick-search]")
              ?.querySelector("input")
              ?.focus()
            onRetry()
          }}
          size="sm"
          variant="outline"
          disabled={paused}
        >
          Thử lại
        </Button>
      </Empty>
    )
  }

  if (loading) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-1">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3 p-2">
            <Skeleton className="h-18 w-12 shrink-0 rounded-sm motion-reduce:animate-none" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-2/3 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data?.data.length) {
    return (
      <Empty className="px-2 py-4">
        <EmptyHeader>
          <EmptyDescription>Không tìm thấy truyện nào.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      {/* <p className="px-2 py-1 text-xs text-muted-foreground">
        {data.data.length} / {data.meta.total} kết quả
      </p> */}
      <div className="px-2 pt-2">
        <ul className="flex flex-col gap-1">
          {data.data.map((manga) => (
            <li key={manga.id}>
              <PrefetchLink
                className="flex min-w-0 items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                data-search-result
                href={`/manga/${manga.id}/${manga.slug}`}
                onClick={(event) => {
                  event.currentTarget.blur()
                  onResultClick?.()
                }}
              >
                <span className="h-18 w-12 shrink-0 overflow-hidden rounded-sm">
                  <AssetImage
                    key={manga.cover?.url}
                    alt={`Bìa ${manga.title}`}
                    className="h-full w-full object-cover p-0 [&_span]:sr-only"
                    height={72}
                    width={48}
                    src={cover256(manga.cover?.url ?? null)}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2 leading-snug font-medium">
                    {manga.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {manga.authors.map(({ name }) => name).join(", ") ||
                      "Chưa rõ tác giả"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {mangaStatusLabel(manga.status)}
                    {manga.year ? ` · ${manga.year}` : ""}
                  </span>
                </span>
              </PrefetchLink>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 w-full bg-popover py-2">
          {/* <Button variant="secondary" className="w-full">
            Xem tất cả {data.meta.total} kết quả
          </Button> */}
          <Link
            href={{ pathname: "/advanced-search", query: { q: query.trim() } }}
            prefetch={false}
            onClick={(event) => {
              event.currentTarget.blur()
              onResultClick?.()
            }}
            className={buttonVariants({
              variant: "secondary",
              className: "w-full justify-between!",
            })}
          >
            Xem tất cả {data.meta.total} kết quả
            <ChevronRightIcon />
          </Link>
        </div>
      </div>
    </>
  )
}

export function QuickSearch({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(false)
  const { query, setQuery, setComposing, searchQuery, search, loading } =
    useMangaQuickSearch<MangaList>(apiBaseUrl, mobileOpen || desktopOpen)
  const resultsProps = {
    hasQuery: Boolean(searchQuery),
    query,
    loading,
    paused: search.isPaused,
    error: search.error,
    data: search.data,
    onRetry: () => void search.refetch(),
  }
  const fieldProps = {
    query,
    setQuery,
    setComposing,
    loading:
      (mobileOpen || desktopOpen) &&
      loading &&
      !search.isPaused &&
      !search.isError,
  }

  return (
    <div className="shrink-0">
      <Dialog onOpenChange={setMobileOpen} open={mobileOpen}>
        <DialogTrigger
          render={
            <Button
              aria-label="Mở tìm kiếm nhanh"
              className="sm:hidden"
              size="icon-sm"
              title="Tìm kiếm nhanh"
              variant="outline"
            />
          }
        >
          <SearchIcon aria-hidden="true" />
        </DialogTrigger>
        <DialogContent
          className="top-[10dvh] translate-y-0 gap-3 p-2"
          data-quick-search
          onKeyDown={handleSearchKeys}
          showCloseButton={false}
        >
          <SearchField
            autoFocus
            controls="mobile-quick-search-results"
            {...fieldProps}
          />
          <div
            aria-label="Kết quả tìm kiếm nhanh"
            aria-live="polite"
            aria-busy={loading && !search.isPaused && !search.isError}
            className="overflow-y-auto overscroll-contain rounded-md border p-0"
            id="mobile-quick-search-results"
            role="region"
          >
            <SearchResults
              {...resultsProps}
              onResultClick={() => setMobileOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative hidden h-9 sm:block sm:w-44 md:w-56">
        <div
          className="group/quick-search absolute top-0.5 right-0 w-full transition-[width] duration-200 ease-out focus-within:z-10 focus-within:w-80 motion-reduce:transition-none md:focus-within:w-96 lg:focus-within:w-lg"
          data-quick-search
          onFocus={() => setDesktopOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setDesktopOpen(false)
          }}
          onKeyDown={handleSearchKeys}
        >
          <SearchField
            controls="desktop-quick-search-results"
            {...fieldProps}
          />
          <div
            aria-label="Kết quả tìm kiếm nhanh"
            aria-live="polite"
            aria-busy={loading && !search.isPaused && !search.isError}
            className="invisible absolute top-full right-0 mt-2 max-h-[80dvh] w-full translate-y-1 overflow-y-auto overscroll-contain rounded-md border bg-popover text-popover-foreground opacity-0 shadow-lg transition-[opacity,transform,visibility] group-focus-within/quick-search:visible group-focus-within/quick-search:translate-y-0 group-focus-within/quick-search:opacity-100 motion-reduce:transition-none"
            id="desktop-quick-search-results"
            role="region"
          >
            {desktopOpen && !mobileOpen ? (
              <SearchResults {...resultsProps} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
