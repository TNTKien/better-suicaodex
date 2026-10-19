"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function ArtistError({ retry }: { retry: () => void }) {
  return <CatalogError title="Họa sĩ" retry={retry} />
}
