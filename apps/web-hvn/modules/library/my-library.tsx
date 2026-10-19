"use client"

import Link from "next/link"
import {
  LibraryBigIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { useLibrary } from "@workspace/account/library"
import { LibraryMangaRow } from "./manga-row"
import type { components } from "@/src/lib/generated/api"
import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  type LibraryCategory,
  type LibrarySort,
  libraryCategories,
  LibraryApiError,
  librarySorts,
} from "@workspace/account/library-api"

type LibraryPage = {
  data: components["schemas"]["LibraryItem"][]
  meta: { limit: number; nextCursor: string | null }
}

export function MyLibrary() {
  const { apiBaseUrl, retry, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const {
    category,
    setCategory,
    search,
    sort,
    setSort,
    searchInput,
    setSearchInput,
    updateSearch,
    library,
    items,
    remove,
  } = useLibrary<LibraryPage>(apiBaseUrl, userId)

  return status === "guest" ||
    (library.error instanceof LibraryApiError &&
      library.error.status === 401) ? (
    <Alert className="rounded-none border-[#666666] bg-[#111111]">
      <AlertTitle>Bạn chưa đăng nhập</AlertTitle>
      <AlertDescription>
        Đăng nhập để xem thư viện truyện của bạn.
      </AlertDescription>
      <Button
        className="hvn-button mt-3 w-fit"
        nativeButton={false}
        render={<Link href={loginHref("/my-library")} />}
      >
        Đăng nhập
      </Button>
    </Alert>
  ) : status === "error" ? (
    <LibraryError onRetry={() => void retry()} />
  ) : (
    <Tabs
      className="flex-col gap-4 md:flex-row"
      orientation="vertical"
      value={category}
      onValueChange={(value) => void setCategory(value as LibraryCategory)}
    >
      <div className="md:hidden">
        <Select
          items={libraryCategories}
          value={category}
          onValueChange={(value) => void setCategory(value as LibraryCategory)}
        >
          <SelectTrigger
            className="hvn-library-select h-11 w-full"
            aria-label="Danh mục thư viện"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {libraryCategories.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden w-48 shrink-0 flex-col gap-2 md:flex">
        <TabsList className="hvn-library-tabs w-full">
          {libraryCategories.map(({ label, value }) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <InputGroup className="hvn-library-input">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Tìm trong thư viện"
              autoComplete="off"
              placeholder="Tìm kiếm..."
              type="search"
              value={searchInput.value}
              onChange={(event) => {
                const value = event.target.value
                setSearchInput({ query: search, value })
                updateSearch(value)
              }}
            />
            {library.isFetching &&
            !library.isPending &&
            !library.isFetchingNextPage ? (
              <InputGroupAddon align="inline-end">
                <Spinner aria-label="Đang tìm trong thư viện" />
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <Select
            items={librarySorts}
            value={sort}
            onValueChange={(value) => void setSort(value as LibrarySort)}
          >
            <SelectTrigger
              className="hvn-library-select w-full"
              aria-label="Sắp xếp thư viện"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {librarySorts.map(({ label, value }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {libraryCategories.map(({ label, value }) => (
          <TabsContent
            aria-label={label}
            className="min-w-0"
            key={value}
            value={value}
          >
            {value !== category ? null : status === "loading" ||
              library.isPending ? (
              <LibraryLoading />
            ) : library.isError && items.length === 0 ? (
              <LibraryError onRetry={() => void library.refetch()} />
            ) : items.length === 0 ? (
              <Empty className="rounded-none border border-white/35">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LibraryBigIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {search
                      ? `Không tìm thấy truyện “${search}”`
                      : `Chưa có truyện trong mục ${label}`}
                  </EmptyTitle>
                  <EmptyDescription>
                    {search
                      ? "Thử tìm bằng tên hoặc tên khác của truyện."
                      : "Thêm truyện từ trang chi tiết để quản lý tại đây."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {items.map(({ manga }) => {
                    const isRemoving =
                      remove.isPending && remove.variables === manga.id

                    return (
                      <div className="relative" key={manga.id}>
                        <LibraryMangaRow manga={manga} />
                        <Button
                          aria-label={`Xóa ${manga.title} khỏi thư viện`}
                          className="absolute top-2 right-2 rounded-none border border-[#666666] bg-[#eaeaea] text-[#455a64] hover:bg-white"
                          disabled={isRemoving}
                          size="icon-sm"
                          title="Xóa khỏi thư viện"
                          variant="secondary"
                          onClick={() => remove.mutate(manga.id)}
                        >
                          {isRemoving ? (
                            <Spinner />
                          ) : (
                            <Trash2Icon aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
                {library.hasNextPage ? (
                  <Button
                    className="hvn-button self-center"
                    variant="outline"
                    disabled={library.isFetchingNextPage}
                    onClick={() => void library.fetchNextPage()}
                  >
                    {library.isFetchingNextPage ? (
                      <Spinner data-icon="inline-start" />
                    ) : null}
                    {library.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
                  </Button>
                ) : null}
              </div>
            )}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

function LibraryError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert
      variant="destructive"
      className="rounded-none border-[#666666] bg-[#111111]"
    >
      <AlertTitle>Chưa tải được thư viện</AlertTitle>
      <AlertDescription>Kiểm tra kết nối và thử lại.</AlertDescription>
      <Button
        className="hvn-button mt-3 w-fit"
        variant="outline"
        onClick={onRetry}
      >
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Thử lại
      </Button>
    </Alert>
  )
}

export function LibraryLoading() {
  return (
    <div className="flex min-h-48 items-center justify-center">
      <Spinner className="size-6" aria-label="Đang tải thư viện" />
    </div>
  )
}
