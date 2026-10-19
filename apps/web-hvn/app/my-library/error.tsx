"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function LibraryError({ retry }: { retry: () => void }) {
  return <CatalogError title="Thư viện" retry={retry} />
}
