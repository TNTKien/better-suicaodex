import type { Metadata } from "next"
import { Suspense } from "react"
import { AdminShop } from "@/modules/shop/admin-shop"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = { title: "Quản lý SuicaoShop" }
export const instant = false

export default function AdminShopPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="section-heading text-2xl">SuicaoShop</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý giá, tồn kho khung avatar và mở/đóng bán hộp.
        </p>
      </div>
      <Suspense fallback={<Spinner aria-label="Đang tải quản lý Shop" />}>
        <AdminShop />
      </Suspense>
    </section>
  )
}
