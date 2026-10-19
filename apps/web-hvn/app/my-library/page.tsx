import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { LibraryLoading, MyLibrary } from "@/modules/library/my-library"

export const metadata: Metadata = {
  title: "Thư viện",
  alternates: { canonical: "/my-library" },
  robots: { index: false, follow: false },
}

export default function MyLibraryPage() {
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
          <li aria-current="page">Thư viện</li>
        </ol>
      </nav>
      <div className="hvn-home-heading-frame">
        <h1 className="hvn-home-heading" data-kind="catalog">
          Thư viện
        </h1>
      </div>
      <div className="hvn-library flex flex-col gap-4 border border-t-0 border-white/35 bg-[#111111] p-2">
        <Suspense fallback={<LibraryLoading />}>
          <MyLibrary />
        </Suspense>
      </div>
    </section>
  )
}
