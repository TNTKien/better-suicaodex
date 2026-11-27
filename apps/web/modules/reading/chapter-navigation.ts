import {
  chapterNavigationOptions as sharedChapterNavigationOptions,
  readerChapterIndexOptions as sharedReaderChapterIndexOptions,
  type ChapterNavigationDirection,
} from "@workspace/account/reader-navigation"
import type { components } from "@/src/lib/generated/api"

export {
  canNavigateChapter,
  useAdjacentChapter,
  useChapterPickerScroll,
  type ChapterNavigationDirection,
} from "@workspace/account/reader-navigation"

export function chapterNavigationOptions(
  apiBaseUrl: string,
  chapterId: string,
  direction: ChapterNavigationDirection
) {
  return sharedChapterNavigationOptions<
    components["schemas"]["ChapterSummary"]
  >(apiBaseUrl, chapterId, direction)
}

export function readerChapterIndexOptions(apiBaseUrl: string, mangaId: string) {
  return sharedReaderChapterIndexOptions<
    components["schemas"]["ChapterIndexItem"]
  >(apiBaseUrl, mangaId)
}
