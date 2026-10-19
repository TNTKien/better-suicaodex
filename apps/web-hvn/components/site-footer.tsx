import { Rss } from "lucide-react"

import { Separator } from "@workspace/ui/components/separator"

export function SiteFooter() {
  return (
    <footer className="hvn-footer flex min-h-10 w-full flex-col items-center justify-between px-4 py-2 text-center text-sm md:flex-row md:px-20 lg:px-32">
      <p>• Copyright © 2026 • SuicaoDex v3.5.0 - All Rights Reserved.</p>
      <nav
        aria-label="Liên kết cuối trang"
        className="flex h-10 items-center gap-1 py-1.5"
      >
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="hvn-footer-link line-clamp-1 font-bold break-all"
        >
          Liên hệ quảng cáo
        </a>
        <Separator orientation="vertical" className="hvn-footer-separator" />
        <a
          href="https://facebook.com/suicaodex"
          target="_blank"
          rel="noopener noreferrer"
          className="hvn-footer-link font-bold"
        >
          Facebook
        </a>
        <Separator orientation="vertical" className="hvn-footer-separator" />
        <a
          href="https://discord.gg/fs2qHsS2EJ"
          target="_blank"
          rel="noopener noreferrer"
          className="hvn-footer-link font-bold"
        >
          Discord
        </a>
        <div
          className="hvn-rss ml-1 rounded-[3px] p-[1.5px]"
          aria-hidden="true"
        >
          <Rss size={12} strokeWidth={3} />
        </div>
      </nav>
    </footer>
  )
}
