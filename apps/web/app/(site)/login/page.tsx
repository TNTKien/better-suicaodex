import type { Metadata } from "next"
import { Suspense } from "react"

import { Login } from "@/modules/account/login"
import { ProfileSkeleton } from "@/modules/account/profile"

export const metadata: Metadata = {
  title: "Đăng nhập",
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <section className="w-full self-center">
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <Login />
        </Suspense>
      </div>
    </section>
  )
}
