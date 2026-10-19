"use client"

import { Button } from "@workspace/ui/components/button"

export function CatalogError({
  title,
  retry,
}: {
  title: string
  retry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 border border-white/35 px-4 py-8 text-center">
      <p role="alert">
        Không tải được {title.toLocaleLowerCase("vi")}. Vui lòng thử lại.
      </p>
      <Button className="hvn-button" size="sm" onClick={() => retry()}>
        Thử lại
      </Button>
    </div>
  )
}
