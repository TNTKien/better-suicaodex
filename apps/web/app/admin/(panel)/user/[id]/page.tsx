import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeftIcon } from "lucide-react"

import { AdminAccountDetail } from "@/modules/moderation/account-detail"
import { buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Chi tiết người dùng" }
export const instant = false

export default function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Link
          aria-label="Quay lại quản lý người dùng"
          className={buttonVariants({ size: "icon-sm", variant: "secondary" })}
          href="/admin/users"
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Link>
        <h1 className="section-heading text-2xl">Chi tiết người dùng</h1>
      </div>
      <Suspense
        fallback={
          <Spinner
            aria-label="Đang tải thông tin người dùng"
            className="self-center"
          />
        }
      >
        <AdminUserContent params={params} />
      </Suspense>
    </section>
  )
}

async function AdminUserContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AdminAccountDetail targetUserId={id} />
}
