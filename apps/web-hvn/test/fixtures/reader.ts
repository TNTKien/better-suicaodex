import type { components } from "../../src/lib/generated/api"

export type ChapterDetail = components["schemas"]["ChapterDetail"]
export type ChapterSummary = components["schemas"]["ChapterSummary"]
export const chapterId = "00000000-0000-4000-8000-000000000011"
export const mangaId = "00000000-0000-4000-8000-000000000001"
export const release: ChapterSummary = {
  id: "native",
  number: "11",
  title: "Bản gốc",
  volume: "2",
  language: "vi",
  isDefault: true,
  pageCount: 3,
  publishedAt: "2026-10-02T00:00:00Z",
  groups: [{ id: "group", slug: "group", name: "Nhóm dịch" }],
  uploader: { id: "uploader", name: "Người đăng" },
  statistics: { views: 1, comments: 2 },
}
export const importedRelease: ChapterSummary = {
  ...release,
  id: "imported",
  title: "Bản nhập",
  isDefault: false,
}
// The HTTP contract permits null; generated Id intersections currently narrow it.
export const boundary = {
  state: "boundary",
  selectedChapterId: null,
  options: [],
} as unknown as ChapterDetail["navigation"]["previous"]
export const needsChoice = {
  state: "choice-required",
  selectedChapterId: null,
  options: [release, importedRelease],
} as unknown as ChapterDetail["navigation"]["next"]
export const chapter: ChapterDetail = {
  ...release,
  id: chapterId,
  number: "10",
  title: "Chương hiện tại",
  pagesVersion: 2,
  manga: {
    id: mangaId,
    slug: "manga",
    title: "Truyện đọc",
    cover: null,
    isLongStrip: false,
  },
  pages: [
    {
      position: 0,
      url: "https://images.test/1.jpg",
      width: 800,
      height: 1200,
      optimizedUrl: "https://images.test/1.webp",
      optimizedWidth: 700,
      optimizedHeight: 1050,
      replicaUrl: null,
    },
    {
      position: 1,
      url: "https://images.test/2.jpg",
      width: 800,
      height: 1200,
      optimizedUrl: null,
      optimizedWidth: null,
      optimizedHeight: null,
      replicaUrl: "https://replica.test/2.webp",
    },
    {
      position: 2,
      url: "https://images.test/3.jpg",
      width: 800,
      height: 1200,
      optimizedUrl: null,
      optimizedWidth: null,
      optimizedHeight: null,
      replicaUrl: null,
    },
  ],
  navigation: { previous: boundary, next: needsChoice, alternatives: [] },
  previous: null,
  next: null,
}
