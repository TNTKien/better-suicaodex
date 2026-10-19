"use client"

import { redirect } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { AccountApiError, administratorAccessOptions } from "./api"
import { useAccount, type AccountStatus } from "./provider"

type AccessStatus = "allowed" | "denied" | "error" | "pending"

export function resolveAdminRedirect(
  accountStatus: AccountStatus,
  accessStatus: AccessStatus,
  loginPage: boolean
) {
  if (accountStatus === "guest") return loginPage ? null : "/admin/login"
  if (accountStatus !== "authenticated") return null
  if (accessStatus === "denied") return "/"
  if (loginPage && accessStatus === "allowed") return "/admin/groups"
  return null
}

export function AdminGate({
  children,
  loginPage = false,
}: {
  children: React.ReactNode
  loginPage?: boolean
}) {
  const account = useAccount()
  const access = useQuery(
    administratorAccessOptions(
      account.apiBaseUrl,
      account.status === "authenticated" ? (account.user?.id ?? null) : null
    )
  )
  const accessStatus: AccessStatus = access.isSuccess
    ? "allowed"
    : access.error instanceof AccountApiError && access.error.status === 403
      ? "denied"
      : access.isError
        ? "error"
        : "pending"
  const destination = resolveAdminRedirect(
    account.status,
    accessStatus,
    loginPage
  )

  if (destination) redirect(destination)
  if (
    (loginPage && account.status === "guest") ||
    (!loginPage &&
      account.status === "authenticated" &&
      accessStatus === "allowed")
  )
    return children

  if (account.status === "error" || accessStatus === "error")
    return (
      <main className="grid min-h-svh place-items-center p-4">
        <Button
          variant="outline"
          onClick={() => void account.retry().then(() => access.refetch())}
        >
          Thử lại
        </Button>
      </main>
    )

  return (
    <main className="grid min-h-svh place-items-center">
      <Spinner aria-label="Đang xác minh quyền quản trị" />
    </main>
  )
}
