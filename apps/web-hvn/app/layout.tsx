import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Toaster } from "@workspace/ui/components/toast"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { QueryProvider } from "@/components/query-provider"
import { AccountProvider } from "@/modules/account/provider"

import "./globals.css"

const geist = Geist({ subsets: ["vietnamese"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: { default: "SuicaoDex · HVN", template: "%s · SuicaoDex HVN" },
  description: "Trang web đọc truyện tranh đầu hàng VN",
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className={`dark ${geist.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          Đến nội dung chính
        </a>
        <QueryProvider>
          <AccountProvider>
            <SiteHeader />
            <main
              id="main-content"
              tabIndex={-1}
              className="py-4 md:mx-20 lg:mx-32"
            >
              {children}
            </main>
            <SiteFooter />
          </AccountProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
