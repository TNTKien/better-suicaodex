import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminSystemNoticeList } from "@/modules/moderation/system-notice-list"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Thông báo hệ thống" }
export const instant = false

export default function AdminSystemNoticePage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="section-heading text-2xl">Thông báo hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Thêm, sửa hoặc xóa thông báo hiển thị cho người dùng.
        </p>
      </div>
      <Suspense
        fallback={<Spinner aria-label="Đang tải danh sách thông báo" />}
      >
        <AdminSystemNoticeList />
      </Suspense>
    </section>
  )
}
