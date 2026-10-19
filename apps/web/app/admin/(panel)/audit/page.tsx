import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminAuditList } from "@/modules/moderation/audit"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Nhật ký quản trị" }
export const instant = false

export default function AdminAuditPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="section-heading text-2xl">Nhật ký quản trị</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tra cứu các thay đổi đã được hệ thống ghi nhận. Nhật ký chỉ có thể
          đọc.
        </p>
      </div>
      <Suspense fallback={<Spinner aria-label="Đang tải nhật ký quản trị" />}>
        <AdminAuditList />
      </Suspense>
    </section>
  )
}
