import type { Metadata } from "next"
import { AdminDashboard } from "@/modules/moderation/dashboard"

export const metadata: Metadata = { title: "Tổng quan quản trị" }
export const instant = false

export default function DashboardPage() {
  return (
    <section className="@container mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex items-center gap-4">
        <h1 className="section-heading text-2xl">Dashboard</h1>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </header>
      <AdminDashboard />
    </section>
  )
}
