import type { Metadata } from "next"
import { Geist_Mono, Roboto } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"
import { Providers } from "@/app/providers"
import { siteConfig } from "@/config/site"
import { getBrowserApiBaseUrl } from "@/lib/api"
import { getSiteUrl } from "@/lib/site-url"

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontMono.variable,
        roboto.variable
      )}
    >
      <body className="relative">
        <Providers apiBaseUrl={getBrowserApiBaseUrl()}>{children}</Providers>
      </body>
    </html>
  )
}
