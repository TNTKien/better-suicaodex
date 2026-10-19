"use client"

import { primaryWebOrigin } from "@workspace/catalog/origins"


import { PrefetchLink } from "@workspace/ui/components/prefetch-link"

import { LoaderCircleIcon, SearchIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import {
  handleSearchKeys,
  MangaSearchError,
  useMangaQuickSearch,
} from "@workspace/catalog/search"
import { cover256 } from "@workspace/catalog/images"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { getApiBaseUrl } from "@/lib/api-url"
import type { components } from "@/src/lib/generated/api"

type MangaList = components["schemas"]["MangaList"]
const statusLabels: Record<string, string> = {
  completed: "Kết thúc.",
  ongoing: "Đang tiến hành.",
  hiatus: "Tạm ngưng.",
  cancelled: "Đã hủy.",
}

export function QuickSearchResults({
  hasQuery,
  query,
  loading,
  paused,
  error,
  data,
  onRetry,
  onResultClick,
}: {
  hasQuery: boolean
  query: string
  loading: boolean
  paused: boolean
  error: Error | null
  data: MangaList | undefined
  onRetry: () => void
  onResultClick: () => void
}) {
  if (!hasQuery) {
    return (
      <p className="p-3 text-sm text-[#888888]">Nhập tên truyện để tìm kiếm.</p>
    )
  }
  if (paused || error) {
    return (
      <Empty className="gap-3 p-3">
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
          size="sm"
          variant="secondary"
          disabled={paused}
          onClick={onRetry}
        >
          Thử lại
        </Button>
      </Empty>
    )
  }
  if (loading) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-1 p-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3 p-2">
            <Skeleton className="h-18 w-12 shrink-0 motion-reduce:animate-none" />
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
      <Empty className="p-3">
        <EmptyHeader>
          <EmptyDescription>Không tìm thấy truyện nào.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const advancedSearch = new URL("/advanced-search", primaryWebOrigin)
  advancedSearch.searchParams.set("q", query.trim())
  return (
    <>
      <ul className="flex flex-col p-1">
        {data.data.map((manga) => (
          <li key={manga.id}>
            <PrefetchLink
              href={`/manga/${manga.id}/${manga.slug}`}
              data-search-result
              className="flex min-w-0 items-center gap-3 border-b border-[#444444] p-2 text-sm text-[#00bfff] outline-none hover:bg-[#444444] hover:text-white focus-visible:bg-[#444444] focus-visible:text-white"
              onClick={(event) => {
                event.currentTarget.blur()
                onResultClick()
              }}
            >
              <span className="h-18 w-12 shrink-0 overflow-hidden border border-white/35">
                <AssetImage
                  key={manga.cover?.url}
                  src={cover256(manga.cover?.url ?? null)}
                  alt={`Bìa ${manga.title}`}
                  width={48}
                  height={72}
                  className="size-full object-cover p-0"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 leading-snug font-bold">
                  {manga.title}
                </span>
                <span className="truncate text-xs text-[#888888]">
                  {manga.authors.map(({ name }) => name).join(", ") ||
                    "Chưa rõ tác giả"}
                </span>
                <span className="truncate text-xs text-[#888888]">
                  {manga.status
                    ? (statusLabels[manga.status] ?? manga.status)
                    : "Chưa rõ trạng thái"}
                  {manga.year ? ` · ${manga.year}` : ""}
                </span>
              </span>
            </PrefetchLink>
          </li>
        ))}
      </ul>
      <a
        href={advancedSearch.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onResultClick}
        className="sticky bottom-0 block bg-[#111111] px-3 py-2 text-center text-sm font-bold text-[#00bfff] hover:bg-[#444444] hover:text-white focus-visible:bg-[#444444] focus-visible:text-white"
      >
        Xem tất cả {data.meta.total.toLocaleString("vi-VN")} kết quả
      </a>
    </>
  )
}

export function QuickSearch({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()
  const { query, setQuery, setComposing, searchQuery, search, loading } =
    useMangaQuickSearch<MangaList>(getApiBaseUrl(), open)
  const busy = loading && !search.isPaused && !search.isError

  return (
    <div
      className="relative w-full min-w-0"
      data-quick-search
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={handleSearchKeys}
    >
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Tìm kiếm..."
          aria-label="Tìm kiếm nhanh manga"
          aria-controls={open ? resultsId : undefined}
          aria-expanded={open}
          autoCapitalize="none"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={160}
          spellCheck={false}
          className={
            mobile
              ? "hvn-search-input h-9 rounded-[6px]!"
              : "hvn-search-input h-8"
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
        />
        {!mobile ? (
          <Button
            type="button"
            className="hvn-search-submit h-8"
            aria-label="Tìm kiếm"
            onClick={(event) => {
              const first = event.currentTarget
                .closest("[data-quick-search]")
                ?.querySelector<HTMLAnchorElement>("a[data-search-result]")
              if (first) first.click()
              else inputRef.current?.focus()
            }}
          >
            {busy ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <SearchIcon aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div
          id={resultsId}
          role="region"
          aria-label="Kết quả tìm kiếm nhanh"
          aria-live="polite"
          aria-busy={busy}
          className="absolute top-full right-0 z-50 mt-1 max-h-[65dvh] w-full overflow-y-auto overscroll-contain border border-[#666666] bg-[#111111] text-white shadow-lg md:w-96"
        >
          <QuickSearchResults
            hasQuery={Boolean(searchQuery)}
            query={query}
            loading={loading}
            paused={search.isPaused}
            error={search.error}
            data={search.data}
            onRetry={() => void search.refetch()}
            onResultClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
