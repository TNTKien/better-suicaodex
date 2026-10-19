"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function LatestError({ retry }: { retry: () => void }) {
  return <CatalogError title="Mới cập nhật" retry={retry} />
}
