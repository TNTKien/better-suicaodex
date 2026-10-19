import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminAvatarFrameList } from "@/modules/avatar-frames/admin-list"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Quản lý khung avatar" }
export const instant = false

export default function AdminAvatarFramesPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="section-heading text-2xl">Quản lý khung avatar</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý thông tin, ảnh và trạng thái hiển thị của khung avatar.
        </p>
      </div>
      <Suspense
        fallback={<Spinner aria-label="Đang tải danh sách khung avatar" />}
      >
        <AdminAvatarFrameList />
      </Suspense>
    </section>
  )
}
