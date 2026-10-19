import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminGroups } from "@/modules/groups/admin"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Nhóm dịch" }
export const instant = false

export default function AdminGroupsPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="section-heading text-2xl">Quản lý nhóm dịch</h1>
        <p className="text-sm text-muted-foreground">
          Xét duyệt, cập nhật và quản lý thành viên nhóm dịch.
        </p>
      </div>
      <Suspense
        fallback={<Spinner aria-label="Đang tải danh sách nhóm dịch" />}
      >
        <AdminGroups />
      </Suspense>
    </section>
  )
}
