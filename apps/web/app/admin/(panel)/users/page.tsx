import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminAccountList } from "@/modules/moderation/account-list"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Quản lý người dùng" }
export const instant = false

export default function AdminUsersPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Quản lý người dùng</h1>
      <Suspense
        fallback={<Spinner aria-label="Đang tải danh sách người dùng" />}
      >
        <AdminAccountList />
      </Suspense>
    </section>
  )
}
