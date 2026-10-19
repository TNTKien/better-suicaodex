import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { currentAccountOptions } from "../modules/account/api"
import { refreshShopPurchase } from "../modules/shop/api"

const apiBaseUrl = "https://api.example.test"
let identity: { userId: string; sessionId: string } | null = {
  userId: "reader",
  sessionId: "session",
}
let status = "authenticated"
let profileStatus = "active"
const client = new QueryClient()
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    identity,
    status,
    user: status === "guest" ? null : { name: "Độc giả", image: null },
    account: {
      user: { role: "user" },
      profile: { status: profileStatus },
      coinBalance: client.getQueryData<{ coinBalance: string }>(
        currentAccountOptions(apiBaseUrl, identity).queryKey
      )?.coinBalance,
    },
    signOut: { isPending: false, isError: false, mutate: () => {} },
  }),
}))
const container = ({ children }: { children?: ReactNode }) =>
  createElement("div", null, children)
mock.module("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: container,
  DropdownMenuContent: container,
  DropdownMenuGroup: container,
  DropdownMenuItem: container,
  DropdownMenuLabel: container,
  DropdownMenuSeparator: container,
  DropdownMenuTrigger: container,
}))
mock.module("@workspace/ui/components/sidebar", () => ({
  SidebarMenu: container,
  SidebarMenuItem: container,
  SidebarMenuButton: container,
  useSidebar: () => ({ isMobile: false, setOpenMobile: () => {} }),
}))
mock.module("../modules/account/profile", () => ({ ProfileAvatar: container }))
mock.module("next/link", () => ({ default: container }))
mock.module("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}))

const { NavUser } = await import("../components/nav-user")
const renderNav = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NavUser />
    </QueryClientProvider>
  )
try {
  assert.match(renderNav(), /Số dư chưa khả dụng/)
  const options = currentAccountOptions(apiBaseUrl, identity)
  client.setQueryData([...options.queryKey], {
    coinBalance: "9007199254740993",
  })
  let markup = renderNav()
  assert.match(markup, /Độc giả[\s\S]*Số dư của bạn[\s\S]*Tài khoản/)
  assert.match(markup, /suicao_coin.webp/)
  assert.match(markup, /9\.007\.199\.254\.740\.993 coin/)
  client.setQueryData([...options.queryKey], { coinBalance: "0" })
  assert.match(renderNav(), />0 coin</)
  await refreshShopPurchase(client, apiBaseUrl, identity!)
  assert.equal(client.getQueryState(options.queryKey)?.isInvalidated, true)

  identity = { ...identity!, sessionId: "other" }
  markup = renderNav()
  assert.match(markup, /Số dư chưa khả dụng/)
  assert.doesNotMatch(markup, />0 coin</)

  for (const hiddenState of ["inactive", "error", "guest"]) {
    status = hiddenState === "inactive" ? "authenticated" : hiddenState
    profileStatus = hiddenState === "inactive" ? "banned" : "active"
    assert.doesNotMatch(renderNav(), /Số dư của bạn/)
  }
} finally {
  client.clear()
}
console.log("Nav user balance rendering and shared account cache checks passed")
