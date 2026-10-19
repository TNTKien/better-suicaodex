import type { Metadata } from "next"

import { AppShell } from "@/components/app-shell"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell area="manage">{children}</AppShell>
}
