"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function AuthorError({ retry }: { retry: () => void }) {
  return <CatalogError title="Tác giả" retry={retry} />
}
