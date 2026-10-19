import type { Metadata } from "next"
import { Suspense } from "react"

import {
  SystemNoticeList,
  SystemNoticeListLoading,
} from "@/modules/system-notices/system-notice-list"

export const metadata: Metadata = {
  title: "Thông báo hệ thống",
  description: "Các thông báo mới nhất từ hệ thống SuicaoDex.",
  alternates: { canonical: "/system-notice" },
}

export default function SystemNoticePage() {
  return (
    <main className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">THÔNG BÁO HỆ THỐNG</h1>
      <div className="w-full self-center">
        <Suspense fallback={<SystemNoticeListLoading />}>
          <SystemNoticeList />
        </Suspense>
      </div>
    </main>
  )
}
