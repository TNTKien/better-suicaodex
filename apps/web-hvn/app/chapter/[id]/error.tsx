"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function ChapterError({ retry }: { retry: () => void }) {
  return <CatalogError title="Đọc truyện" retry={retry} />
}
