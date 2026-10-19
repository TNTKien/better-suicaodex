import { createAuthClient } from "better-auth/react"

import { loginHref } from "./api"

export function createAccountClient(apiBaseUrl: string) {
  return createAuthClient({
    baseURL: apiBaseUrl,
    fetchOptions: {
      credentials: "include",
      cache: "no-store",
      timeout: 8_000,
    },
  })
}

export type SocialProvider = "discord" | "github" | "google"

export function socialSignInOptions(
  provider: SocialProvider,
  origin: string,
  returnTo: string
) {
  const callback = new URL(loginHref(returnTo), origin)
  if (!["http:", "https:"].includes(callback.protocol)) {
    throw new Error("Login origin must use http or https")
  }
  const errorCallback = new URL(callback)
  callback.searchParams.set("complete", "1")
  errorCallback.searchParams.set("error", "oauth")
  return {
    provider,
    callbackURL: callback.toString(),
    errorCallbackURL: errorCallback.toString(),
  }
}
