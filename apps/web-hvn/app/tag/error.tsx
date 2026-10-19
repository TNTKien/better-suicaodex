"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function TagError({ retry }: { retry: () => void }) {
  return <CatalogError title="Thể loại" retry={retry} />
}
