import type { Metadata } from "next"
import { Suspense } from "react"

import { LibraryLoading, MyLibrary } from "@/modules/library/my-library"

export const metadata: Metadata = {
  title: "Thư viện",
  robots: { index: false, follow: false },
}

export default function MyLibraryPage() {
  return (
    <section className="mx-auto max-w-480 w-full flex flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Thư viện</h1>
      <Suspense fallback={<LibraryLoading />}>
        <MyLibrary />
      </Suspense>
    </section>
  )
}
