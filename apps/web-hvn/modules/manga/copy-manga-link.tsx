"use client"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/toast"

export function CopyMangaLink({ path }: { path: string }) {
  return (
    <Button
      className="hvn-copy-manga-link"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            new URL(path, window.location.origin).href
          )
          toast.add({ type: "success", title: "Đã sao chép link truyện" })
        } catch {
          toast.add({
            type: "error",
            title: "Không thể sao chép link. Vui lòng thử lại.",
          })
        }
      }}
    >
      Copy link truyện
    </Button>
  )
}
