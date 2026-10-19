import type { Metadata } from "next"
import Link from "next/link"
import { HistoryClient } from "@/modules/reading/history-client"

export const metadata: Metadata = {
  title: "Lịch sử đọc",
  alternates: { canonical: "/history" },
  robots: { index: false, follow: false },
}

export default function HistoryPage() {
  return (
    <section className="min-w-0">
      <nav aria-label="Breadcrumb" className="mb-2 px-2 text-sm text-[#00bfff]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true" className="text-white">
            /
          </li>
          <li aria-current="page">Lịch sử đọc</li>
        </ol>
      </nav>
      <div className="hvn-home-heading-frame">
        <h1 className="hvn-home-heading" data-kind="catalog">
          Lịch sử đọc
        </h1>
      </div>
      <div className="flex flex-col gap-4 border border-t-0 border-white/35 bg-[#111111] p-2">
        <HistoryClient />
      </div>
    </section>
  )
}
