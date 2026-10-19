import {
  chapterNavigationOptions as sharedChapterNavigationOptions,
  type ChapterNavigationDirection,
} from "@workspace/account/reader-navigation"
import type { components } from "@/src/lib/generated/api"

export {
  canNavigateChapter,
  useAdjacentChapter,
  loadReaderChapters,
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
