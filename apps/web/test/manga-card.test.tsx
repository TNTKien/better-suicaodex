import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"

import { MangaCard, MangaCardSkeleton } from "../components/manga-card"
import { MangaGrid } from "../components/manga-grid"
import { PagePagination } from "../components/page-pagination"
import { FeaturedCarousel } from "../app/(site)/featured-carousel"
import type { MangaSummary } from "../lib/api"

const manga = {
  id: "manga-id",
  slug: "ten-truyen",
  title: "Tên truyện dài & nhiều ký tự",
  cover: { url: "https://example.com/cover.512.webp", width: 512, height: 800 },
}
const chapter = {
  id: "chapter-id",
  number: "0",
  publishedAt: "2026-09-01T00:00:00Z",
  groups: [{ id: "group-id", slug: "nhom-dich", name: "Nhóm dịch" }],
  statistics: { views: 12_500, comments: 0 },
}

const coverOnly = renderToStaticMarkup(<MangaCard manga={manga} />)
assert.match(coverOnly, /href="\/manga\/manga-id\/ten-truyen"/)
assert.match(coverOnly, /cover\.512\.webp/)
assert.match(
  coverOnly,
  /srcSet="https:\/\/example.com\/cover.256.webp 256w, https:\/\/example.com\/cover.512.webp 512w"/
)
assert.match(coverOnly, /sizes="auto, [^"]+"/)
assert.match(coverOnly, /loading="lazy"/)
assert.match(coverOnly, /Tên truyện dài &amp; nhiều ký tự/)
assert.match(coverOnly, /bg-transparent/)
assert.doesNotMatch(coverOnly, /data-slot="card-content"|<time|\/chapter\//)
assert.doesNotMatch(coverOnly, /aria-label="Tiếng Việt"/)
assert.equal(
  coverOnly,
  renderToStaticMarkup(<MangaCard manga={manga} chapter={null} />)
)

const withChapter = renderToStaticMarkup(
  <MangaCard manga={manga} chapter={chapter} />
)
assert.match(withChapter, /href="\/chapter\/chapter-id"/)
assert.match(withChapter, /Ch\. 0/)
assert.match(withChapter, /<svg[^>]*aria-label="Tiếng Việt"[^>]*role="img"/)
assert.match(withChapter, /Nhóm dịch/)
assert.match(withChapter, /href="\/group\/group-id\/nhom-dich"/)
assert.match(withChapter, /dateTime="2026-09-01T00:00:00Z"/i)
assert.match(withChapter, /12.5K/)
assert.match(withChapter, /N\/A/)
assert.match(withChapter, /title="12.500 lượt xem"/)
assert.match(withChapter, /title="0 bình luận"/)
assert.equal([...withChapter.matchAll(/<a\b/g)].length, 3)
assert.doesNotMatch(withChapter, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/)

const missing = renderToStaticMarkup(
  <MangaCard
    manga={{ ...manga, cover: null }}
    chapter={{ ...chapter, number: null, groups: [] }}
  />
)
assert.match(missing, /aria-label="Bìa truyện [^"]* chưa có ảnh"/)
assert.match(missing, /Oneshot/)
assert.match(missing, /Chưa có nhóm dịch/)
assert.doesNotMatch(missing, /srcSet=/)

const featuredManga: MangaSummary = {
  ...manga,
  authors: [],
  contentRating: "safe",
  description: null,
  latestChapter: null,
  latestChapterPublishedAt: null,
  originalLanguage: "ja",
  status: "ongoing",
  tags: [],
  year: null,
}
const carousel = renderToStaticMarkup(
  <FeaturedCarousel manga={[featuredManga]} />
)
const backdrop = carousel.match(/<img[^>]*alt=""[^>]*>/)?.[0] ?? ""
const featuredCover =
  carousel.match(/<img[^>]*alt="Bìa truyện [^"]*"[^>]*>/)?.[0] ?? ""
assert.match(backdrop, /src="https:\/\/example.com\/cover.256.webp"/)
for (const image of [backdrop, featuredCover]) {
  assert.match(image, /loading="eager"/)
  assert.match(image, /fetchPriority="high"/)
}
assert.match(featuredCover, /srcSet="[^"]*512w"/)
assert.match(featuredCover, /sizes="[^"]*208px[^"]*128px"/)
assert.doesNotMatch(featuredCover, /sizes="auto/)
assert.doesNotMatch(
  renderToStaticMarkup(<MangaCardSkeleton />),
  /data-slot="card-content"/
)
assert.match(
  renderToStaticMarkup(<MangaCardSkeleton withChapter />),
  /data-slot="card-content"/
)

const grid = renderToStaticMarkup(
  <MangaGrid>
    <span>1</span>
    <span>2</span>
    <span>3</span>
  </MangaGrid>
)
assert.match(grid, /class="manga-grid"/)
assert.match(grid, /--manga-count:3/)

const sixColumnGrid = renderToStaticMarkup(
  <MangaGrid className="2xl:[--manga-columns:6]" hideIncompleteRow={false}>
    <span>1</span>
  </MangaGrid>
)
assert.match(sixColumnGrid, /manga-grid-all/)
assert.match(sixColumnGrid, /2xl:\[--manga-columns:6\]/)

const pagination = renderToStaticMarkup(
  <PagePagination
    ariaLabel="Phân trang truyện mới"
    currentPage={1}
    getPageHref={(page) => `/recent?page=${page}`}
    totalPages={21}
  />
)
assert.match(pagination, /data-slot="pagination"/)
assert.match(pagination, /aria-current="page"/)
assert.match(pagination, /href="\/recent\?page=21"/)
assert.match(pagination, /data-slot="pagination-ellipsis"/)
assert.equal([...pagination.matchAll(/\bsize-8\b/g)].length, 8)

console.log("Manga card checks passed")
