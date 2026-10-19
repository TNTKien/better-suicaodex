import assert from "node:assert/strict"
import type { ContextType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useNotifications } from "@workspace/account/notifications"
import { notificationTime } from "@workspace/account/notifications-presentation"

import { AccountContext } from "../modules/account/provider"
import {
  NotificationApiError,
  notificationsKey,
  notificationsOptions,
  type Notification,
  type NotificationPage,
} from "../modules/notifications/api"
import {
  NotificationList,
  NotificationPopover,
  notificationPresentation,
} from "../modules/notifications/notification-popover"

const apiBaseUrl = "https://api.example.test"
const chapter: Notification = {
  id: "notification-chapter",
  type: "manga_new_chapter",
  createdAt: "2026-10-13T23:00:00Z",
  readAt: null,
  manga: { id: "manga", slug: "manga-demo", title: "Manga <script>" },
  chapter: { id: "chapter", volume: "1", number: "2", title: "Chapter demo" },
}
const group: Notification = {
  id: "notification-group",
  type: "group_join_requested",
  createdAt: "2026-10-13T23:00:00Z",
  readAt: null,
  group: { id: "group", name: "Nhóm Suicao" },
  actor: { id: "actor", name: "Reader" },
}
const notice: Notification = {
  id: "notification-notice",
  type: "system_notice",
  createdAt: "2026-10-13T23:00:00Z",
  readAt: "2026-10-14T00:00:00Z",
  notice: { id: "notice", title: "Thông báo hệ thống" },
}
const page: NotificationPage = {
  data: [chapter, group, notice],
  meta: { limit: 20, nextCursor: null, unreadCount: 2 },
}
assert.deepEqual(notificationPresentation(chapter), {
  title: "Manga <script>",
  description: "Vol. 1 - Ch. 2 - Chapter demo",
  href: "http://localhost:3000/chapter/chapter",
})
assert.equal(
  notificationPresentation(group).href,
  "http://localhost:3000/manage/group"
)
assert.equal(
  notificationPresentation(notice).href,
  "http://localhost:3000/system-notice?notice=notice"
)
assert.equal(notificationTime(chapter.createdAt), "14/10/2026 06:00")

const options = notificationsOptions(apiBaseUrl, "reader-a")
const key = options.queryKey
const otherKey = notificationsKey(apiBaseUrl, "reader-b")
assert.equal(options.staleTime, 60_000)
assert.equal(options.gcTime, 0)
assert.equal(options.refetchOnWindowFocus, true)
assert.equal(options.refetchOnReconnect, true)
assert.equal(options.refetchIntervalInBackground, false)
assert.equal(notificationsOptions(apiBaseUrl, null).enabled, false)
assert.notDeepEqual(key, otherKey)
const documentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "document"
)
try {
  assert.ok(typeof options.refetchInterval === "function")
  Object.defineProperty(globalThis, "document", {
    value: { visibilityState: "hidden" },
    configurable: true,
  })
  assert.equal(options.refetchInterval(null as never), false)
  Object.defineProperty(globalThis, "document", {
    value: { visibilityState: "visible" },
    configurable: true,
  })
  assert.equal(options.refetchInterval(null as never), 5 * 60_000)
} finally {
  if (documentDescriptor)
    Object.defineProperty(globalThis, "document", documentDescriptor)
  else Reflect.deleteProperty(globalThis, "document")
}

const originalFetch = globalThis.fetch
const requests: string[] = []
const cutoff = "2026-10-14T01:00:00Z"
let failMutations = false
let remainingUnread = 0
const client = new QueryClient()
type State = ReturnType<typeof useNotifications<Notification>>
let state: State
function Capture({ userId }: { userId: string | null }) {
  // eslint-disable-next-line react-hooks/globals -- SSR-only harness captures hooks without mounting a browser.
  state = useNotifications<Notification>(apiBaseUrl, userId)
  return null
}
function capture(userId: string | null = "reader-a") {
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Capture userId={userId} />
    </QueryClientProvider>
  )
  return state!
}
function renderTrigger(status = "authenticated") {
  const account = {
    apiBaseUrl,
    status,
    user: { id: "reader-a" },
  } as unknown as NonNullable<ContextType<typeof AccountContext>>
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountContext value={account}>
        <NotificationPopover />
      </AccountContext>
    </QueryClientProvider>
  )
}
try {
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname + url.search
    requests.push(path)
    assert.equal(url.origin, apiBaseUrl)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.equal(new Headers(init?.headers).has("X-Internal-API-Key"), false)
    if (path === "/v1/me/notifications?limit=20") return Response.json(page)
    assert.equal(init?.method, "POST")
    if (failMutations) return new Response(null, { status: 500 })
    if (path.endsWith("/read-all"))
      return Response.json({
        data: { updated: 2, cutoff },
        meta: { unreadCount: remainingUnread },
      })
    assert.equal(path, "/v1/me/notifications/notification-chapter/read")
    return Response.json({
      data: { id: chapter.id, readAt: cutoff },
      meta: { unreadCount: 1 },
    })
  }) as typeof fetch

  assert.deepEqual(await client.fetchQuery(options), page)
  client.setQueryData(otherKey, page)
  const loaded = capture()
  const list = renderToStaticMarkup(<NotificationList state={loaded} />)
  assert.match(list, /Danh sách thông báo/)
  assert.match(list, /Manga &lt;script&gt;/)
  assert.doesNotMatch(list, /<script>/)
  assert.match(list, /href="http:\/\/localhost:3000\/chapter\/chapter"/)
  assert.match(list, /href="http:\/\/localhost:3000\/manage\/group"/)
  assert.match(list, /target="_blank"/)
  assert.match(list, /14\/10\/2026 06:00/)
  assert.equal((list.match(/data-unread="true"/g) ?? []).length, 2)
  assert.match(renderTrigger(), /aria-label="Thông báo, 2 chưa đọc"/)
  assert.match(renderTrigger(), /globe-icon.webp/)

  client.setQueryData(key, {
    ...page,
    meta: { ...page.meta, unreadCount: 127 },
  })
  assert.match(renderTrigger(), /127 thông báo chưa đọc/)
  assert.match(renderTrigger(), />99\+<\/span>/)
  for (const status of ["guest", "loading", "error"]) {
    const trigger = renderTrigger(status)
    assert.match(trigger, /aria-label="Thông báo"/)
    assert.doesNotMatch(trigger, /127 thông báo chưa đọc/)
  }

  client.setQueryData(key, page)
  await capture().read.mutateAsync(chapter.id)
  const afterRead = client.getQueryData<NotificationPage>(key)!
  assert.equal(afterRead.data[0]?.readAt, cutoff)
  assert.equal(afterRead.meta.unreadCount, 1)
  assert.equal(client.getQueryState(key)?.isInvalidated, true)
  assert.deepEqual(client.getQueryData(otherKey), page)

  client.setQueryData(key, page)
  remainingUnread = 1
  await capture().readAll.mutateAsync()
  assert.equal(
    client.getQueryData<NotificationPage>(key)?.data[0]?.readAt,
    null
  )
  assert.equal(client.getQueryData<NotificationPage>(key)?.meta.unreadCount, 1)
  remainingUnread = 0
  await capture().readAll.mutateAsync()
  const afterReadAll = client.getQueryData<NotificationPage>(key)!
  assert.equal(afterReadAll.data[0]?.readAt, cutoff)
  assert.equal(afterReadAll.data[2]?.readAt, notice.readAt)
  assert.equal(afterReadAll.meta.unreadCount, 0)
  assert.deepEqual(client.getQueryData(otherKey), page)

  failMutations = true
  await assert.rejects(
    capture().readAll.mutateAsync(),
    (error: unknown) =>
      error instanceof NotificationApiError && error.status === 500
  )
  assert.deepEqual(client.getQueryData(key), afterReadAll)

  const query = client.getQueryCache().find({ queryKey: key })!
  query.setState({ status: "error", error: new NotificationApiError(500) })
  assert.match(
    renderToStaticMarkup(<NotificationList state={capture()} />),
    /Không thể tải thông báo[\s\S]*Thử lại/
  )
  client.setQueryData(key, {
    ...page,
    data: [],
    meta: { ...page.meta, unreadCount: 0 },
  })
  assert.match(
    renderToStaticMarkup(<NotificationList state={capture()} />),
    /Chưa có thông báo/
  )
  client.removeQueries({ queryKey: key })
  assert.match(
    renderToStaticMarkup(<NotificationList state={capture()} />),
    /Đang tải thông báo/
  )
  const guest = capture(null)
  assert.equal(guest.open, false)
  const requestCount = requests.length
  guest.onOpenChange(true)
  assert.equal(
    requests.length,
    requestCount,
    "Guests never fetch notifications"
  )
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}

console.log("web-hvn shared notifications and HVN presentation checks passed")
