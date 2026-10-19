import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"
import type { ReactNode } from "react"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { commentKey as commentFeedKey } from "../modules/comments/api"

import {
  currentAccountOptions,
  type CurrentAccount,
} from "../modules/account/api"
import {
  ProfileAvatar,
  ProfileHeader,
  ProfileSummary,
} from "../modules/account/profile"
import { AvatarFrameError } from "../modules/avatar-frames/admin-api"
import {
  canEquipOwnFrame,
  canUnequipOwnFrame,
  ownFrameErrorMessage,
  ownFramesOptions,
  refreshOwnFrames,
  setOwnFrame,
  type OwnFrame,
} from "../modules/avatar-frames/account-api"
import { AvatarDecoration } from "../modules/avatar-frames/avatar-decoration"

const apiBaseUrl = "https://api.example.test"
let status = "authenticated"
let identity: { userId: string; sessionId: string } | null = {
  userId: "reader",
  sessionId: "session",
}
const summary = {
  displayScale: 125,
  offsetX: 0,
  offsetY: 0,
  id: "0199f711-739b-7000-8000-000000000001",
  name: "Khung Avatar Ellen",
  assetUrl: "https://cdn.example.test/animated.webp",
  previewUrl: "https://cdn.example.test/preview.webp",
  animated: true,
  width: 294,
  height: 289,
}
const account: CurrentAccount = {
  coinBalance: "0",
  user: {
    id: "reader",
    role: "user",
    name: "Độc giả",
    email: "private@example.test",
    emailVerified: true,
    image: "https://cdn.example.test/avatar.webp",
    avatarFrame: summary,
    createdAt: "2026-10-03T00:00:00Z",
    updatedAt: "2026-10-03T00:00:00Z",
  },
  profile: {
    bio: null,
    isPublic: true,
    status: "active",
    createdAt: "2026-10-03T00:00:00Z",
    updatedAt: "2026-10-03T00:00:00Z",
  },
  linkedProviders: [],
}
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    status,
    identity,
    account,
    apiBaseUrl,
    user: {
      id: account.user.id,
      name: account.user.name,
      image: account.user.image,
    },
    retry: async () => {},
    signOut: { isPending: false, isError: false, mutate: () => {} },
  }),
}))
const { NavUser } = await import("../components/nav-user")
const { CommentSection } = await import("../modules/comments/comment-section")
const { HomeRail } = await import("../app/(site)/home-rail")
const {
  OwnAvatarFrames,
  OwnFrameCard,
  OwnFrameGrid,
  filterOwnFrames,
  ownFrameParams,
} = await import("../modules/avatar-frames/account-inventory")
const item: OwnFrame = {
  frame: summary,
  topic: null,
  rarity: "SR",
  limited: false,
  active: true,
  selected: false,
  grantedAt: "2026-10-03T00:00:00Z",
}
const selected = { ...item, selected: true }
const options = ownFramesOptions(apiBaseUrl, identity!)
const client = new QueryClient()
const originalFetch = globalThis.fetch
const noop = () => {}

try {
  assert.equal(options.retry, false)
  assert.equal(options.gcTime, 0)
  assert.equal(options.staleTime, 30_000)
  assert.equal(options.networkMode, "always")
  for (const other of [
    ownFramesOptions("https://other.test", identity!),
    ownFramesOptions(apiBaseUrl, { ...identity!, userId: "other" }),
    ownFramesOptions(apiBaseUrl, { ...identity!, sessionId: "new-session" }),
  ])
    assert.notDeepEqual(options.queryKey, other.queryKey)

  const calls: string[] = []
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    calls.push(String(input))
    assert.equal(url.pathname, "/v1/me/avatar-frames")
    assert.equal(url.searchParams.get("limit"), "100")
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.ok(init?.signal instanceof AbortSignal)
    const page = Number(url.searchParams.get("page"))
    return Response.json({
      data:
        page === 1
          ? [item]
          : [{ ...selected, frame: { ...summary, id: "second" } }],
      meta: { page, limit: 100, total: 101, totalPages: 2 },
      selectedFrameId: "second",
      enabled: false,
    })
  }
  const inventory = await client.fetchQuery(options)
  assert.deepEqual(
    inventory.data.map((value) => value.frame.id),
    [summary.id, "second"]
  )
  assert.equal(inventory.selectedFrameId, "second")
  assert.equal(
    inventory.enabled,
    false,
    "Inventory remains available with feature flag off"
  )
  assert.equal(calls.length, 2)

  const root = () =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <OwnAvatarFrames />
      </QueryClientProvider>
    )
  const closed = root()
  assert.match(closed, /Khung Avatar/)
  assert.match(closed, /aria-haspopup="dialog"/)
  assert.match(closed, /data-slot="dialog-trigger"/)
  assert.doesNotMatch(closed, /collapsible|Đang dùng:|Tải lại|Gỡ khung/)
  assert.doesNotMatch(closed, /animated.webp|preview.webp|Xem thử khung/)
  assert.equal(calls.length, 2, "Closed warehouse does not fetch")
  for (const state of ["guest", "loading", "error"]) {
    status = state
    assert.equal(root(), "")
  }
  status = "authenticated"
  identity = { userId: "other", sessionId: "other-session" }
  assert.equal(root(), "", "Mismatched account never renders the warehouse")
  identity = null
  assert.equal(root(), "")
  identity = { userId: "reader", sessionId: "session" }

  for (const bad of ["null-summary", "broken-page"]) {
    let pages = 0
    const failed = ownFramesOptions(apiBaseUrl, { ...identity, sessionId: bad })
    globalThis.fetch = async () => {
      pages += 1
      if (bad === "broken-page" && pages === 2)
        throw new Error("Connection interrupted")
      return Response.json({
        data: [{ ...item, frame: bad === "null-summary" ? null : summary }],
        meta: { page: pages, limit: 100, total: 101, totalPages: 2 },
        selectedFrameId: null,
        enabled: true,
      })
    }
    await assert.rejects(
      client.fetchQuery(failed),
      bad === "null-summary"
        ? /Missing owned frame summary/
        : /Connection interrupted/
    )
    assert.equal(
      client.getQueryData(failed.queryKey),
      undefined,
      "No partial private inventory"
    )
    assert.equal(pages, bad === "null-summary" ? 1 : 2, "No automatic retry")
  }

  const writes: string[] = []
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${apiBaseUrl}/v1/me/avatar-frame`)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    writes.push(init?.method ?? "GET")
    if (init?.method === "PUT") {
      assert.deepEqual(JSON.parse(String(init.body)), { frameId: summary.id })
      assert.equal(
        new Headers(init.headers).get("Content-Type"),
        "application/json"
      )
    } else {
      assert.equal(
        init?.body,
        undefined,
        "Unequip sends no user/image/ownership payload"
      )
    }
    return Response.json({
      ...account,
      user: {
        ...account.user,
        avatarFrame: init?.method === "PUT" ? summary : null,
      },
    })
  }
  const equipped = await setOwnFrame(apiBaseUrl, identity, summary.id)
  const removed = await setOwnFrame(apiBaseUrl, identity, null)
  assert.deepEqual(writes, ["PUT", "DELETE"])
  assert.equal(equipped.user.avatarFrame?.id, summary.id)
  assert.equal(removed.user.avatarFrame, null)
  assert.equal(removed.user.image, account.user.image)
  await assert.rejects(
    setOwnFrame(apiBaseUrl, { ...identity, userId: "switched" }, summary.id),
    (error: unknown) =>
      error instanceof AvatarFrameError && error.status === 401
  )

  assert.equal(canEquipOwnFrame(item, true, true), true)
  assert.equal(
    canEquipOwnFrame({ ...item, limited: true }, true, true),
    true,
    "Owners may equip their limited frame"
  )
  assert.equal(canEquipOwnFrame({ ...item, active: false }, true, true), false)
  assert.equal(canEquipOwnFrame(selected, true, true), false)
  assert.equal(canEquipOwnFrame(item, false, true), false)
  assert.equal(canEquipOwnFrame(item, true, false), false)
  assert.equal(
    canUnequipOwnFrame(
      { ...selected, active: false, limited: true },
      summary.id
    ),
    true,
    "Unequip ignores feature/active/limited restrictions"
  )
  assert.equal(canUnequipOwnFrame(item, summary.id), false)
  assert.equal(
    canUnequipOwnFrame(selected, "newly-selected"),
    false,
    "Stale confirmation cannot remove a different frame"
  )
  assert.equal(canUnequipOwnFrame(selected, null), false)

  const meKey = currentAccountOptions(apiBaseUrl, identity).queryKey
  const commentKey = ["comments", apiBaseUrl, "manga", "id"]
  const otherKey = currentAccountOptions(apiBaseUrl, {
    userId: "other",
    sessionId: "session",
  }).queryKey
  const otherApi = ["comments", "https://other.test", "manga", "id"]
  const memberKey = [
    "account",
    apiBaseUrl,
    identity.userId,
    "groups",
    "group",
    "members",
  ]
  client.setQueryData(meKey, account)
  for (const key of [commentKey, otherKey, otherApi, memberKey])
    client.setQueryData(key, {})
  await refreshOwnFrames(client, apiBaseUrl, identity, removed)
  assert.equal(
    client.getQueryData<CurrentAccount>(meKey)?.user.avatarFrame,
    null
  )
  assert.equal(client.getQueryState(options.queryKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(meKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(commentKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(memberKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(otherKey)?.isInvalidated, false)
  assert.equal(client.getQueryState(otherApi)?.isInvalidated, false)
  client.removeQueries({ queryKey: ["account", apiBaseUrl, identity.userId] })
  await refreshOwnFrames(client, apiBaseUrl, identity, equipped)
  assert.equal(
    client.getQueryData(meKey),
    undefined,
    "Late mutation does not recreate private cache after logout"
  )

  let started!: (signal: AbortSignal) => void
  const pendingSignal = new Promise<AbortSignal>((resolve) => {
    started = resolve
  })
  globalThis.fetch = async (_input, init) => {
    started(init!.signal!)
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(init.signal?.reason),
        { once: true }
      )
    })
  }
  const observer = new QueryObserver(client, options)
  const unsubscribe = observer.subscribe(noop)
  const signal = await pendingSignal
  observer.setOptions(
    ownFramesOptions(apiBaseUrl, { ...identity, userId: "other" })
  )
  assert.equal(signal.aborted, true)
  assert.equal(
    observer.getCurrentResult().data,
    undefined,
    "Account switch never exposes the previous inventory"
  )
  unsubscribe()

  const children = <span>Avatar gốc</span>
  assert.equal(
    renderToStaticMarkup(
      <AvatarDecoration frame={null}>{children}</AvatarDecoration>
    ),
    renderToStaticMarkup(children)
  )
  const animated = renderToStaticMarkup(
    <AvatarDecoration frame={summary}>{children}</AvatarDecoration>
  )
  assert.match(animated, /width:125%;height:125%;left:50%;top:50%/)
  const adjusted = renderToStaticMarkup(
    <AvatarDecoration
      frame={{ ...summary, displayScale: 140, offsetX: -4, offsetY: 7 }}
    >
      {children}
    </AvatarDecoration>
  )
  assert.match(adjusted, /width:140%;height:140%;left:46%;top:57%/)
  assert.match(
    animated,
    /inline-flex h-fit w-fit/,
    "Overlay tracks avatar dimensions instead of stretching to a comment row"
  )
  assert.match(animated, /pointer-events-none/)
  assert.match(animated, /aria-hidden="true"/)
  assert.match(animated, /prefers-reduced-motion: reduce/)
  assert.match(
    animated,
    /<img[^>]*src="https:\/\/cdn.example.test\/animated.webp"[^>]*alt=""[^>]*width="294"[^>]*height="289"/
  )
  const still = renderToStaticMarkup(
    <AvatarDecoration frame={summary} animate={false}>
      {children}
    </AvatarDecoration>
  )
  assert.match(still, /preview.webp/)
  assert.doesNotMatch(still, /animated.webp|<source/)
  for (const frame of [animated, still]) {
    assert.match(frame, /loading="lazy"/)
    assert.match(frame, /decoding="async"/)
  }
  const undecorated = renderToStaticMarkup(
    <ProfileAvatar name="Nhóm" image={null} />
  )
  assert.doesNotMatch(undecorated, /<picture|inline-flex/)
  assert.match(
    undecorated,
    /rounded-md after:rounded-md/,
    "Group/default avatar keeps its original shape"
  )
  const circleElement = ProfileAvatar({
    name: "User",
    image: account.user.image,
    avatarFrame: summary,
    shape: "circle",
  })
  const avatarElement = circleElement.props.children
  assert.match(
    avatarElement.props.className,
    /overflow-hidden rounded-full after:rounded-full/
  )
  assert.equal(
    avatarElement.props.children[0].props.className,
    "rounded-full",
    "Avatar image corners are clipped inside the circle"
  )
  assert.equal(
    avatarElement.props.children[1].props.className,
    "rounded-full",
    "Fallback also uses the circle"
  )
  const circleMarkup = renderToStaticMarkup(circleElement)
  assert.match(
    circleMarkup,
    /<picture[^>]*style="width:125%;height:125%;left:50%;top:50%"/,
    "Frame remains outside the clipped avatar"
  )
  assert.doesNotMatch(circleMarkup, /rounded-md/)
  const bareAccount = renderToStaticMarkup(
    <ProfileHeader
      profile={{ name: "User", image: null }}
      avatarShape="circle"
    />
  )
  assert.match(
    bareAccount,
    /overflow-hidden rounded-full after:rounded-full/,
    "Account avatar stays circular after unequip"
  )
  const publicMarkup = renderToStaticMarkup(
    <ProfileSummary
      profile={{
        name: "Public",
        image: null,
        avatarFrame: summary,
        verified: false,
        bio: null,
        createdAt: item.grantedAt,
        groups: [],
        recentComments: [],
        commentCount: 0,
      }}
    />
  )
  assert.match(
    publicMarkup,
    /animated.webp/,
    "Public profile renders its effective equipped frame"
  )
  const renderConsumer = (node: ReactNode) =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <TooltipProvider>{node}</TooltipProvider>
      </QueryClientProvider>
    )
  const renderNav = () =>
    renderConsumer(
      <SidebarProvider>
        <NavUser />
      </SidebarProvider>
    )
  const navMarkup = renderNav()
  assert.match(
    navMarkup,
    /animated.webp/,
    "Nav reads the frame from /v1/me, not session.user"
  )
  assert.match(
    navMarkup,
    /overflow-visible/,
    "Collapsed nav must not clip the frame"
  )
  const feedComment = {
    id: "comment-1",
    parentId: null,
    body: "Bình luận",
    deleted: false,
    hidden: false,
    version: 1,
    author: {
      id: "author",
      name: "Tác giả",
      image: null,
      avatarFrame: summary,
    },
    chapter: null,
    createdAt: item.grantedAt,
    updatedAt: item.grantedAt,
    editedAt: null,
    replies: [
      {
        id: "reply-1",
        parentId: "comment-1",
        body: "Trả lời",
        deleted: false,
        hidden: false,
        version: 1,
        author: {
          id: "reply-author",
          name: "Người trả lời",
          image: null,
          avatarFrame: summary,
        },
        chapter: null,
        createdAt: item.grantedAt,
        updatedAt: item.grantedAt,
        editedAt: null,
      },
    ],
  }
  for (const scope of ["manga", "chapter"] as const) {
    client.setQueryData(commentFeedKey(apiBaseUrl, scope, "test"), {
      pages: [
        {
          data: [feedComment],
          meta: { total: 2, limit: 10, nextCursor: null },
        },
      ],
      pageParams: [null],
    })
    const commentsMarkup = renderConsumer(
      <CommentSection
        scope={scope}
        targetId="test"
        drawer={scope === "chapter"}
      />
    )
    assert.equal(
      (commentsMarkup.match(/<picture/g) ?? []).length,
      3,
      `${scope}: author, reply and composer all render their frame`
    )
    assert.match(commentsMarkup, /prefers-reduced-motion: reduce/)
    assert.match(commentsMarkup, /size-10 overflow-hidden sm:size-12/)
  }
  const rankingMeta = {
    limit: 10,
    window: "week" as const,
    bucketDate: "2026-10-03",
    calculatedAt: item.grantedAt,
  }
  const homeMarkup = renderConsumer(
    <HomeRail
      apiBaseUrl={apiBaseUrl}
      comments={[
        {
          id: "recent-1",
          body: "Bình luận mới",
          author: feedComment.author,
          manga: { id: "manga-1", slug: "truyen", title: "Truyện" },
          chapter: null,
          createdAt: item.grantedAt,
        },
      ]}
      initialGroupRanking={{ data: [], meta: rankingMeta }}
      initialMangaRanking={{
        data: [],
        meta: {
          ...rankingMeta,
          metric: "views",
          insufficientData: true,
          activeSignals: { comments: true, follows: true, views: true },
        },
      }}
    />
  )
  assert.match(
    homeMarkup,
    /animated.webp/,
    "Home recent comments use the author frame"
  )
  assert.match(
    homeMarkup,
    /inline-flex h-fit w-fit/,
    "Home decoration does not stretch with long comment text"
  )
  account.user.avatarFrame = null
  assert.doesNotMatch(
    renderNav(),
    /animated.webp|preview.webp/,
    "Unequip removes the nav decoration"
  )
  account.user.avatarFrame = summary

  const card = renderToStaticMarkup(
    <OwnFrameCard
      item={{ ...selected, active: false, limited: true }}
      account={account}
      disabled
      enabled={false}
      selectedFrameId={summary.id}
      onChoose={noop}
    />
  )
  assert.doesNotMatch(card, /Đang chọn/)
  assert.match(card, /Đang tắt/)
  assert.match(card, /Limited/)
  assert.match(card, /Ảnh động/)
  assert.match(card, /Gỡ khung Khung Avatar Ellen/)
  assert.match(card, /disabled=""/)
  assert.match(card, /preview.webp/)
  assert.match(card, /overflow-hidden rounded-full after:rounded-full/)
  assert.match(card, /animated.webp/)
  assert.match(card, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(card, /Xem thử/)

  const renderCard = (
    value: OwnFrame,
    enabled = true,
    selectedFrameId: string | null = null,
    currentAccount = account
  ) =>
    renderToStaticMarkup(
      <OwnFrameCard
        item={value}
        account={currentAccount}
        disabled={false}
        enabled={enabled}
        selectedFrameId={selectedFrameId}
        onChoose={noop}
      />
    )
  for (const name of [
    "Ellen",
    'Hình Đại Diện Động Siêu Cấp Giới Hạn "Con Của Rồng"',
  ]) {
    const markup = renderCard({ ...item, frame: { ...summary, name } })
    assert.match(
      markup,
      /data-slot="card-title"[^>]*class="[^"]*line-clamp-2 min-h-\[2lh\]/,
      "Short and long names reserve two lines without changing the clamp"
    )
    assert.match(
      markup,
      /data-slot="card-footer"[^>]*class="[^"]*mt-auto/,
      "Actions stay at the bottom when card content heights differ"
    )
  }
  assert.match(renderCard(item), /aria-label="Dùng khung Khung Avatar Ellen"/)
  assert.doesNotMatch(renderCard(item), /disabled=""/)
  assert.match(renderCard(item, false), /disabled=""/)
  assert.match(renderCard({ ...item, active: false }), /disabled=""/)
  const restricted = {
    ...account,
    profile: { ...account.profile, status: "suspended" as const },
  }
  assert.match(renderCard(item, true, null, restricted), /disabled=""/)
  assert.doesNotMatch(
    renderCard({ ...selected, active: false }, false, summary.id, restricted),
    /disabled=""/,
    "Selected frame can be removed even when restricted or feature/frame disabled"
  )
  assert.match(renderCard(selected, true, "other-frame"), /disabled=""/)
  const actions: OwnFrame[] = []
  for (const value of [item, selected]) {
    const element = OwnFrameCard({
      item: value,
      account,
      enabled: true,
      selectedFrameId: value.selected ? value.frame.id : null,
      disabled: false,
      onChoose: (chosen) => actions.push(chosen),
    })
    const button = element.props.children[2].props.children
    button.props.onClick()
  }
  assert.deepEqual(
    actions,
    [item, selected],
    "Use/remove acts directly on the card"
  )
  const blocked = OwnFrameCard({
    item,
    account,
    enabled: true,
    selectedFrameId: null,
    disabled: true,
    pending: true,
    onChoose: (chosen) => actions.push(chosen),
  })
  blocked.props.children[2].props.children.props.onClick()
  assert.equal(actions.length, 2, "Pending action prevents additional writes")
  assert.match(
    renderToStaticMarkup(blocked),
    /data-slot="spinner"/,
    "Pending card displays progress without a second dialog"
  )
  const renderGrid = (items: OwnFrame[], searchParams = "") =>
    renderToStaticMarkup(
      <NuqsTestingAdapter searchParams={searchParams}>
        <OwnFrameGrid
          inventory={{ data: items, enabled: true, selectedFrameId: null }}
          account={account}
          disabled={false}
          onChoose={noop}
        />
      </NuqsTestingAdapter>
    )
  assert.match(renderGrid([]), /Kho khung đang trống/)
  assert.match(
    renderGrid([item], "?frameQ=not-found"),
    /Không có khung phù hợp/
  )
  assert.equal(filterOwnFrames([item], " ellen ", "SR").length, 1)
  assert.equal(filterOwnFrames([item], "ellen", "SSR").length, 0)
  const zzz = { id: "zzz-topic", name: "Zenless Zone Zero" }
  const hsr = { id: "hsr-topic", name: "Honkai: Star Rail" }
  const byTopic: OwnFrame[] = [
    { ...item, frame: { ...summary, id: "zzz-frame" }, topic: zzz },
    {
      ...item,
      frame: { ...summary, id: "hsr-frame", name: "March 7th" },
      rarity: "R",
      topic: hsr,
    },
    item,
  ]
  assert.deepEqual(
    filterOwnFrames(byTopic, "", "all", zzz.id).map((value) => value.frame.id),
    ["zzz-frame"]
  )
  assert.equal(filterOwnFrames(byTopic, "ellen", "SR", zzz.id).length, 1)
  assert.equal(filterOwnFrames(byTopic, "march", "SR", hsr.id).length, 0)
  assert.deepEqual(filterOwnFrames(byTopic, "", "all", "none"), [item])
  assert.equal(filterOwnFrames(byTopic, "", "all", "all").length, 3)
  assert.equal(filterOwnFrames(byTopic, "", "all", "deleted-topic").length, 0)
  assert.match(renderGrid(byTopic), /Lọc chủ đề khung sở hữu/)
  const filteredGrid = renderGrid(byTopic, "?frameTopic=hsr-topic&framePage=2")
  assert.match(filteredGrid, /Honkai: Star Rail/)
  assert.match(filteredGrid, /aria-label="Dùng khung March 7th"/)
  assert.doesNotMatch(
    filteredGrid,
    /aria-label="Dùng khung Khung Avatar Ellen"/
  )
  assert.match(
    renderGrid(byTopic, "?frameTopic=deleted-topic"),
    /Chủ đề không khả dụng/
  )
  const many = Array.from({ length: 21 }, (_, n) => ({
    ...item,
    frame: { ...summary, id: String(n), name: `Khung ${n}` },
  }))
  const grid = renderGrid(many)
  assert.equal((grid.match(/aria-label="Dùng khung/g) ?? []).length, 20)
  assert.match(grid, /Trang kho khung của bạn/)
  const pageTwo = renderGrid(many, "?framePage=2")
  assert.equal((pageTwo.match(/aria-label="Dùng khung/g) ?? []).length, 1)
  assert.match(pageTwo, /Khung 20/)
  assert.equal(ownFrameParams.framePage.parse("2"), 2)
  assert.equal(ownFrameParams.frameRarity.parse("SSR"), "SSR")
  assert.equal(ownFrameParams.frameRarity.parse("other"), null)
  assert.equal(ownFrameParams.frameTopic.parse(zzz.id), zzz.id)
  assert.equal(ownFrameParams.frameTopic.parse("none"), "none")

  for (const [code, text] of [
    ["AVATAR_FRAMES_DISABLED", /vẫn có thể gỡ/],
    ["FRAME_UNAVAILABLE", /quyền sở hữu/],
    ["ACCOUNT_RESTRICTED", /hạn chế/],
  ] as const)
    assert.match(
      ownFrameErrorMessage(new AvatarFrameError(403, code, "upstream")),
      text
    )
  assert.match(
    ownFrameErrorMessage(new AvatarFrameError(401, "UNAUTHORIZED", "upstream")),
    /đăng nhập lại/
  )
  assert.match(
    ownFrameErrorMessage(new TypeError("Connection lost")),
    /có thể đã được lưu/
  )
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}
console.log(
  "Account avatar frame inventory, equip/cache and renderer checks passed"
)
