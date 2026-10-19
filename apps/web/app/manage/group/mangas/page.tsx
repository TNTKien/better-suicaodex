import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeftIcon } from "lucide-react"

import { GroupMangaList } from "@/modules/groups/group-manga-list"
import { buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = {
  title: "Truyện của nhóm",
  robots: { index: false, follow: false },
}

export default function GroupMangaPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Link
          aria-label="Quay lại quản lý nhóm"
          className={buttonVariants({ size: "icon-sm", variant: "secondary" })}
          href="/manage/group"
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Link>
        <h1 className="section-heading text-2xl">Truyện của nhóm</h1>
      </div>
      <Suspense fallback={<Spinner aria-label="Đang tải danh sách truyện" />}>
        <GroupMangaList />
      </Suspense>
    </section>
  )
}
