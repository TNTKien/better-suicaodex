import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

import {
  AvatarFrameError,
  frameErrorMessage,
  type AdminAvatarFrame,
} from "../modules/avatar-frames/admin-api"
import {
  canGrantFrame,
  changeUserFrame,
  invalidateUserFrames,
  userFramesOptions,
  type UserFrame,
} from "../modules/avatar-frames/admin-user-api"
import {
  AdminUserAvatarFrames,
  FrameConfirmation,
  GrantableFrameCard,
  OwnedUserFrameCard,
} from "../modules/avatar-frames/admin-user-frames"

const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({ account: null }),
}))
const summary = {
  displayScale: 125,
  offsetX: 0,
  offsetY: 0,
  id: "0199f711-739b-7000-8000-000000000001",
  name: "Khung Avatar Ellen",
  assetUrl: "https://cdn.example.test/animated.webp",
  previewUrl: "https://cdn.example.test/preview.webp",
  animated: true,
  width: 318,
  height: 318,
}
const owned: UserFrame = {
  frame: summary,
  topic: null,
  rarity: "SR",
  limited: false,
  active: true,
  selected: true,
  grantedAt: "2026-10-03T00:00:00Z",
}
const frame: AdminAvatarFrame = {
  displayScale: 125,
  offsetX: 0,
  offsetY: 0,
  id: summary.id,
  code: "zzz-435",
  name: summary.name,
  description: "",
  topicId: null,
  frame: summary,
  rarity: "SR",
  active: true,
  limited: false,
  version: 1,
  shop: { price: "15", stock: 0, version: 1 },
  frameCount: 120,
  byteSize: 1234,
  previewByteSize: 456,
  sha256: "abc",
  sourceSha256: "def",
  createdAt: owned.grantedAt,
  updatedAt: owned.grantedAt,
}
const client = new QueryClient()
const originalFetch = globalThis.fetch
const options = userFramesOptions(apiBaseUrl, "admin", "target/user")
const noop = () => {}

try {
  assert.equal(options.retry, false)
  assert.equal(options.gcTime, 0)
  assert.equal(options.staleTime, 30_000)
  assert.notDeepEqual(
    options.queryKey,
    userFramesOptions(apiBaseUrl, "other-admin", "target/user").queryKey
  )
  assert.notDeepEqual(
    options.queryKey,
    userFramesOptions(apiBaseUrl, "admin", "other-user").queryKey
  )
  assert.notDeepEqual(
    options.queryKey,
    userFramesOptions("https://other.test", "admin", "target/user").queryKey
  )
  const requests: string[] = []
  const second = { ...owned, frame: { ...summary, id: "frame-on-page-two" } }
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    requests.push(String(input))
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.ok(init?.signal instanceof AbortSignal)
    assert.equal(url.searchParams.get("limit"), "100")
    const page = Number(url.searchParams.get("page"))
    return Response.json({
      data: page === 1 ? [owned] : [second],
      meta: { page, limit: 100, total: 101, totalPages: 2 },
      selectedFrameId: summary.id,
      enabled: false,
    })
  }
  const inventory = await client.fetchQuery(options)
  assert.deepEqual(
    inventory.data.map((item) => item.frame.id),
    [summary.id, "frame-on-page-two"]
  )
  assert.equal(inventory.enabled, false)
  assert.equal(inventory.selectedFrameId, summary.id)
  assert.equal(requests.length, 2)
  assert.match(requests[0]!, /target%2Fuser\/avatar-frames\?page=1/)
  assert.match(requests[1]!, /page=2/)

  const incomplete = userFramesOptions(apiBaseUrl, "admin", "incomplete-user")
  globalThis.fetch = async () =>
    Response.json({
      data: [{ ...owned, frame: null }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      selectedFrameId: null,
      enabled: false,
    })
  await assert.rejects(
    client.fetchQuery(incomplete),
    /Missing owned frame summary/
  )
  assert.equal(client.getQueryData(incomplete.queryKey), undefined)

  const brokenPage = userFramesOptions(apiBaseUrl, "admin", "broken-page-user")
  let pagesRead = 0
  globalThis.fetch = async () => {
    pagesRead += 1
    if (pagesRead === 2) throw new Error("Connection interrupted")
    return Response.json({
      data: [owned],
      meta: { page: 1, limit: 100, total: 101, totalPages: 2 },
      selectedFrameId: null,
      enabled: false,
    })
  }
  await assert.rejects(client.fetchQuery(brokenPage), /Connection interrupted/)
  assert.equal(client.getQueryData(brokenPage.queryKey), undefined)
  assert.equal(pagesRead, 2, "No automatic retry or partial inventory")

  const root = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminUserAvatarFrames
        apiBaseUrl={apiBaseUrl}
        actorUserId="admin"
        targetUserId="target/user"
        userName="User thử"
      />
    </QueryClientProvider>
  )
  assert.match(root, /Khung Avatar \(2\)/)
  assert.match(root, /Kho khung/)
  assert.match(root, /aria-expanded="false"/)
  assert.match(root, /Thu gọn hoặc mở rộng Khung Avatar/)
  assert.doesNotMatch(root, /animated.webp|Lý do cấp khung/)
  assert.equal(
    requests.length,
    2,
    "Closed section/warehouse must not fetch on render"
  )
  const noCache = new QueryClient()
  renderToStaticMarkup(
    <QueryClientProvider client={noCache}>
      <AdminUserAvatarFrames
        apiBaseUrl={apiBaseUrl}
        actorUserId="other"
        targetUserId="not-loaded"
        userName="User khác"
      />
    </QueryClientProvider>
  )
  assert.equal(requests.length, 2)
  noCache.clear()

  const ownedMarkup = renderToStaticMarkup(
    <OwnedUserFrameCard
      item={{ ...owned, active: false }}
      disabled={false}
      onRevoke={noop}
    />
  )
  assert.match(ownedMarkup, /Đang chọn/)
  assert.match(ownedMarkup, /Đang tắt/)
  assert.match(ownedMarkup, /Cấp lúc/)
  assert.match(ownedMarkup, /Gỡ khung Khung Avatar Ellen/)
  assert.match(ownedMarkup, /preview.webp/)
  assert.doesNotMatch(ownedMarkup, /animated.webp/)
  const protectedMarkup = renderToStaticMarkup(
    <OwnedUserFrameCard
      item={{ ...owned, limited: true }}
      disabled={false}
      onRevoke={noop}
    />
  )
  assert.match(protectedMarkup, /Không thể gỡ khung limited/)
  assert.doesNotMatch(protectedMarkup, /aria-label="Gỡ khung/)
  assert.equal(canGrantFrame(frame), true)
  for (const invalid of [
    { ...frame, active: false },
    { ...frame, limited: true },
    { ...frame, frame: null },
  ]) {
    assert.equal(canGrantFrame(invalid), false)
    assert.equal(
      renderToStaticMarkup(
        <GrantableFrameCard
          frame={invalid}
          owned={false}
          disabled={false}
          onSelect={noop}
        />
      ),
      ""
    )
  }
  const grantMarkup = (isOwned: boolean, disabled: boolean) =>
    renderToStaticMarkup(
      <GrantableFrameCard
        frame={frame}
        owned={isOwned}
        disabled={disabled}
        onSelect={noop}
      />
    )
  assert.match(grantMarkup(true, false), /Đã sở hữu/)
  assert.match(grantMarkup(true, false), /disabled=""/)
  assert.match(grantMarkup(false, true), /disabled=""/)
  assert.doesNotMatch(grantMarkup(false, false), /disabled=""/)
  for (const name of [
    "Ellen",
    'Hình Đại Diện Động Siêu Cấp Giới Hạn "Con Của Rồng"',
  ]) {
    const markup = renderToStaticMarkup(
      <GrantableFrameCard
        frame={{ ...frame, name, frame: { ...summary, name } }}
        owned={false}
        disabled={false}
        onSelect={noop}
      />
    )
    assert.match(
      markup,
      /data-slot="card-title"[^>]*class="[^"]*line-clamp-2 min-h-\[2lh\]/,
      "Warehouse names reserve two lines like the account inventory"
    )
    assert.match(
      markup,
      /data-slot="card-footer"[^>]*class="[^"]*mt-auto/,
      "Grant actions remain at the bottom of each card"
    )
  }

  const confirmationProps = {
    action: { kind: "revoke" as const, frame: summary },
    formId: "frame-action",
    error: "Lỗi thử",
    pending: false,
    valid: true,
    onSubmit: noop,
  }
  const confirmation = renderToStaticMarkup(
    <FrameConfirmation {...confirmationProps} />
  )
  assert.doesNotMatch(confirmation, /Lý do|<textarea|required=""/)
  assert.match(confirmation, /lựa chọn đó cũng được xóa/)
  assert.match(confirmation, /avatar gốc được giữ nguyên/)
  assert.match(confirmation, /Lỗi thử/)
  assert.match(confirmation, /prefers-reduced-motion: reduce/)
  assert.match(confirmation, /animated.webp/)
  let submissions = 0
  for (const gate of [{ pending: true }, { valid: false }]) {
    FrameConfirmation({
      ...confirmationProps,
      ...gate,
      onSubmit: () => {
        submissions += 1
      },
    }).props.onSubmit({ preventDefault: noop })
  }
  assert.equal(submissions, 0)
  FrameConfirmation({
    ...confirmationProps,
    onSubmit: () => {
      submissions += 1
    },
  }).props.onSubmit({ preventDefault: noop })
  assert.equal(submissions, 1)

  const actions: { url: string; method: string; body: unknown }[] = []
  globalThis.fetch = async (input, init) => {
    actions.push({
      url: String(input),
      method: String(init?.method),
      body: JSON.parse(String(init?.body)),
    })
    return Response.json({ changed: false })
  }
  assert.deepEqual(
    await changeUserFrame(apiBaseUrl, "target/user", "frame/id", "grant"),
    { changed: false }
  )
  await changeUserFrame(apiBaseUrl, "target/user", "frame/id", "revoke")
  assert.deepEqual(actions, [
    {
      url: `${apiBaseUrl}/v1/admin/users/target%2Fuser/avatar-frames/frame%2Fid`,
      method: "PUT",
      body: {},
    },
    {
      url: `${apiBaseUrl}/v1/admin/users/target%2Fuser/avatar-frames/frame%2Fid`,
      method: "DELETE",
      body: {},
    },
  ])
  globalThis.fetch = async () =>
    Response.json(
      { error: { code: "LIMITED_FRAME_PROTECTED", message: "protected" } },
      { status: 403 }
    )
  await assert.rejects(
    changeUserFrame(apiBaseUrl, "user", summary.id, "grant"),
    (error: unknown) =>
      error instanceof AvatarFrameError &&
      error.code === "LIMITED_FRAME_PROTECTED"
  )
  assert.match(
    frameErrorMessage(
      new AvatarFrameError(403, "LIMITED_FRAME_PROTECTED", "protected")
    ),
    /admin không thể cấp hoặc gỡ/
  )

  const abortOptions = userFramesOptions(apiBaseUrl, "admin", "cancel-user")
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(init.signal?.reason),
        { once: true }
      )
    })
  const cancelled = client.fetchQuery(abortOptions).catch(() => null)
  await client.cancelQueries({ queryKey: abortOptions.queryKey })
  await cancelled
  const cachedKeys = [
    options.queryKey,
    ["account", apiBaseUrl, "admin", "admin-audit"],
    ["account", apiBaseUrl, "target/user", "profile"],
    ["comments", apiBaseUrl, "manga", "id"],
    ["account", apiBaseUrl, "admin", "admin-group-members", "group"],
    ["account", "https://other.test", "admin"],
  ]
  for (const key of cachedKeys) client.setQueryData(key, {})
  await invalidateUserFrames(client, apiBaseUrl)
  for (const key of cachedKeys.slice(0, 5))
    assert.equal(client.getQueryState(key)?.isInvalidated, true)
  assert.equal(client.getQueryState(cachedKeys[5]!)?.isInvalidated, false)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log("Admin user avatar frame API and rendering checks passed")
