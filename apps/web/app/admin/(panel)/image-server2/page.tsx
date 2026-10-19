import type { Metadata } from "next"
import { AdminImageServer2 } from "@/modules/image-server2/admin"

export const metadata: Metadata = { title: "TikTok Server 2" }
export const instant = false

export default function ImageServer2Page() {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">TikTok Server 2</h1>
      <AdminImageServer2 />
    </section>
  )
}
