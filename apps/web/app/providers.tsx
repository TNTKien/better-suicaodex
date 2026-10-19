"use client"

import { ProgressProvider } from "@bprogress/next/app"
import { SerwistProvider } from "@serwist/next/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { useState } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { AccountProvider } from "@/modules/account/provider"
import { Toaster } from "@workspace/ui/components/toast"

const serviceWorkerOptions: RegistrationOptions = {
  scope: "/",
  updateViaCache: "none",
}

export function Providers({
  children,
  apiBaseUrl,
}: {
  children: React.ReactNode
  apiBaseUrl: string
}) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <SerwistProvider
      cacheOnNavigation={false}
      disable={process.env.NODE_ENV !== "production"}
      options={serviceWorkerOptions}
      reloadOnOnline={false}
      swUrl="/sw.js"
    >
      <ProgressProvider
        color="var(--primary)"
        height="3px"
        options={{ showSpinner: false }}
        shallowRouting
      >
        <NuqsAdapter>
          <QueryClientProvider client={queryClient}>
            <AccountProvider apiBaseUrl={apiBaseUrl}>
              <ThemeProvider>
                {children}
                <Toaster />
              </ThemeProvider>
            </AccountProvider>
          </QueryClientProvider>
        </NuqsAdapter>
      </ProgressProvider>
    </SerwistProvider>
  )
}
