import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime"

import { AppSidebar } from "../components/app-sidebar"
import { siteConfig } from "../config/site"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AccountProvider } from "../modules/account/provider"
import { resolveAdminRedirect } from "../modules/account/admin-gate"
import { resolveGroupView } from "../modules/groups/workspace"

const destinations = [
  ["Trang chủ", "/"],
  ["Đăng truyện", "/manage/group"],
  ["Cửa hàng", "/shop"],
  ["Thư viện", "/my-library"],
  ["Lịch sử đọc", "/history"],
  ["Mới cập nhật", "/latest"],
  ["Tìm kiếm nâng cao", "/advanced-search"],
  ["Truyện ngẫu nhiên", "/random"],
  ["Thể loại", "/tags"],
  ["Nhóm dịch", "/groups"],
  ["Thông báo", "/system-notice"],
  ["Chính sách bảo mật", "/privacy-policy"],
  ["Điều khoản dịch vụ", "/terms-of-service"],
  ["Bản quyền", "/copyright"],
]

const sidebarLinks = siteConfig.sidebarLinks.map(({ title, url }) => [
  title,
  url,
])

function renderSidebar(
  pathname: string | null,
  open = true,
  area: "admin" | "manage" | "site" = "site"
) {
  return renderToStaticMarkup(
    <PathnameContext.Provider value={pathname}>
      <TooltipProvider>
        <SidebarProvider defaultOpen={open}>
          <QueryClientProvider client={new QueryClient()}>
            <AccountProvider apiBaseUrl="http://localhost:3001">
              <AppSidebar area={area} side="right" />
            </AccountProvider>
          </QueryClientProvider>
        </SidebarProvider>
      </TooltipProvider>
    </PathnameContext.Provider>
  )
}

const manageDestinations = [
  ["Nhóm dịch", "/manage/group"],
  ["Thêm truyện mới", "/manage/manga/new"],
  ["Truyện của nhóm", "/manage/group/mangas"],
  ["Về trang chủ", "/"],
]

const adminMarkup = renderSidebar("/admin/groups", true, "admin")
const adminNavigation = adminMarkup.match(
  /<nav aria-label="Điều hướng quản trị">([\s\S]*?)<\/nav>/
)![1]!
assert.match(adminNavigation, /href="\/admin\/groups"/)
assert.match(adminNavigation, /href="\/admin\/users"/)
assert.match(adminNavigation, /href="\/admin\/avatar-frames"/)
assert.match(adminNavigation, /href="\/admin\/shop"/)
assert.match(adminNavigation, /href="\/admin\/mangas"/)
assert.match(adminNavigation, /href="\/admin\/tags"/)
assert.match(adminNavigation, /href="\/admin\/comments\/list"/)
assert.match(adminNavigation, /href="\/admin\/comments\/forbidden-words"/)
assert.match(adminNavigation, /href="\/admin\/image-server2"/)
assert.match(adminNavigation, /href="\/admin\/system-notice"/)
assert.match(adminNavigation, /href="\/admin\/audit"/)
assert.match(adminNavigation, /aria-current="page"/)

const adminUserMarkup = renderSidebar("/admin/user/user-1", true, "admin")
const adminUserNavigation = adminUserMarkup.match(
  /<nav aria-label="Điều hướng quản trị">([\s\S]*?)<\/nav>/
)![1]!
const userLink = adminUserNavigation.match(
  /<a\b([^>]*href="\/admin\/users"[^>]*)>/
)![1]!
assert.match(userLink, /aria-current="page"/)

const adminCommentMarkup = renderSidebar(
  "/admin/comments/forbidden-words",
  true,
  "admin"
)
const adminCommentNavigation = adminCommentMarkup.match(
  /<nav aria-label="Điều hướng quản trị">([\s\S]*?)<\/nav>/
)![1]!
const forbiddenWordLink = adminCommentNavigation.match(
  /<a\b([^>]*href="\/admin\/comments\/forbidden-words"[^>]*)>/
)![1]!
assert.match(forbiddenWordLink, /aria-current="page"/)
assert.equal(resolveAdminRedirect("guest", "pending", false), "/admin/login")
assert.equal(resolveAdminRedirect("guest", "pending", true), null)
assert.equal(resolveAdminRedirect("authenticated", "denied", false), "/")
assert.equal(resolveAdminRedirect("authenticated", "denied", true), "/")
assert.equal(
  resolveAdminRedirect("authenticated", "allowed", true),
  "/admin/groups"
)
assert.equal(resolveAdminRedirect("authenticated", "allowed", false), null)

for (const pathname of [
  "/manage/group",
  "/manage/manga/new",
  "/manage/group/mangas",
  "/manage/manga/abc",
]) {
  const markup = renderSidebar(pathname, true, "manage")
  const navigation = markup.match(
    /<nav aria-label="Điều hướng quản lý">([\s\S]*?)<\/nav>/
  )![1]!
  const links = [...navigation.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(
    ([, attributes, content]) => ({
      title: content!.replace(/<[^>]*>/g, ""),
      href: attributes!.match(/href="([^"]*)"/)?.[1],
      active: attributes!.includes('aria-current="page"'),
    })
  )
  assert.deepEqual(
    links,
    manageDestinations.map(([title, href]) => ({
      title,
      href,
      active:
        pathname === href ||
        (href !== "/manage/group" && pathname.startsWith(`${href}/`)),
    }))
  )
  assert.match(navigation, />Quản lý truyện</)
}

assert.equal(resolveGroupView(null, null), "empty")
assert.equal(resolveGroupView("rejected", "approved"), "empty")
assert.equal(resolveGroupView("approved", "rejected"), "empty")
assert.equal(resolveGroupView("pending", "approved"), "pending")
assert.equal(resolveGroupView("approved", "pending"), "pending")
assert.equal(resolveGroupView("approved", "approved"), "joined")

for (const pathname of [
  null,
  ...destinations.map(([, url]) => url!),
  "/manga/id/slug",
]) {
  const markup = renderSidebar(pathname)
  const navigation = markup.match(
    /<nav aria-label="Điều hướng chính">([\s\S]*?)<\/nav>/
  )![1]!
  const links = [...navigation.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(
    ([, attributes, content]) => ({
      title: content!.replace(/<[^>]*>/g, ""),
      href: attributes!.match(/href="([^"]*)"/)?.[1],
      active: attributes!.includes('aria-current="page"'),
    })
  )
  assert.deepEqual(
    links,
    [...destinations, ...sidebarLinks].map(([title, href]) => ({
      title,
      href,
      active: pathname === href,
    }))
  )
  assert.match(markup, /<nav aria-label="Điều hướng chính">/)
  assert.match(markup, /data-slot="sidebar-header"/)
  assert.match(markup, /aria-label="Đang tải tài khoản"/)
  assert.match(markup, /data-slot="sidebar-footer"/)
  assert.ok(!markup.includes(`v${siteConfig.version}`))
  assert.doesNotMatch(markup, /© /)
  assert.doesNotMatch(markup, /Danh sách truyện/)
}

const collapsed = renderSidebar("/", false)
assert.match(collapsed, /data-state="collapsed"/)
assert.equal([...collapsed.matchAll(/aria-expanded="false"/g)].length, 4)
assert.equal([...collapsed.matchAll(/<a\b/g)].length, 5)
assert.match(collapsed, /data-slot="sidebar-menu-button"[^>]*href="\/shop"/)

const siteNavigation = renderSidebar("/").match(
  /<nav aria-label="Điều hướng chính">([\s\S]*?)<\/nav>/
)![1]!
for (const [title, href] of sidebarLinks) {
  const attributes = siteNavigation.match(
    new RegExp(`<a\\b([^>]*href="${href}"[^>]*)>`)
  )![1]!
  assert.match(attributes, new RegExp(`aria-label="${title} \\(mở tab mới\\)"`))
  assert.match(attributes, /target="_blank"/)
  assert.match(attributes, /rel="noopener noreferrer"/)
}

for (const markup of [renderSidebar("/"), collapsed]) {
  const community = markup.match(
    /<nav aria-label="Cộng đồng [^"]+">([\s\S]*?)<\/nav>/
  )![1]!
  assert.ok(community.includes("Góp ý/Báo lỗi"))
  const socialLinks = [...community.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
  assert.equal(socialLinks.length, 2)
  for (const [index, [, attributes, content]] of socialLinks.entries()) {
    const [name, href] = [
      ["Facebook", siteConfig.links.facebook],
      ["Discord", siteConfig.links.discord],
    ][index]!
    assert.ok(attributes!.includes(`href="${href}"`))
    assert.ok(attributes!.includes(`aria-label="${name} (mở tab mới)"`))
    assert.match(attributes!, /target="_blank"/)
    assert.match(attributes!, /rel="noopener noreferrer"/)
    assert.match(content!, /<svg[^>]*aria-hidden="true"/)
    assert.ok(content!.includes(`<span>${name}</span>`))
  }
}

console.log("Sidebar navigation checks passed")
