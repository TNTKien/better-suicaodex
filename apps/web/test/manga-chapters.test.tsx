import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

import type { ChapterList, ChapterSummary, MangaDetail } from "../lib/api"

mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl: "https://api.example.test",
    status: "anonymous",
    user: null,
  }),
}))
mock.module("../modules/reading/local-history", () => ({
  accountReadingScope: () => "guest",
  useLocalReadingHistory: () => [{ chapterId: "default-18" }],
}))
const { MangaChapters } =
  await import("../app/(site)/manga/[id]/[slug]/manga-chapters")

const base: ChapterSummary = {
  id: "default-18",
  number: "18",
  title: "Bản gốc",
  volume: "2",
  language: "vi",
  isDefault: true,
  publishedAt: "2026-09-01T00:00:00Z",
  pageCount: 20,
  groups: [{ id: "group", name: "Nhóm dịch", slug: "nhom-dich" }],
  uploader: { id: "default-uploader", name: "Người đăng A" },
  statistics: { views: 1200, comments: 3 },
}
const alternate: ChapterSummary = {
  ...base,
  id: "alternate-18",
  title: "Bản khác",
  volume: "2",
  isDefault: false,
  uploader: { id: "alternate-uploader", name: "Người đăng B" },
}
const native: ChapterSummary = {
  ...base,
  id: "native-18",
  title: "Bản C",
  isDefault: false,
  uploader: { id: "native-uploader", name: "Người đăng C" },
}
const manga = {
  id: "manga",
  slug: "ten-truyen",
  lastChapter: "18",
} as MangaDetail
const client = new QueryClient()

function render(
  slots: ChapterList["slots"],
  direction: "asc" | "desc" = "desc"
) {
  const chapters: ChapterList = {
    slots,
    data: slots.flatMap(({ releases }) => releases),
    meta: {
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      releaseTotal: 5,
    },
  }
  const before = structuredClone(chapters)
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MangaChapters chapters={chapters} direction={direction} manga={manga} />
    </QueryClientProvider>
  )
  assert.deepEqual(chapters, before, "Rendering must not mutate the API order")
  return markup
}

const slot: ChapterList["slots"][number] = {
  key: "opaque-18",
  language: "vi",
  number: "18",
  volume: null,
  automaticOrder: true,
  defaultChapterId: base.id,
  releases: [base],
}

try {
  const single = render([slot])
  assert.match(single, /Volume 2/)
  assert.doesNotMatch(single, /group\/chapter-slot/)
  assert.match(single, /href="\/profile\/default-uploader"/)
  assert.match(single, /Người đăng A/)
  assert.match(single, /Ch\. 18 - Bản gốc/)
  assert.match(single, /aria-label="Tiếng Việt"/)
  assert.match(single, /aria-label="1.200 lượt xem"/)
  assert.match(single, /aria-label="3 bình luận"/)
  assert.match(single, /href="\/group\/group\/nhom-dich"/)
  assert.match(single, /data-read="true"/)

  const variants = render([{ ...slot, releases: [base, alternate, native] }])
  assert.equal([...variants.matchAll(/group\/chapter-slot"/g)].length, 1)
  assert.equal([...variants.matchAll(/<details\b/g)].length, 2)
  assert.match(variants, /<details[^>]*group\/chapter-slot[^>]*open=""/)
  assert.match(variants, /<span>Chapter 18<\/span>/)
  const chapterSummary = variants.match(
    /<details class="group\/chapter-slot"[^>]*><summary[^>]*>([\s\S]*?)<\/summary>/
  )?.[1]
  assert.ok(chapterSummary)
  assert.doesNotMatch(chapterSummary, /lucide-list-tree/)
  assert.match(variants, /lucide-list-tree/)
  assert.match(variants, /before:border-l-4/)
  assert.match(variants, /after:border-t-4/)
  assert.match(variants, /after:left-1/)
  assert.match(variants, /after:w-2\.5/)
  assert.match(variants, /last:before:h-8/)
  assert.match(variants, /Volume 2/)
  assert.doesNotMatch(variants, /No Volume/)
  for (const chapter of [base, alternate, native]) {
    assert.match(variants, new RegExp(`href="/chapter/${chapter.id}"`))
  }
  assert.equal([...variants.matchAll(/data-read="true"/g)].length, 1)
  assert.equal([...variants.matchAll(/data-read="false"/g)].length, 2)
  assert.equal([...variants.matchAll(/aria-label="Tiếng Việt"/g)].length, 3)
  assert.match(variants, /Người đăng B/)
  assert.match(variants, /href="\/profile\/alternate-uploader"/)
  assert.match(variants, /href="\/profile\/native-uploader"/)
  assert.match(variants, /Người đăng C/)
  assert.doesNotMatch(variants, /ID nguồn|Bản mặc định|Ngôn ngữ đọc/)
  assert.match(variants, /page=2/)

  const sameUploader = render([
    {
      ...slot,
      releases: [
        base,
        alternate,
        {
          ...alternate,
          id: "alternate-18-second",
        },
      ],
    },
  ])
  assert.match(sameUploader, /href="\/chapter\/alternate-18-second"/)
  assert.equal([...sameUploader.matchAll(/Người đăng B/g)].length, 2)

  const mixedVolumes = render([
    {
      ...slot,
      key: "n:10.000",
      number: "10",
      releases: [
        {
          ...native,
          id: "chapter-10",
          number: "10",
          volume: null,
          isDefault: true,
        },
        { ...native, id: "chapter-10-v3", number: "10", volume: "1" },
        { ...native, id: "chapter-10-v2", number: "10", volume: null },
      ],
      defaultChapterId: "chapter-10",
    },
  ])
  const noVolumeStart = mixedVolumes.indexOf("<span>No Volume</span>")
  const volume1Start = mixedVolumes.indexOf("<span>Volume 1</span>")
  assert.ok(noVolumeStart >= 0 && volume1Start > noVolumeStart)
  const noVolumeMarkup = mixedVolumes.slice(noVolumeStart, volume1Start)
  const volume1Markup = mixedVolumes.slice(volume1Start)
  assert.match(noVolumeMarkup, /<span>Chapter 10<\/span>/)
  assert.match(noVolumeMarkup, /href="\/chapter\/chapter-10"/)
  assert.match(noVolumeMarkup, /href="\/chapter\/chapter-10-v2"/)
  assert.doesNotMatch(noVolumeMarkup, /href="\/chapter\/chapter-10-v3"/)
  assert.match(volume1Markup, /href="\/chapter\/chapter-10-v3"/)
  assert.doesNotMatch(volume1Markup, /group\/chapter-slot/)
  assert.doesNotMatch(volume1Markup, /href="\/chapter\/chapter-10(?:-v2)?"/)
  assert.equal([...mixedVolumes.matchAll(/group\/chapter-slot"/g)].length, 1)
  assert.equal([...mixedVolumes.matchAll(/data-slot="card"/g)].length, 3)

  const separateVolumes = render([
    { ...slot, volume: "1", releases: [{ ...base, volume: "1" }] },
    { ...slot, key: "other-volume-18", volume: "2", releases: [native] },
  ])
  assert.equal([...separateVolumes.matchAll(/<details\b/g)].length, 2)
  assert.doesNotMatch(separateVolumes, /group\/chapter-slot/)

  const independent = render([
    slot,
    {
      ...slot,
      key: "null-a",
      number: null,
      releases: [{ ...base, id: "null-a", number: null }],
    },
    {
      ...slot,
      key: "null-b",
      number: null,
      releases: [{ ...base, id: "null-b", number: null }],
    },
    {
      ...slot,
      language: "en",
      releases: [{ ...base, id: "english", language: "en" }],
    },
  ])
  assert.doesNotMatch(independent, /group\/chapter-slot/)
  assert.equal([...independent.matchAll(/aria-label="Tiếng Việt"/g)].length, 4)
  assert.match(independent, /href="\/chapter\/null-a"/)
  assert.match(independent, /href="\/chapter\/null-b"/)

  const lower = {
    ...slot,
    key: "17.5",
    number: "17.5",
    releases: [{ ...base, id: "lower", number: "17.5" }],
  }
  const ascending = render([lower, slot], "asc")
  const descending = render([slot, lower])
  assert.ok(
    ascending.indexOf('href="/chapter/lower"') <
      ascending.indexOf('href="/chapter/default-18"')
  )
  assert.ok(
    descending.indexOf('href="/chapter/default-18"') <
      descending.indexOf('href="/chapter/lower"')
  )
} finally {
  client.clear()
}

console.log("Manga chapter tree checks passed")
