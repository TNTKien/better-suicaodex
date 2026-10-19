import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminCommentList } from "@/modules/moderation/comment-list"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Danh sách bình luận" }
export const instant = false

export default function AdminCommentListPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Danh sách bình luận</h1>
      <Suspense
        fallback={<Spinner aria-label="Đang tải danh sách bình luận" />}
      >
        <AdminCommentList />
      </Suspense>
    </section>
  )
}
