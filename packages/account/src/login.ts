"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, type useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

import { safeReturnTo } from "./api"
import {
  socialSignInOptions,
  type createAccountClient,
  type SocialProvider,
} from "./client"
import type { AccountStatus } from "./provider"

export function useLogin({
  client,
  status,
  router,
}: {
  client: ReturnType<typeof createAccountClient>
  status: AccountStatus
  router: Pick<ReturnType<typeof useRouter>, "replace">
}) {
  const params = useSearchParams()
  const returnTo = safeReturnTo(params.get("returnTo"))
  const complete = params.get("complete") === "1"
  const redirected = useRef(false)
  const signIn = useMutation({
    networkMode: "always",
    mutationFn: async (provider: SocialProvider) => {
      const result = await client.signIn.social(
        socialSignInOptions(provider, window.location.origin, returnTo)
      )
      if (result.error || !result.data?.url)
        throw new Error("Không thể bắt đầu đăng nhập. Vui lòng thử lại.")
    },
    onError: () => {
      toast.add({
        type: "error",
        title: "Không thể bắt đầu đăng nhập. Vui lòng thử lại.",
      })
    },
  })

  useEffect(() => {
    if (status !== "authenticated" || redirected.current) return
    redirected.current = true
    if (complete) toast.add({ type: "success", title: "Đăng nhập thành công" })
    router.replace(returnTo)
  }, [complete, status, returnTo, router])

  return { params, returnTo, complete, signIn }
}
