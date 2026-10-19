import {
  libraryListOptions as sharedLibraryListOptions,
  libraryItemOptions as sharedLibraryItemOptions,
  putLibraryItem as sharedPutLibraryItem,
} from "@workspace/account/library-api"
import type { components } from "@/src/lib/generated/api"

export {
  libraryCategories,
  librarySorts,
  libraryTabParser,
  librarySearchParser,
  librarySortParser,
  LibraryApiError,
  libraryItemKey,
  libraryListKey,
  deleteLibraryItem,
} from "@workspace/account/library-api"

export type LibraryCategory = components["schemas"]["LibraryCategory"]
export type LibraryItem = components["schemas"]["LibraryItem"]
export type LibrarySort = components["schemas"]["LibrarySort"]
export type LibraryPage = {
  data: LibraryItem[]
  meta: { limit: number; nextCursor: string | null }
}

export function libraryListOptions(
  apiBaseUrl: string,
  userId: string | null,
  category: LibraryCategory,
  q = "",
  sort: LibrarySort = "addedAt"
) {
  return sharedLibraryListOptions<LibraryPage>(
    apiBaseUrl,
    userId,
    category,
    q,
    sort
  )
}

export function libraryItemOptions(
  apiBaseUrl: string,
  userId: string | null,
  mangaId: string
) {
  return sharedLibraryItemOptions<LibraryItem>(apiBaseUrl, userId, mangaId)
}

export function putLibraryItem(
  apiBaseUrl: string,
  mangaId: string,
  category: LibraryCategory
) {
  return sharedPutLibraryItem<LibraryItem>(apiBaseUrl, mangaId, category)
}
