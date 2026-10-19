import type { Metadata } from "next"

import { HistoryClient } from "./history-client"

export const metadata: Metadata = {
  title: "Lịch sử đọc",
  robots: { index: false, follow: false },
}

export default function HistoryPage() {
  return (
    <section className="mx-auto max-w-480 w-full flex flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Lịch sử đọc</h1>
      <HistoryClient />
    </section>
  )
}
