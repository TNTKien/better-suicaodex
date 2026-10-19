"use client"

import { createContext, useContext } from "react"
import { useAccountState as useSharedAccountState } from "@workspace/account/provider"
import { useReadingHistorySync } from "@workspace/account/reading-sync"

import { getApiBaseUrl } from "@/lib/api-url"
import type { CurrentAccount } from "./api"

function useAccountState() {
  const value = useSharedAccountState<CurrentAccount>(getApiBaseUrl())
  useReadingHistorySync(
    value.apiBaseUrl,
    value.status === "authenticated" ? (value.user?.id ?? null) : null
  )
  return value
}

export const AccountContext = createContext<ReturnType<
  typeof useAccountState
> | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const account = useAccountState()
  return <AccountContext value={account}>{children}</AccountContext>
}

export function useAccount() {
  const account = useContext(AccountContext)
  if (!account)
    throw new Error("useAccount must be used within AccountProvider")
  return account
}
