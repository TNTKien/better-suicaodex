"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function MangaError({ retry }: { retry: () => void }) {
  return <CatalogError title="Thông tin truyện" retry={retry} />
}
