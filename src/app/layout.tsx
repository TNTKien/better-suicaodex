import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/themes.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/Sidebar/app-sidebar";
import { SiteHeader } from "@/components/Navbar/site-header";
import { ThemeProvider } from "@/components/providers";
import { ThemeSwitcher } from "@/components/Theme/theme-switcher";
import { META_THEME_COLORS, siteConfig } from "@/config/site";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ImageProxyInitializer } from "@/components/image-proxy-initializer";

const inter = Inter({
  preload: true,
  subsets: ["vietnamese"],
});

// const leagueSpartan = League_Spartan({
//   subsets: ["vietnamese"],
// });

export const metadata: Metadata = {
  metadataBase: new URL("https://suicaodex.net"),
  title: siteConfig.name,
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: "https://suicaodex.net/",
    siteName: "SuicaoDex",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "SuicaoDex",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (window.localStorage && (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches))) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `,
          }}
        />
        <meta name="theme-color" content={META_THEME_COLORS.dark} />
      </head>
      {/* <body className={`${leagueSpartan.className} antialiased`}> */}
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableColorScheme
          enableSystem
        >
          <ImageProxyInitializer />
          <SidebarProvider defaultOpen={false}>
            <div className="border-grid flex flex-1 flex-col">
              <SiteHeader />
              <main className="py-4 mx-4 md:mx-8 lg:mx-12">{children}</main>
              <Toaster
                richColors
                position="top-right"
                closeButton
                offset={{
                  top: "55px",
                  right: "65px",
                }}
              />
            </div>

            <AppSidebar side="right" />
          </SidebarProvider>
          <ThemeSwitcher />
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-GHG1HN9493" />
    </html>
  );
}
