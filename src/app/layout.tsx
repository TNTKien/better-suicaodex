import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/themes.css";
import { ThemeProvider } from "@/components/providers";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { META_THEME_COLORS, siteConfig } from "@/config/site";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/react";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";

const inter = Inter({
  preload: true,
  subsets: ["vietnamese"],
});

// const leagueSpartan = League_Spartan({
//   subsets: ["vietnamese"],
// });

export const metadata: Metadata = {
  metadataBase: new URL("https://vinext.suicaodex.com"),
  title: {
    template: "%s - SuicaoDex",
    default: siteConfig.name,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: "https://vinext.suicaodex.com/",
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
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-GHG1HN9493"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-GHG1HN9493');
            `,
          }}
        />
        <meta name="theme-color" content={META_THEME_COLORS.dark} />
      </head>
      {/* <body className={`${leagueSpartan.className} antialiased`}> */}
      <body className={`${inter.className} antialiased`}>
        <NuqsAdapter fullPageNavigationOnShallowFalseUpdates>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
            enableColorScheme
            enableSystem
          >
            <ServiceWorkerRegistrar />
            {children}
            <Toaster richColors position="top-center" closeButton={false} />
            <ThemeSwitcher />
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
