import Image from "next/image"
import Link from "next/link"

import { QuickSearch } from "@/components/quick-search"
import { ThemeToggle } from "@/components/theme-provider"
import { siteConfig } from "@/config/site"
import { getBrowserApiBaseUrl } from "@/lib/api"
import { NotificationPopover } from "@/modules/notifications/notification-popover"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

export function SiteHeader({
  showDiscovery = true,
  showSidebarTrigger = true,
}: {
  showDiscovery?: boolean
  showSidebarTrigger?: boolean
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-12 shrink-0 items-center justify-center border-b bg-background/95 backdrop-blur-sm transition-[height] ease-linear md:h-16 md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        !showSidebarTrigger && "md:h-12"
      )}
    >
      <div className="flex w-full max-w-480 items-center gap-2 px-4 sm:px-6">
        <Link
          aria-label={`${siteConfig.shortName} - Trang chủ`}
          className="shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href="/"
        >
          <Image
            alt={siteConfig.shortName}
            className="h-5 w-auto sm:h-6 dark:invert"
            height={siteConfig.wordmark.height}
            loading="eager"
            src={siteConfig.wordmark.src}
            width={siteConfig.wordmark.width}
          />
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {showDiscovery ? (
            <QuickSearch apiBaseUrl={getBrowserApiBaseUrl()} />
          ) : null}
          <NotificationPopover />
          <ThemeToggle />
          {showSidebarTrigger ? (
            <SidebarTrigger
              aria-label="Mở hoặc thu gọn sidebar"
              variant="outline"
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
