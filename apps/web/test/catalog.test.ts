import assert from "node:assert/strict"
import { coverSrcSet } from "@workspace/catalog/images"

const coverUrl = "https://images.example.test/covers/manga/cover.512.webp"
const coverCandidates = `${coverUrl.replace(".512.webp", ".256.webp")} 256w, ${coverUrl} 512w`
for (const width of [512, 700, null]) {
  assert.equal(coverSrcSet({ url: coverUrl, width }), coverCandidates)
  assert.equal(
    coverSrcSet({ url: coverUrl.replace(".512.webp", ".256.webp"), width }),
    coverCandidates
  )
}
assert.equal(
  coverSrcSet({ url: coverUrl, width: 400 }),
  `${coverUrl.replace(".512.webp", ".256.webp")} 256w, ${coverUrl} 400w`,
  "Cover variants never upscale the original"
)
for (const width of [200, 256]) {
  assert.equal(
    coverSrcSet({ url: coverUrl, width }),
    `${coverUrl.replace(".512.webp", ".256.webp")} ${width}w`
  )
}
for (const width of [0, -1, NaN, Infinity, 400.5])
  assert.equal(coverSrcSet({ url: coverUrl, width }), undefined)
for (const url of [
  "https://images.example.test/full.webp",
  `${coverUrl}?token=1`,
])
  assert.equal(coverSrcSet({ url, width: 700 }), undefined)
assert.equal(coverSrcSet(null), undefined)
assert.equal(coverSrcSet(undefined), undefined)

import {
  chapterLabel,
  chapterListHref,
  groupChaptersByVolume,
  groupsHref,
  isUuid,
  loadGroupsSearchParams,
  loadMangaSearchParams,
  mangaDetailHref,
  mangaContentRatingLabel,
  mangaStatusLabel,
  parsePageNumber,
  readerChapterLabel,
} from "../lib/catalog"
import {
  formatVietnamDate,
  formatVietnamDateTime,
  formatVietnamDateTimeInline,
} from "../lib/date"
import {
  closestReaderPanelIndex,
  createReaderStore,
  readerImageSource,
  resolveReaderMode,
  zenPageWidth,
  zenPreloadIndexes,
} from "../lib/reader"

const imagePage = {
  position: 0,
  url: "https://s1.test/original.webp",
  optimizedUrl: "https://s1.test/small.webp",
  replicaUrl: null,
  width: 1600,
  height: 2400,
  optimizedWidth: 800,
  optimizedHeight: 1200,
}
assert.deepEqual(readerImageSource(imagePage), {
  src: imagePage.optimizedUrl,
  fallbackSrc: imagePage.url,
  width: 800,
  height: 1200,
  fallbackTimeoutMs: undefined,
})
assert.deepEqual(
  readerImageSource({
    ...imagePage,
    replicaUrl: "https://p21-ad-sg.ibyteimg.com/page",
  }),
  {
    src: "https://p21-ad-sg.ibyteimg.com/page",
    fallbackSrc: imagePage.url,
    width: 1600,
    height: 2400,
    fallbackTimeoutMs: 15_000,
  }
)
assert.equal(
  readerImageSource({ ...imagePage, optimizedUrl: null }).fallbackSrc,
  null
)
import {
  advancedSearchApiUrl,
  advancedSearchHref,
  defaultAdvancedSearchState,
  normalizeAdvancedSearch,
} from "../modules/manga/advanced-search"

const advancedSearch = normalizeAdvancedSearch({
  ...defaultAdvancedSearchState,
  q: "  Wise   Lover ",
  hasChapter: "false",
  includeTag: ["tag-2", "tag-1", "tag-1"],
  excludeTagMode: "and",
  page: 2,
})

const zonedTimestamp = "2026-01-01T18:04:05.000Z"
assert.equal(formatVietnamDate(zonedTimestamp), "02/01/2026")
assert.equal(formatVietnamDateTime(zonedTimestamp), "01:04 - 02/01/2026")
assert.equal(formatVietnamDateTimeInline(zonedTimestamp), "02/01/2026 01:04")

assert.deepEqual(advancedSearch.includeTag, ["tag-1", "tag-2"])
assert.equal(advancedSearch.q, "Wise Lover")
assert.equal(
  advancedSearchHref(advancedSearch, 3),
  "/advanced-search?q=Wise+Lover&hasChapter=false&includeTag=tag-1,tag-2&excludeTagMode=and&page=3"
)
const advancedApiUrl = advancedSearchApiUrl(
  "https://api.example.com",
  advancedSearch
)
assert.deepEqual(advancedApiUrl.searchParams.getAll("includeTag"), [
  "tag-1",
  "tag-2",
])
assert.equal(advancedApiUrl.searchParams.get("includeTagMode"), "and")
assert.equal(advancedApiUrl.searchParams.get("excludeTagMode"), "and")
assert.equal(advancedApiUrl.searchParams.get("hasChapter"), "false")

assert.equal(
  chapterLabel({ number: "9.5", title: null, volume: "2" }),
  "Tập 2 · Chương 9.5"
)
assert.equal(
  chapterLabel({ number: null, title: "Ngoại truyện", volume: null }),
  "Oneshot - Ngoại truyện"
)
assert.equal(
  readerChapterLabel({ number: "1", title: "Tên chapter", volume: "1" }),
  "Vol. 1 - Ch. 1 - Tên chapter"
)
assert.equal(
  readerChapterLabel({ number: "2", title: null, volume: null }),
  "Ch. 2"
)
assert.equal(
  readerChapterLabel({ number: null, title: null, volume: null }),
  "Oneshot"
)
assert.equal(mangaStatusLabel("completed"), "Đã hoàn thành")
assert.equal(mangaStatusLabel(null), "Chưa rõ trạng thái")
assert.equal(mangaContentRatingLabel("safe"), "Mọi độ tuổi")
assert.equal(isUuid("bee2571b-a75b-4284-a64e-b2f56ddd767e"), true)
assert.equal(isUuid("1gxujbvdyj"), false)
assert.equal(parsePageNumber("2"), 2)
assert.equal(parsePageNumber(["3", "4"]), 3)
assert.equal(parsePageNumber("0"), 1)
assert.equal(parsePageNumber("invalid"), 1)
assert.deepEqual(
  loadMangaSearchParams({ direction: "asc", page: "2", tab: "comments" }),
  { direction: "asc", page: 2, tab: "comments" }
)
assert.deepEqual(
  loadMangaSearchParams({ direction: "invalid", page: "0", tab: "invalid" }),
  { direction: "desc", page: 1, tab: "chapters" }
)
assert.deepEqual(loadGroupsSearchParams({ q: "Sunna", page: "2" }), {
  q: "Sunna",
  page: 2,
})
assert.equal(groupsHref("Sunna", 2), "/groups?q=Sunna&page=2")
assert.equal(groupsHref("", 1), "/groups")
assert.equal(
  chapterListHref({ id: "manga-id", slug: "manga-slug" }, 1, "desc"),
  "/manga/manga-id/manga-slug"
)
assert.equal(
  chapterListHref({ id: "manga-id", slug: "manga-slug" }, 2, "asc"),
  "/manga/manga-id/manga-slug?page=2&direction=asc"
)
assert.equal(
  mangaDetailHref(
    { id: "manga-id", slug: "manga-slug" },
    { direction: "asc", page: 2, tab: "comments" }
  ),
  "/manga/manga-id/manga-slug?page=2&direction=asc&tab=comments"
)

assert.deepEqual(
  groupChaptersByVolume([
    { id: "3", volume: "2" },
    { id: "2", volume: "2" },
    { id: "1", volume: null },
  ]),
  [
    {
      volume: "2",
      chapters: [
        { id: "3", volume: "2" },
        { id: "2", volume: "2" },
      ],
    },
    { volume: null, chapters: [{ id: "1", volume: null }] },
  ]
)

assert.deepEqual(zenPreloadIndexes(10, 5), [6, 7, 4])
assert.deepEqual(zenPreloadIndexes(3, 0), [1, 2])
assert.equal(resolveReaderMode("zen", true), "classic")
assert.equal(resolveReaderMode("zen", false), "zen")
assert.equal(zenPageWidth(1800, 1000), "min(100vw, 180dvh)")
assert.equal(zenPageWidth(1000, 1800), undefined)
assert.equal(
  closestReaderPanelIndex(
    [
      { left: -100, width: 100 },
      { left: 0, width: 100 },
      { left: 100, width: 100 },
    ],
    50
  ),
  1
)

const readerStore = createReaderStore()
readerStore.getState().setCurrentPage("chapter", 10, 5)
assert.equal(readerStore.getState().currentPage, 5)
readerStore.getState().setCurrentPage("chapter", 10, 99)
assert.equal(readerStore.getState().currentPage, 9)
