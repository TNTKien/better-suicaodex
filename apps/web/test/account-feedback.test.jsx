import assert from "node:assert/strict"
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

const feedback = []
let signOutFails = false
let refetched = false
let refetchQuery
let params = new URLSearchParams("complete=1&returnTo=/manage/account")
mock.module("next/navigation", () => ({
  usePathname: () => "/manage/account",
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => params,
}))
mock.module("@bprogress/next/app", () => ({
  useRouter: () => ({ replace: () => {} }),
}))
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: ({ type, title }) => feedback.push(`${type}:${title}`),
  },
}))
mock.module("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({
      data: null,
      error: null,
      isPending: false,
      refetch: async (query) => {
        refetched = true
        refetchQuery = query
      },
    }),
    signOut: async () => ({
      error: signOutFails ? { message: "failed" } : null,
    }),
  }),
}))

const { AccountProvider, useAccount } =
  await import("../modules/account/provider")
const client = new QueryClient()
let logout
let refreshAccount
function CaptureAccount() {
  const account = useAccount()
  logout = account.signOut
  refreshAccount = account.refreshAccount
  return null
}
renderToStaticMarkup(
  <QueryClientProvider client={client}>
    <AccountProvider apiBaseUrl="https://api.example.test">
      <CaptureAccount />
    </AccountProvider>
  </QueryClientProvider>
)
try {
  client.setQueryData(["account", "private"], { name: "private" })
  client.setQueryData(["library", "private"], { manga: "private" })
  signOutFails = true
  await assert.rejects(logout.mutateAsync())
  assert.deepEqual(feedback, [
    "error:Đăng xuất chưa thành công. Vui lòng thử lại.",
  ])
  assert.equal(refetched, false)
  assert.ok(
    client.getQueryData(["account", "private"]),
    "Failure preserves private cache"
  )

  feedback.length = 0
  signOutFails = false
  await logout.mutateAsync()
  assert.deepEqual(feedback, ["success:Đăng xuất thành công"])
  assert.equal(refetched, true)
  assert.equal(refetchQuery, undefined)
  assert.equal(client.getQueryData(["account", "private"]), undefined)
  assert.equal(client.getQueryData(["library", "private"]), undefined)

  refetched = false
  await refreshAccount()
  assert.equal(refetched, true)
  assert.deepEqual(refetchQuery, {
    query: { disableCookieCache: true },
  })
} finally {
  client.clear()
}

let status = "authenticated"
let account = null
const signOut = { isPending: false, isError: false, mutate: () => {} }
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    status,
    account,
    apiBaseUrl: "https://api.example.test",
    identity: account
      ? { userId: account.user.id, sessionId: "session" }
      : null,
    signOut,
    client: {},
    retry: async () => {},
  }),
}))
const { Login } = await import("../modules/account/login")
const loginClient = new QueryClient()
function renderLogin() {
  return renderToStaticMarkup(
    <QueryClientProvider client={loginClient}>
      <Login />
    </QueryClientProvider>
  )
}
try {
  for (const query of [
    "complete=1&returnTo=/manage/account",
    "returnTo=/manage/account",
  ]) {
    params = new URLSearchParams(query)
    const markup = renderLogin()
    assert.equal(markup, "", "Authenticated redirect does not flash login UI")
  }
  params = new URLSearchParams("complete=1&returnTo=/manage/account")
  status = "loading"
  assert.match(renderLogin(), /Đang xác nhận đăng nhập/)
  assert.doesNotMatch(renderLogin(), /<button/)
  params = new URLSearchParams("returnTo=/manage/account")
  const loadingMarkup = renderLogin()
  assert.doesNotMatch(loadingMarkup, /Đang kiểm tra phiên đăng nhập/)
  assert.equal(
    (loadingMarkup.match(/<button[^>]*disabled=""/g) ?? []).length,
    3
  )
  status = "guest"
  const guestMarkup = renderLogin()
  assert.equal((guestMarkup.match(/<button/g) ?? []).length, 3)
  assert.doesNotMatch(guestMarkup, /<button[^>]*disabled=""/)
  assert.match(guestMarkup, /Tiếp tục với Google/)
  assert.match(guestMarkup, /Tiếp tục với GitHub/)
  params = new URLSearchParams("complete=1&returnTo=/manage/account")
  assert.match(renderLogin(), /Đăng nhập chưa hoàn tất/)
  status = "error"
  assert.match(renderLogin(), /Chưa kiểm tra được phiên đăng nhập/)
} finally {
  loginClient.clear()
}
console.log("Account redirect UI and logout feedback checks passed")

const { AccountDetails } = await import("../modules/account/account-details")
const renderAccount = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={loginClient}>
      <AccountDetails />
    </QueryClientProvider>
  )
account = {
  user: {
    id: "reader-id",
    name: "Reader <script>",
    image: null,
    email: "private@example.test",
    emailVerified: true,
    createdAt: "2026-09-03T23:00:00Z",
    updatedAt: "2026-09-04T23:30:00Z",
  },
  linkedProviders: ["discord", "github"],
  profile: {
    bio: "<img src=x onerror=alert(1)>",
    isPublic: true,
    status: "active",
    createdAt: "2026-09-03T23:00:00Z",
    updatedAt: "2026-09-04T23:30:00Z",
  },
}
status = "authenticated"
let markup = renderAccount()
assert.match(markup, /reader-id/)
assert.match(markup, /04\/09\/2026/)
assert.match(markup, /06:30 - 05\/09\/2026/)
assert.match(markup, /&lt;script&gt;/)
assert.match(markup, /href="\/profile\/reader-id"/)
assert.match(markup, /Tài khoản liên kết/)
assert.match(markup, /Discord/)
assert.match(markup, /GitHub/)
assert.match(markup, /Chỉnh sửa hồ sơ/)
assert.match(markup, /Khung Avatar/)
assert.match(markup, /overflow-hidden rounded-full after:rounded-full/)
assert.match(markup, /aria-haspopup="dialog"/)
assert.match(
  markup,
  /Chỉnh sửa hồ sơ[\s\S]*Xem trang cá nhân<\/a><button[^>]*data-slot="dialog-trigger"[^>]*>[\s\S]*Khung Avatar<\/button><button[^>]*>[\s\S]*Đăng xuất/,
  "Warehouse button shares the existing account action row"
)
assert.doesNotMatch(markup, /collapsible|Đang dùng:|Xem thử khung|Tải lại/)
assert.doesNotMatch(markup, /<input|<textarea|<script>|<img src=x/)
account.profile.isPublic = false
assert.doesNotMatch(renderAccount(), /href="\/profile\//)
account.profile.isPublic = true
account.profile.status = "suspended"
assert.match(renderAccount(), /Tạm hạn chế/)
assert.match(renderAccount(), /Tài khoản đang bị tạm hạn chế/)
assert.doesNotMatch(renderAccount(), /Chỉnh sửa hồ sơ/)
assert.doesNotMatch(renderAccount(), /href="\/profile\//)
account.profile.status = "banned"
assert.match(renderAccount(), /Đã ban/)
assert.match(renderAccount(), /Tài khoản đã bị ban/)
assert.doesNotMatch(renderAccount(), /href="\/profile\//)
for (const state of ["loading", "guest"]) {
  status = state
  assert.doesNotMatch(
    renderAccount(),
    /private@example.test|reader-id|Khung Avatar/
  )
}
status = "error"
account = null
assert.match(renderAccount(), /Chưa tải được tài khoản/)
assert.match(renderAccount(), /Đăng xuất/)
console.log("Account profile layout checks passed")
