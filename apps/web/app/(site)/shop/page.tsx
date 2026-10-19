import type { Metadata } from "next"
import { Suspense } from "react"
import { Shop, ShopSkeleton } from "@/modules/shop/shop"

export const metadata: Metadata = { title: "SuicaoShop" }
export const instant = false

export default function ShopPage() {
  return (
    <section className="mx-auto w-full max-w-480 px-4 py-6 sm:px-6 lg:py-8">
      <Suspense fallback={<ShopSkeleton />}>
        <Shop />
      </Suspense>
    </section>
  )
}
