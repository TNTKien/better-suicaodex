import assert from "node:assert/strict"
// @ts-expect-error Bun provides this module at test runtime; the web tsconfig omits Bun globals.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

import {
  applyNotificationsReadAll,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationApiError,
  notificationsKey,
  notificationsOptions,
  type NotificationPage,
} from "../modules/notifications/api"
import { systemNoticeOptions } from "../modules/system-notices/api"

const apiBaseUrl = "https://api.example.test"
const notificationId = "019916a5-3013-7b3f-a0ef-66237490a7bb"
const chapterId = "019916a5-3013-7b3f-a0ef-66237490a7bc"
const mangaId = "019916a5-3013-7b3f-a0ef-66237490a7bd"
const page: NotificationPage = {
  data: [
    {
      id: notificationId,
      type: "manga_new_chapter",
      createdAt: "2026-09-15T01:00:00.000Z",
      readAt: null,
      manga: { id: mangaId, slug: "manga-demo", title: "Manga demo" },
      chapter: {
        id: chapterId,
        volume: "1",
        number: "2",
        title: "Chapter demo",
      },
    },
  ],
  meta: { limit: 20, nextCursor: null, unreadCount: 2 },
}

const originalFetch = globalThis.fetch
const client = new QueryClient()
try {
  const requests: { method: string; path: string }[] = []
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input)).pathname + new URL(String(input)).search
    requests.push({ method: init?.method ?? "GET", path })
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    if (path === "/v1/system-notices?limit=20")
      return Response.json({
        data: [
          {
            id: notificationId,
            title: "Bảo trì hệ thống",
            content: "Nội dung",
            createdAt: "2026-09-15T01:00:00.000Z",
            updatedAt: "2026-09-15T01:00:00.000Z",
          },
        ],
        meta: { limit: 20, nextCursor: null },
      })
    if (path.endsWith("/read-all"))
      return Response.json({
        data: { updated: 2, cutoff: "2026-09-15T01:01:00.000Z" },
        meta: { unreadCount: 0 },
      })
    if (path.endsWith("/read"))
      return Response.json({
        data: {
          id: notificationId,
          readAt: "2026-09-15T01:01:00.000Z",
        },
        meta: { unreadCount: 1 },
      })
    return Response.json(page)
  }) as typeof fetch

  const options = notificationsOptions(apiBaseUrl, "user-a")
  assert.equal(options.gcTime, 0)
  assert.equal(options.staleTime, 60_000)
  assert.equal(notificationsOptions(apiBaseUrl, null).enabled, false)
  assert.notDeepEqual(
    options.queryKey,
    notificationsOptions(apiBaseUrl, "user-b").queryKey
  )
  assert.deepEqual(await client.fetchQuery(options), page)
  const noticePage = await client.fetchInfiniteQuery(
    systemNoticeOptions(apiBaseUrl)
  )
  assert.equal(noticePage.pages[0]?.data[0]?.title, "Bảo trì hệ thống")
  assert.equal(
    (await markNotificationRead(apiBaseUrl, notificationId)).meta.unreadCount,
    1
  )
  assert.equal((await markAllNotificationsRead(apiBaseUrl)).data.updated, 2)
  const readAllCutoff = "2026-09-15T01:01:00.000Z"
  const stillUnread = applyNotificationsReadAll(page, {
    data: { updated: 1, cutoff: readAllCutoff },
    meta: { unreadCount: 1 },
  })
  assert.equal(stillUnread.data[0]?.readAt, null)
  assert.equal(stillUnread.meta.unreadCount, 1)
  const allRead = applyNotificationsReadAll(page, {
    data: { updated: 2, cutoff: readAllCutoff },
    meta: { unreadCount: 0 },
  })
  assert.equal(allRead.data[0]?.readAt, readAllCutoff)
  assert.equal(allRead.meta.unreadCount, 0)
  assert.deepEqual(requests, [
    { method: "GET", path: "/v1/me/notifications?limit=20" },
    { method: "GET", path: "/v1/system-notices?limit=20" },
    {
      method: "POST",
      path: `/v1/me/notifications/${notificationId}/read`,
    },
    { method: "POST", path: "/v1/me/notifications/read-all" },
  ])

  globalThis.fetch = (async () =>
    new Response(null, { status: 401 })) as typeof fetch
  await assert.rejects(
    markAllNotificationsRead(apiBaseUrl),
    (error: unknown) =>
      error instanceof NotificationApiError && error.status === 401
  )
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}

let accountState = {
  apiBaseUrl,
  status: "authenticated",
  user: { id: "user-a" },
}
mock.module("../modules/account/provider", () => ({
  useAccount: () => accountState,
}))
mock.module("@workspace/ui/components/toast", () => ({
  toast: { add: () => undefined },
}))
mock.module("server-only", () => ({}))

const { NotificationPopover, notificationPresentation } =
  await import("../modules/notifications/notification-popover")
const { SiteHeader } = await import("../components/site-header")
const { ThemeProvider } = await import("../components/theme-provider")
const groupBase = {
  id: notificationId,
  createdAt: "2026-09-15T01:00:00.000Z",
  readAt: null,
  group: { id: mangaId, name: "Nhóm Suica" },
  actor: { id: "user-b", name: "Nguyễn Văn A" },
}
assert.deepEqual(
  notificationPresentation({
    id: notificationId,
    type: "system_notice",
    createdAt: "2026-09-15T01:00:00.000Z",
    readAt: null,
    notice: { id: notificationId, title: "Bảo trì hệ thống" },
  }),
  {
    title: "Bảo trì hệ thống",
    description: "Thông báo hệ thống",
    href: `/system-notice?notice=${notificationId}`,
  }
)
assert.deepEqual(
  notificationPresentation({ ...groupBase, type: "group_join_requested" }),
  {
    title: "Nhóm Suica",
    description: "Nguyễn Văn A muốn gia nhập nhóm",
    href: "/manage/group",
  }
)
assert.deepEqual(
  notificationPresentation({
    ...groupBase,
    type: "group_join_approved",
    actor: null,
  }),
  {
    title: "Nhóm Suica",
    description: "Yêu cầu gia nhập đã được chấp nhận",
    href: "/manage/group",
  }
)
assert.deepEqual(
  notificationPresentation({
    ...groupBase,
    type: "group_join_rejected",
    actor: null,
  }),
  {
    title: "Nhóm Suica",
    description: "Yêu cầu gia nhập đã bị từ chối",
    href: "/manage/group",
  }
)
assert.deepEqual(
  notificationPresentation({
    ...groupBase,
    type: "group_member_removed",
    actor: null,
  }),
  {
    title: "Nhóm Suica",
    description: "Bạn đã bị xóa khỏi nhóm",
    href: "/manage/group",
  }
)
assert.deepEqual(
  notificationPresentation({ ...groupBase, type: "group_member_left" }),
  {
    title: "Nhóm Suica",
    description: "Nguyễn Văn A đã rời nhóm",
    href: "/manage/group",
  }
)
assert.deepEqual(
  notificationPresentation({
    ...groupBase,
    type: "group_approved",
    actor: null,
  }),
  {
    title: "Nhóm Suica",
    description: "Nhóm đã được duyệt",
    href: "/manage/group",
  }
)
assert.deepEqual(
  notificationPresentation({
    ...groupBase,
    type: "group_rejected",
    actor: null,
  }),
  {
    title: "Nhóm Suica",
    description: "Nhóm đã bị từ chối",
    href: "/manage/group",
  }
)
const renderClient = new QueryClient()
assert.deepEqual(
  notificationPresentation({ ...groupBase, type: "group_leader_assigned" }),
  {
    title: "Nhóm Suica",
    description: "Bạn đã trở thành trưởng nhóm",
    href: "/manage/group",
  }
)
renderClient.setQueryData(notificationsKey(apiBaseUrl, "user-a"), page)
const manageHeaderMarkup = renderToStaticMarkup(
  <ThemeProvider>
    <QueryClientProvider client={renderClient}>
      <SiteHeader showDiscovery={false} showSidebarTrigger={false} />
    </QueryClientProvider>
  </ThemeProvider>
)
assert.match(manageHeaderMarkup, /aria-label="Thông báo, 2 chưa đọc"/)
const markup = renderToStaticMarkup(
  <QueryClientProvider client={renderClient}>
    <NotificationPopover />
  </QueryClientProvider>
)
assert.match(markup, /Thông báo, 2 chưa đọc/)
assert.match(markup, /2 thông báo chưa đọc/)

accountState = { ...accountState, status: "guest", user: { id: "user-a" } }
const guestMarkup = renderToStaticMarkup(
  <QueryClientProvider client={renderClient}>
    <NotificationPopover />
  </QueryClientProvider>
)
assert.match(guestMarkup, /aria-label="Thông báo"/)

accountState = { ...accountState, status: "loading", user: { id: "user-a" } }
assert.match(
  renderToStaticMarkup(
    <QueryClientProvider client={renderClient}>
      <NotificationPopover />
    </QueryClientProvider>
  ),
  /aria-label="Thông báo"/
)
renderClient.clear()

console.log("Notification API and header trigger checks passed")
