import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { siteConfig } from "@/config/site"
import { AdminGate } from "@/modules/account/admin-gate"
import { AdminLogin } from "@/modules/account/admin-login"

export const instant = false

export const metadata: Metadata = {
  title: "Đăng nhập quản trị",
}

export default function AdminLoginPage() {
  return (
    <AdminGate loginPage>
      <main className="grid min-h-svh place-items-center px-4 py-12 sm:px-6">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Link
            aria-label={`${siteConfig.shortName} - Trang chủ`}
            className="mx-auto rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            href="/"
          >
            <Image
              alt={siteConfig.shortName}
              className="h-7 w-auto dark:invert"
              height={siteConfig.wordmark.height}
              priority
              src={siteConfig.wordmark.src}
              width={siteConfig.wordmark.width}
            />
          </Link>
          <AdminLogin />
        </div>
      </main>
    </AdminGate>
  )
}
