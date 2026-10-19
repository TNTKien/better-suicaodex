"use client"

import { useState } from "react"
import { SerwistProvider } from "@serwist/next/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/next/app"

const serviceWorkerOptions: RegistrationOptions = {
  scope: "/",
  updateViaCache: "none",
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return (
    <SerwistProvider
      cacheOnNavigation={false}
      disable={process.env.NODE_ENV !== "production"}
      options={serviceWorkerOptions}
      reloadOnOnline={false}
      swUrl="/sw.js"
    >
      <NuqsAdapter>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NuqsAdapter>
    </SerwistProvider>
  )
}
