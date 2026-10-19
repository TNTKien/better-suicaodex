import assert from "node:assert/strict"
import type { ContextType, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime"

import LoginPage from "../app/login/page"
import { HeaderAccount } from "../components/header-account"
import { AccountContext } from "../modules/account/provider"
import { loginHref, safeReturnTo } from "../modules/account/api"
import {
  createAccountClient,
  socialSignInOptions,
} from "../modules/account/client"

const originalFetch = globalThis.fetch
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL
const returnTo = "/advanced-search?q=hoa%20%26%20nang#results"
assert.equal(safeReturnTo(returnTo), returnTo)
for (const unsafe of [
  "https://evil.test/",
  "//evil.test/",
  "/\\evil.test",
  "/%2f%2fevil.test",
  "/%5cevil.test",
  "/login?returnTo=/login",
  "/api/auth/sign-out",
])
  assert.equal(safeReturnTo(unsafe), "/")
const redirect = socialSignInOptions(
  "discord",
  "https://new-ui.suicaodex.com",
  returnTo
)
assert.equal(
  new URL(redirect.callbackURL).searchParams.get("returnTo"),
  returnTo
)
assert.equal(
  new URL(redirect.errorCallbackURL).searchParams.get("returnTo"),
  returnTo
)
assert.equal(
  new URL(loginHref(returnTo), "https://new-ui.suicaodex.com").searchParams.get(
    "returnTo"
  ),
  returnTo
)
try {
  process.env.NEXT_PUBLIC_API_URL = "https://api.example.test"
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input)).pathname
    assert.equal(new URL(String(input)).origin, "https://api.example.test")
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.equal(new Headers(init?.headers).has("X-Internal-API-Key"), false)
    if (path === "/api/auth/get-session") return Response.json(null)
    if (path === "/api/auth/sign-out") {
      assert.equal(init?.method, "POST")
      return Response.json({ success: true })
    }
    assert.equal(path, "/api/auth/sign-in/social")
    assert.equal(init?.method, "POST")
    const body = JSON.parse(String(init?.body))
    assert.ok(["discord", "github", "google"].includes(body.provider))
    assert.equal(
      body.callbackURL,
      "https://new-ui.suicaodex.com/login?returnTo=%2F&complete=1"
    )
    assert.equal(
      body.errorCallbackURL,
      "https://new-ui.suicaodex.com/login?returnTo=%2F&error=oauth"
    )
    assert.equal("password" in body, false)
    return Response.json({
      url: "https://oauth.example.test/authorize",
      redirect: true,
    })
  }) as typeof fetch
  const client = createAccountClient()
  const session = await client.getSession()
  assert.equal(session.error, null)
  assert.equal(session.data, null)
  for (const provider of ["discord", "github", "google"] as const) {
    const result = await client.signIn.social(
      socialSignInOptions(provider, "https://new-ui.suicaodex.com", "/")
    )
    assert.equal(result.error, null)
    assert.equal(result.data?.url, "https://oauth.example.test/authorize")
  }
  assert.equal((await client.signOut()).error, null)
  const localCallback = socialSignInOptions(
    "discord",
    "http://localhost:3002",
    "/"
  )
  assert.equal(
    localCallback.callbackURL,
    "http://localhost:3002/login?returnTo=%2F&complete=1"
  )
  assert.throws(
    () => socialSignInOptions("discord", "file:///tmp", "/"),
    /http or https/
  )

  globalThis.fetch = (async () =>
    Response.json(
      { message: "Provider unavailable", code: "PROVIDER_NOT_FOUND" },
      { status: 400 }
    )) as typeof fetch
  assert.equal(
    (
      await createAccountClient().signIn.social(
        socialSignInOptions("google", "https://new-ui.suicaodex.com", "/")
      )
    ).error?.status,
    400
  )
  globalThis.fetch = (async () =>
    Response.json(
      { message: "Sign out failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    )) as typeof fetch
  assert.equal((await createAccountClient().signOut()).error?.status, 500)
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl
}

type Account = NonNullable<ContextType<typeof AccountContext>>

function renderAccountUI(
  children: ReactNode,
  status: Account["status"] = "guest",
  params = ""
) {
  const client = new QueryClient()
  const account = {
    client: createAccountClient(),
    status,
    user:
      status === "authenticated"
        ? { id: "reader", name: "Reader <script>" }
        : null,
    retry: async () => {},
    signOut: { isPending: false, isError: false, mutate: () => {} },
  } as unknown as Account
  const router = {
    bfcacheId: "test-navigation",
    back() {},
    forward() {},
    refresh() {},
    hmrRefresh() {},
    push() {},
    replace() {},
    prefetch() {},
  }
  try {
    return renderToStaticMarkup(
      <AppRouterContext value={router}>
        <SearchParamsContext value={new URLSearchParams(params)}>
          <QueryClientProvider client={client}>
            <AccountContext value={account}>{children}</AccountContext>
          </QueryClientProvider>
        </SearchParamsContext>
      </AppRouterContext>
    )
  } finally {
    client.clear()
  }
}

const guest = renderAccountUI(<HeaderAccount />)
assert.match(guest, /href="\/login"/)
assert.match(guest, />Đăng nhập<\/a>/)
const loading = renderAccountUI(<HeaderAccount />, "loading")
assert.match(loading, /aria-busy="true"/)
const authenticated = renderAccountUI(<HeaderAccount />, "authenticated")
assert.match(authenticated, /Hi, Reader &lt;script&gt;/)
assert.match(authenticated, /aria-haspopup="menu"/)
assert.doesNotMatch(authenticated, /<script>/)
assert.doesNotMatch(authenticated, /href="\/login"/)

const mobileAccount = renderAccountUI(<HeaderAccount mobile />, "authenticated")
assert.match(mobileAccount, /href="\/profile\/reader"/)
const uploadLink = mobileAccount.match(
  /<a\b[^>]*href="http:\/\/localhost:3000\/manage\/group"[^>]*>/
)?.[0]
assert.ok(uploadLink)
assert.match(uploadLink, /target="_blank"/)
assert.match(uploadLink, /rel="noopener noreferrer"/)
assert.match(
  mobileAccount,
  /Hi, Reader &lt;script&gt;[\s\S]*Tường nhà bạn[\s\S]*Đăng truyện[\s\S]*Đăng xuất/
)
assert.doesNotMatch(
  mobileAccount,
  /aria-haspopup="menu"|dropdown-menu|Sắp bổ sung/
)
const mobileError = renderAccountUI(<HeaderAccount mobile />, "error")
assert.match(mobileError, /Thử tải lại tài khoản/)
assert.match(mobileError, /Đăng xuất/)
assert.doesNotMatch(mobileError, /aria-haspopup="menu"/)

const login = renderAccountUI(<LoginPage />)
assert.match(login, /id="login-title"[^>]*>Đăng nhập<\/h1>/)
assert.match(login, /id="login-info-title"[^>]*>Thông tin<\/h2>/)
for (const provider of ["Discord", "GitHub", "Google"])
  assert.ok(login.includes(provider))
assert.equal((login.match(/<button\b/g) ?? []).length, 3)
assert.doesNotMatch(login, /<input\b|type="password"/)
assert.doesNotMatch(login, /\sdisabled=""/)
const loginLoading = renderAccountUI(<LoginPage />, "loading")
assert.equal((loginLoading.match(/\sdisabled=""/g) ?? []).length, 3)
const loginError = renderAccountUI(<LoginPage />, "error")
assert.match(loginError, /Không thể kiểm tra phiên đăng nhập/)
assert.match(loginError, /Thử lại/)
assert.match(
  renderAccountUI(<LoginPage />, "guest", "error=oauth"),
  /Đăng nhập chưa hoàn tất/
)
assert.match(
  renderAccountUI(<LoginPage />, "guest", "complete=1"),
  /Chưa xác nhận được phiên đăng nhập/
)
assert.match(
  renderAccountUI(<LoginPage />, "authenticated"),
  /Đang chuyển trang/
)

const headerError = renderAccountUI(<HeaderAccount />, "error")
assert.match(headerError, /Thử tải lại tài khoản/)
assert.doesNotMatch(headerError, /href="\/login"/)
const confirming = renderAccountUI(<LoginPage />, "loading", "complete=1")
assert.match(confirming, /Đang xác nhận đăng nhập/)
assert.doesNotMatch(confirming, /<button/)

console.log("web-hvn account checks passed")
