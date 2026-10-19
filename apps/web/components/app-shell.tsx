import Link from "next/link"

import { AppSidebar, type AppArea } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { siteConfig } from "@/config/site"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export function AppShell({
  area = "site",
  children,
}: {
  area?: AppArea
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delay={200}>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
        href="#main-content"
      >
        Bỏ qua điều hướng
      </a>
      <SidebarProvider defaultOpen={false}>
        <SidebarInset
          className="min-w-0 overflow-x-clip bg-background"
          id="main-content"
        >
          <SiteHeader showDiscovery={area === "site"} />

          <div className="grid flex-1 grid-cols-1">{children}</div>

          <footer className="border-t bg-background">
            <div className="mx-auto flex max-w-480 flex-col gap-4 px-4 py-4 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-heading font-medium">
                  © {siteConfig.shortName} {siteConfig.copyrightYear} v
                  {siteConfig.version}
                </span>
                <nav
                  aria-label="Thông tin pháp lý"
                  className="flex flex-wrap gap-x-4 gap-y-1"
                >
                  <Link
                    className="hover:text-foreground hover:underline"
                    href="/privacy-policy"
                  >
                    Chính sách bảo mật
                  </Link>
                  <Link
                    className="hover:text-foreground hover:underline"
                    href="/terms-of-service"
                  >
                    Điều khoản dịch vụ
                  </Link>
                  <Link
                    className="hover:text-foreground hover:underline"
                    href="/copyright"
                  >
                    Bản quyền
                  </Link>
                </nav>
              </div>
            </div>
          </footer>
        </SidebarInset>
        <AppSidebar area={area} side="right" />
      </SidebarProvider>
    </TooltipProvider>
  )
}
