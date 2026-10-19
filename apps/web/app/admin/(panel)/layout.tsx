import type { Metadata } from "next"

import { AppShell } from "@/components/app-shell"
import { AdminGate } from "@/modules/account/admin-gate"

export const instant = false

export const metadata: Metadata = {
  title: { default: "Quản trị", template: "%s | Quản trị" },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGate>
      <AppShell area="admin">{children}</AppShell>
    </AdminGate>
  )
}
