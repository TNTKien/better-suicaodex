import type { Metadata } from "next"

import { AdminForbiddenWordList } from "@/modules/moderation/forbidden-word-list"

export const metadata: Metadata = { title: "Từ cấm" }
export const instant = false

export default function AdminForbiddenWordsPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="section-heading text-2xl">Từ cấm</h1>
        <p className="text-sm text-muted-foreground">
          Từ cấm trong bình luận sẽ tự động được thay bằng ***.
        </p>
      </div>
      <AdminForbiddenWordList />
    </section>
  )
}
