import type { Metadata } from "next"
import { Suspense } from "react"

import { GroupWorkspace } from "@/modules/groups/workspace"
import { Spinner } from "@workspace/ui/components/spinner"

export const metadata: Metadata = {
  title: "Nhóm dịch",
  robots: { index: false, follow: false },
}

export default function ManageGroupPage() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Nhóm dịch</h1>
      <Suspense fallback={<Spinner aria-label="Đang tải nhóm dịch" />}>
        <GroupWorkspace />
      </Suspense>
    </section>
  )
}
