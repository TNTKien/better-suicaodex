import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminTagList } from "@/modules/moderation/tag-list"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Quản lý thể loại" }
export const instant = false

export default function AdminTagsPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="section-heading text-2xl">Quản lý thể loại</h1>
        <p className="text-sm text-muted-foreground">
          Thêm, sửa hoặc ẩn thể loại dùng cho truyện.
        </p>
      </div>
      <Suspense fallback={<Spinner aria-label="Đang tải danh sách thể loại" />}>
        <AdminTagList />
      </Suspense>
    </section>
  )
}
