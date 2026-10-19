"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function GroupError({ retry }: { retry: () => void }) {
  return <CatalogError title="Nhóm dịch" retry={retry} />
}
