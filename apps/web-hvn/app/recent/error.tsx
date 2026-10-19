"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function RecentError({ retry }: { retry: () => void }) {
  return <CatalogError title="Truyện mới đăng" retry={retry} />
}
