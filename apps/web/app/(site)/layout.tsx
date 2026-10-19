import { AppShell } from "@/components/app-shell"

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
