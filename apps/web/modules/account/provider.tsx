"use client"

import { createContext, useContext } from "react"
import { useAccountState as useSharedAccountState } from "@workspace/account/provider"

import { useReadingHistorySync } from "@/modules/reading/sync"
import type { CurrentAccount } from "./api"

export type { AccountStatus } from "@workspace/account/provider"

function useAccountState(apiBaseUrl: string) {
  const value = useSharedAccountState<CurrentAccount>(apiBaseUrl)
  useReadingHistorySync(
    apiBaseUrl,
    value.status === "authenticated" ? (value.user?.id ?? null) : null
  )
  return value
}

const AccountContext = createContext<ReturnType<typeof useAccountState> | null>(
  null
)

export function AccountProvider({
  apiBaseUrl,
  children,
}: {
  apiBaseUrl: string
  children: React.ReactNode
}) {
  const value = useAccountState(apiBaseUrl)
  return <AccountContext value={value}>{children}</AccountContext>
}

export function useAccount() {
  const account = useContext(AccountContext)
  if (!account)
    throw new Error("useAccount must be used within AccountProvider")
  return account
}
