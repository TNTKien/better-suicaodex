"use client"

import { useEffect, useState } from "react"
import { useDebouncedCallback } from "@mantine/hooks"
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useQueryState } from "nuqs"
import { toast } from "@workspace/ui/components/toast"
import {
  deleteLibraryItem,
  LibraryApiError,
  libraryItemKey,
  libraryListKey,
  libraryListOptions,
  librarySearchParser,
  librarySortParser,
  libraryTabParser,
} from "./library-api"

type LibraryPage = {
  data: { manga: { id: string } }[]
  meta: { limit: number; nextCursor: string | null }
}

export function useLibrary<T extends LibraryPage>(
  apiBaseUrl: string,
  userId: string | null
) {
  const [category, setCategory] = useQueryState("tab", libraryTabParser)
  const [search, setSearch] = useQueryState("q", librarySearchParser)
  const [sort, setSort] = useQueryState("sort", librarySortParser)
  const [searchInput, setSearchInput] = useState({
    query: search,
    value: search,
  })
  const updateSearch = useDebouncedCallback((value: string) => {
    const normalized = value.trim().replace(/\s+/g, " ")
    if (normalized !== search) void setSearch(normalized)
  }, 300)
  if (searchInput.query !== search)
    setSearchInput({ query: search, value: search })
  const queryClient = useQueryClient()
  const library = useInfiniteQuery(
    libraryListOptions<T>(apiBaseUrl, userId, category, search, sort)
  )
  const items: T["data"] = library.data?.pages.flatMap(({ data }) => data) ?? []

  useEffect(() => updateSearch.cancel(), [search, updateSearch])

  const remove = useMutation({
    mutationFn: async (mangaId: string) => {
      if (!userId) throw new LibraryApiError(401)
      await deleteLibraryItem(apiBaseUrl, mangaId)
    },
    onSuccess: (_, mangaId) => {
      queryClient.setQueryData<InfiniteData<T>>(
        libraryListKey(apiBaseUrl, userId, category, search, sort),
        (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  data: page.data.filter(({ manga }) => manga.id !== mangaId),
                })),
              }
            : data
      )
      queryClient.setQueryData(
        libraryItemKey(apiBaseUrl, userId, mangaId),
        null
      )
      void queryClient.invalidateQueries({
        queryKey: ["library", apiBaseUrl, userId, "list"],
      })
      toast.add({ type: "success", title: "Đã xóa khỏi thư viện" })
    },
    onError: (error) => {
      if (error instanceof LibraryApiError && error.status === 401)
        void queryClient.invalidateQueries({ queryKey: ["account"] })
      toast.add({
        type: "error",
        title: "Không thể xóa khỏi thư viện. Vui lòng thử lại.",
      })
    },
  })

  return {
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
  }
}
