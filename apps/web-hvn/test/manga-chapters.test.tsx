import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"
import type { components } from "../src/lib/generated/api"
import { MangaChapters } from "../modules/manga/manga-chapters"

type Chapter = components["schemas"]["ChapterSummary"]
type ChapterList = components["schemas"]["ChapterList"]
const chapter: Chapter = {
  id: "native-18",
  number: "18",
  title: "Bản C <script>",
  volume: "2",
  language: "vi",
  isDefault: true,
  publishedAt: "2026-09-01T18:04:05Z",
  pageCount: 20,
  groups: [{ id: "group", name: "Nhóm dịch", slug: "nhom-dich" }],
  uploader: { id: "uploader", name: "Người đăng C" },
  statistics: { views: 12345, comments: 6789 },
}
const manga = { id: "manga", slug: "ten-truyen" }
const slot: ChapterList["slots"][number] = {
  key: "opaque-18",
  language: "vi",
  number: "18",
  volume: null,
  automaticOrder: true,
  defaultChapterId: chapter.id,
  releases: [chapter],
}
function render(
  slots: ChapterList["slots"],
  direction: "asc" | "desc" = "desc",
  page = 1
) {
  const chapters: ChapterList = {
    slots,
    data: slots.flatMap(({ releases }) => releases),
    meta: {
      page,
      limit: 20,
      total: slots.length ? 21 : 0,
      totalPages: slots.length ? 2 : 0,
      releaseTotal: 24,
    },
  }
  const before = structuredClone(chapters)
  const html = renderToStaticMarkup(
    <MangaChapters chapters={chapters} direction={direction} manga={manga} />
  )
  assert.deepEqual(chapters, before)
  assert.doesNotMatch(
    html,
    /<svg|<details|lucide-|data-read|Đã đọc|Chưa đọc|lượt xem|bình luận|12[.,]345|6[.,]789|Volume|END|Sắp xếp|Chuyển nhanh|Nhóm dịch|Người đăng|href="\/profile\/|href="\/group\//
  )
  return html
}

const originalFetch = globalThis.fetch
try {
  globalThis.fetch = (() => {
    throw new Error("Chapter UI must not fetch reading progress")
  }) as typeof fetch
  const single = render([slot])
  assert.match(single, /Chap 18: Bản C &lt;script&gt;/)
  assert.match(single, /02\/09\/2026/)
  assert.match(single, /dateTime="2026-09-01T18:04:05Z"/i)
  assert.match(single, /href="\/chapter\/native-18"/)
  const chapterLink = single.match(
    /<a\b[^>]*href="\/chapter\/native-18"[^>]*>([\s\S]*?)<\/a>/
  )?.[1]
  assert.ok(chapterLink)
  assert.match(chapterLink, /Chap 18: Bản C &lt;script&gt;/)
  assert.match(chapterLink, /<time\b[^>]*>02\/09\/2026<\/time>/)
  assert.equal((single.match(/<nav\b/g) ?? []).length, 1)
  assert.ok(single.indexOf("</ul>") < single.indexOf("<nav"))
  assert.match(single, /hvn-pagination/)
  assert.match(single, /href="\/manga\/manga\/ten-truyen\?page=2"/)
  assert.doesNotMatch(single, /direction=asc/)

  const variants = render([
    {
      ...slot,
      releases: [
        chapter,
        {
          ...chapter,
          id: "alternate-18",
          title: "Bản khác",
          isDefault: false,
        },
        {
          ...chapter,
          id: "no-volume-18",
          volume: null,
          title: "Bản không volume",
          isDefault: false,
        },
      ],
    },
  ])
  for (const id of ["native-18", "alternate-18", "no-volume-18"]) {
    assert.ok(variants.includes(`href="/chapter/${id}"`))
  }
  assert.equal((variants.match(/<time\b/g) ?? []).length, 3)
  assert.match(variants, /Chap 18: Bản khác/)
  assert.match(variants, /Chap 18: Bản không volume/)

  const lower = {
    ...slot,
    key: "lower",
    number: "17.5",
    releases: [{ ...chapter, id: "lower", number: "17.5", title: null }],
  }
  const descending = render([slot, lower])
  assert.ok(
    descending.indexOf('href="/chapter/native-18"') <
      descending.indexOf('href="/chapter/lower"')
  )
  assert.match(descending, />Chap 17\.5<\/span>/)
  const ascending = render([lower, slot], "asc", 2)
  assert.ok(
    ascending.indexOf('href="/chapter/lower"') <
      ascending.indexOf('href="/chapter/native-18"')
  )
  assert.match(ascending, /href="\/manga\/manga\/ten-truyen\?direction=asc"/)

  const oneshot = render([
    {
      ...slot,
      number: null,
      releases: [{ ...chapter, number: null, title: "Một chương" }],
    },
  ])
  assert.match(oneshot, /Oneshot: Một chương/)
  const zero = render([
    {
      ...slot,
      number: "0",
      releases: [{ ...chapter, number: "0", title: null }],
    },
  ])
  assert.match(zero, />Chap 0<\/span>/)
  assert.match(render([]), /Truyện này chưa có chương nào/)
} finally {
  globalThis.fetch = originalFetch
}
console.log(
  "HVN flat chapter rows, all releases, API order, dates and bottom-only pagination checks passed"
)
