"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function HistoryError({ retry }: { retry: () => void }) {
  return <CatalogError title="Lịch sử đọc" retry={retry} />
}
