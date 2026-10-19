"use client"

import { CatalogError } from "@/modules/manga/catalog-error"

export default function ProfileError({ retry }: { retry: () => void }) {
  return <CatalogError title="Trang cá nhân" retry={retry} />
}
