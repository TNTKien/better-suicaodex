import assert from "node:assert/strict"
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

import { AccountApiError, currentAccountOptions } from "../modules/account/api"

const feedback = []
let refetchCount = 0
let refetchOptions
let signOutFails = false
let sessionPending = false
let sessionError = null
let hasSession = true
const sessionData = {
  user: { id: "reader", name: "Reader" },
  session: { id: "session" },
}
const refetch = async (options) => {
  refetchCount++
  refetchOptions = options
}

mock.module("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({
      data: hasSession ? sessionData : null,
      isPending: sessionPending,
      error: sessionError,
      refetch,
    }),
    signOut: async () => ({
      error: signOutFails ? { message: "failed" } : null,
    }),
  }),
}))
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: ({ type, title }) => feedback.push(`${type}:${title}`),
  },
}))

const { AccountProvider, useAccount } =
  await import("../modules/account/provider")
const apiBaseUrl = "http://localhost:3001"
const identity = { userId: "reader", sessionId: "session" }
const options = currentAccountOptions(apiBaseUrl, identity)
const account = {
  coinBalance: "0",
  linkedProviders: ["discord"],
  user: {
    id: "reader",
    name: "Reader",
    email: "reader@example.test",
    emailVerified: true,
    image: null,
    avatarFrame: null,
    role: "user",
    createdAt: "2026-10-14T00:00:00Z",
    updatedAt: "2026-10-14T00:00:00Z",
  },
  profile: {
    bio: null,
    isPublic: true,
    status: "active",
    createdAt: "2026-10-14T00:00:00Z",
    updatedAt: "2026-10-14T00:00:00Z",
  },
}
let state
function CaptureAccount() {
  state = useAccount()
  return null
}
function renderAccount(client) {
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountProvider>
        <CaptureAccount />
      </AccountProvider>
    </QueryClientProvider>
  )
  return state
}

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL
process.env.NEXT_PUBLIC_API_URL = apiBaseUrl
const client = new QueryClient()
try {
  sessionPending = true
  assert.equal(renderAccount(client).status, "loading")
  sessionPending = false
  hasSession = false
  assert.equal(renderAccount(client).status, "guest")
  hasSession = true
  assert.equal(
    renderAccount(client).status,
    "loading",
    "Session alone is insufficient"
  )

  for (const status of ["active", "suspended", "banned"]) {
    client.setQueryData(options.queryKey, {
      ...account,
      profile: { ...account.profile, status },
    })
    const result = renderAccount(client)
    assert.equal(result.status, "authenticated")
    assert.deepEqual(result.identity, identity)
    assert.equal(result.account?.profile.status, status)
  }

  const query = client.getQueryCache().find({ queryKey: options.queryKey })
  query.setState({ status: "error", error: new AccountApiError(500) })
  assert.equal(renderAccount(client).status, "error")
  assert.equal(state.account, null)
  assert.equal(
    state.user?.id,
    "reader",
    "Profile errors retain the session user"
  )
  query.setState({ status: "error", error: new AccountApiError(401) })
  assert.equal(renderAccount(client).status, "guest")
  assert.equal(state.user, null)
  assert.equal(state.identity, null)

  sessionError = new Error("Session unavailable")
  assert.equal(renderAccount(client).status, "error")
  assert.equal(state.user, null)
  sessionError = null
  hasSession = false
  const guest = renderAccount(client)
  client.setQueryData(["catalog", "tags"], ["public"])
  const privateKeys = ["account", "library", "reading", "notifications"]
  const cancelled = new Set()
  const requests = privateKeys.map((key) => {
    client.setQueryData([key, "private"], "private")
    return client
      .fetchQuery({
        queryKey: [key, "private"],
        queryFn: ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                cancelled.add(key)
                reject(new Error("aborted"))
              },
              { once: true }
            )
          }),
      })
      .catch(() => undefined)
  })

  signOutFails = true
  await assert.rejects(guest.signOut.mutateAsync())
  assert.equal(cancelled.size, 0)
  assert.equal(refetchCount, 0)
  for (const key of privateKeys)
    assert.equal(client.getQueryData([key, "private"]), "private")
  assert.deepEqual(feedback, [
    "error:Đăng xuất chưa thành công. Vui lòng thử lại.",
  ])

  signOutFails = false
  feedback.length = 0
  await guest.signOut.mutateAsync()
  await Promise.all(requests)
  assert.deepEqual(cancelled, new Set(privateKeys))
  for (const key of privateKeys)
    assert.equal(client.getQueryData([key, "private"]), undefined)
  assert.deepEqual(client.getQueryData(["catalog", "tags"]), ["public"])
  assert.equal(refetchCount, 1)
  assert.equal(refetchOptions, undefined)
  assert.deepEqual(feedback, ["success:Đăng xuất thành công"])

  client.setQueryData(options.queryKey, account)
  await guest.refreshAccount()
  assert.deepEqual(refetchOptions, { query: { disableCookieCache: true } })
  assert.equal(client.getQueryState(options.queryKey)?.isInvalidated, true)
  await guest.retry()
  assert.equal(refetchOptions, undefined)
  assert.equal(refetchCount, 3)
} finally {
  client.clear()
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl
}

console.log("web-hvn shared account state and logout checks passed")
