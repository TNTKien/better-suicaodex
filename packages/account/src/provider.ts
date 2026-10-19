"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

import { AccountApiError, currentAccountOptions } from "./api"
import { createAccountClient } from "./client"

export type AccountStatus = "authenticated" | "error" | "guest" | "loading"

export function useAccountState<T extends { user: { id: string } }>(
  apiBaseUrl: string
) {
  const [client] = useState(() => createAccountClient(apiBaseUrl))
  const session = client.useSession()
  const queryClient = useQueryClient()
  const identity =
    session.data && !session.error
      ? {
          userId: session.data.user.id,
          sessionId: session.data.session.id,
        }
      : null
  const me = useQuery(currentAccountOptions<T>(apiBaseUrl, identity))
  const expired = me.error instanceof AccountApiError && me.error.status === 401
  const { refetch } = session

  const refreshAccount = async () => {
    await refetch({ query: { disableCookieCache: true } })
    await queryClient.invalidateQueries({ queryKey: ["account"] })
  }

  useEffect(() => {
    if (expired) void refetch()
  }, [expired, refetch])

  const signOut = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const result = await client.signOut()
      if (result.error)
        throw new Error("Đăng xuất chưa thành công. Vui lòng thử lại.")
      await queryClient.cancelQueries({ queryKey: ["account"] })
      await queryClient.cancelQueries({ queryKey: ["library"] })
      await queryClient.cancelQueries({ queryKey: ["reading"] })
      await queryClient.cancelQueries({ queryKey: ["notifications"] })
      queryClient.removeQueries({ queryKey: ["account"] })
      queryClient.removeQueries({ queryKey: ["library"] })
      queryClient.removeQueries({ queryKey: ["reading"] })
      queryClient.removeQueries({ queryKey: ["notifications"] })
      await refetch()
    },
    onSuccess: () => {
      toast.add({ type: "success", title: "Đăng xuất thành công" })
    },
    onError: () => {
      toast.add({
        type: "error",
        title: "Đăng xuất chưa thành công. Vui lòng thử lại.",
      })
    },
  })

  const status: AccountStatus = session.isPending
    ? "loading"
    : session.error
      ? "error"
      : !identity || expired
        ? "guest"
        : me.isPending
          ? "loading"
          : me.isError
            ? "error"
            : "authenticated"

  return {
    apiBaseUrl,
    client,
    status,
    account: status === "authenticated" ? me.data : null,
    identity: status === "authenticated" ? identity : null,
    user: !session.error && !expired ? session.data?.user : null,
    error: "Không thể tải thông tin tài khoản. Vui lòng thử lại.",
    signOut,
    refreshAccount,
    retry: async () => {
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ["account"] })
    },
  }
}
