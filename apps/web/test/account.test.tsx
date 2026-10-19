import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

import {
  AccountApiError,
  accountRequest,
  administratorAccessOptions,
  currentAccountOptions,
  loginHref,
  removeOwnAvatar,
  replaceOwnAvatar,
  safeReturnTo,
  updateOwnProfile,
} from "../modules/account/api"
import {
  ProfileAvatar,
  ProfileSummary,
  PublicProfileSkeleton,
} from "../modules/account/profile"
import { adminGroupsPath } from "../modules/groups/admin"
import { adminMangasPath } from "../modules/moderation/manga-list"
import {
  adminGroupFormSchema,
  groupFormSchema,
} from "../modules/groups/form-schema"

for (const unsafe of [
  undefined,
  null,
  "",
  "https://evil.test/",
  "//evil.test",
  "/\\evil.test",
  "/\tevil.test",
  "/%2f%2fevil.test",
  "/%5cevil.test",
  "/%xx",
  "/login?returnTo=/login",
  "/api/auth/sign-out",
  "/other/../login",
]) {
  assert.equal(safeReturnTo(unsafe), "/", String(unsafe))
}
const destination = "/advanced-search?q=hoa%20%26%20nang#results"
assert.equal(safeReturnTo(destination), destination)
assert.equal(
  new URL(loginHref(destination), "https://web.test").searchParams.get(
    "returnTo"
  ),
  destination
)

const profile = {
  name: "Reader <script>",
  verified: true,
  bio: "<img src=x onerror=alert(1)>",
  image: null,
  avatarFrame: null,
  createdAt: "2026-09-03T23:00:00Z",
  groups: [
    {
      id: "group-demo",
      slug: "group-demo",
      name: "Nhóm dịch demo",
      isLeader: true,
    },
  ],
  commentCount: 8,
  recentComments: Array.from({ length: 5 }, (_, i) => ({
    id: `comment-${i}`,
    body: `Bình luận ${i} <script>`,
    createdAt: "2026-09-04T23:30:00Z",
    manga: { id: "manga-demo", slug: "truyen-demo", title: "Truyện demo" },
    chapter: i ? { id: "chapter-demo", number: "1", title: null } : null,
  })),
}
const markup = renderToStaticMarkup(<ProfileSummary profile={profile} />)
assert.match(markup, /data-slot="avatar"[^>]*size-28 sm:size-36/)
assert.match(markup, /overflow-hidden rounded-full after:rounded-full/)
assert.doesNotMatch(markup, /data-slot="avatar(?:-fallback)?"[^>]*rounded-md/)
const profileSkeleton = renderToStaticMarkup(<PublicProfileSkeleton />)
assert.match(profileSkeleton, /size-28 rounded-full sm:size-36/)
const groupAvatar = renderToStaticMarkup(<ProfileAvatar name="Nhóm dịch" />)
assert.match(groupAvatar, /rounded-md after:rounded-md/)
const nav = readFileSync(
  new URL("../components/nav-user.tsx", import.meta.url),
  "utf8"
)
const navAvatar = nav.match(/<ProfileAvatar\b[^>]*\/>/)?.[0] ?? ""
assert.match(navAvatar, /shape="circle"/)
assert.match(
  navAvatar,
  /avatarFrame=\{account\?\.user\.avatarFrame \?\? null\}/
)
assert.doesNotMatch(
  navAvatar,
  /className|large=/,
  "Nav keeps its existing avatar size"
)
const rail = readFileSync(
  new URL("../app/(site)/home-rail.tsx", import.meta.url),
  "utf8"
)
assert.match(rail, /<Avatar className="mt-0\.5 size-10 overflow-hidden">/)
assert.match(
  rail,
  /<AvatarDecoration frame=\{comment\.author\.avatarFrame \?\? null\}>/
)
assert.doesNotMatch(rail, /rounded-md/)
for (const path of [
  "../modules/groups/workspace.tsx",
  "../modules/groups/admin.tsx",
]) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8")
  assert.match(
    source,
    /<AvatarDecoration frame=\{member\.avatarFrame \?\? null\}>/
  )
  assert.match(
    source,
    /<Avatar className="size-10">\s*<AvatarFallback>\s*\{initials\(member\.name\)\}/
  )
  assert.match(
    source,
    /<Avatar className="[^"\n]*rounded-md after:rounded-md">/,
    "Group avatars stay square"
  )
}
assert.match(markup, /04\/09\/2026/)
assert.match(markup, /&lt;script&gt;/)
assert.doesNotMatch(markup, /<img src=x|<script>|Email|<input|<textarea/)
assert.equal((markup.match(/<article/g) ?? []).length, 5)
assert.match(markup, /Nhóm dịch demo/)
assert.match(markup, /Đã xác minh/)
assert.match(markup, /Leader Nhóm dịch demo/)
assert.match(markup, /href="\/group\/group-demo\/group-demo"/)
assert.match(markup, /href="\/manga\/manga-demo\/truyen-demo"/)
assert.match(markup, /href="\/chapter\/chapter-demo"/)
assert.ok(
  markup.indexOf("&lt;img src=x") < markup.indexOf("Ngày tham gia"),
  "Giới thiệu hiển thị trước phần thông tin"
)
assert.match(
  markup,
  /<header[\s\S]*<h1[\s\S]*Reader &lt;script&gt;[\s\S]*<\/header>[\s\S]*<dl[\s\S]*Ngày tham gia[\s\S]*<\/dl>[\s\S]*<section[\s\S]*Bình luận gần đây/
)
assert.doesNotMatch(
  markup,
  /User ID|Tài khoản liên kết|Trạng thái xác thực|Đăng xuất/
)
const emptyProfile = renderToStaticMarkup(
  <ProfileSummary
    profile={{ ...profile, groups: [], commentCount: 0, recentComments: [] }}
  />
)
assert.match(emptyProfile, /Chưa có bình luận công khai/)
assert.match(emptyProfile, /Chưa tham gia nhóm dịch/)

const apiBaseUrl = "https://api.example.test"
assert.equal(
  adminGroupsPath("approved", 2),
  "/v1/admin/groups?status=approved&page=2&limit=20"
)
assert.equal(
  adminGroupsPath("all", 1, "  Nhóm dịch  "),
  "/v1/admin/groups?q=Nh%C3%B3m+d%E1%BB%8Bch&page=1&limit=20"
)
assert.equal(
  adminMangasPath(2, "  Truyện mới  ", "published", "hidden"),
  "/v1/admin/manga?page=2&limit=20&q=Truy%E1%BB%87n+m%E1%BB%9Bi&publicationState=published&moderation=hidden"
)
assert.equal(
  adminGroupFormSchema.safeParse({
    name: "Nhóm dịch",
    leaderUserId: "user-a",
    description: "",
    facebook: "https://example.com/not-facebook",
    discord: "https://discord.gg/suicaodex",
  }).success,
  false
)
assert.deepEqual(
  groupFormSchema.parse({
    name: "  Nhóm   dịch  ",
    description: "  Giới thiệu  ",
    facebook: "https://facebook.com/suicaodex",
    discord: "suicaodex",
  }),
  {
    name: "Nhóm dịch",
    description: "Giới thiệu",
    facebook: "https://facebook.com/suicaodex",
    discord: "suicaodex",
  }
)
const accountA = { userId: "user-a", sessionId: "session-a" }
const accountB = { userId: "user-b", sessionId: "session-b" }
const optionsA = currentAccountOptions(apiBaseUrl, accountA)
assert.equal(currentAccountOptions(apiBaseUrl, null).enabled, false)
assert.equal(administratorAccessOptions(apiBaseUrl, null).enabled, false)
assert.equal(optionsA.gcTime, 0)
assert.equal(optionsA.staleTime, 5 * 60 * 1_000)
assert.notDeepEqual(
  optionsA.queryKey,
  currentAccountOptions(apiBaseUrl, accountB).queryKey
)
assert.notDeepEqual(
  optionsA.queryKey,
  currentAccountOptions(apiBaseUrl, { ...accountA, sessionId: "new-session" })
    .queryKey
)
const client = new QueryClient()
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), `${apiBaseUrl}/v1/me`)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.ok(init?.signal instanceof AbortSignal)
    return Response.json({ user: { id: "user-a" }, profile })
  }) as typeof fetch
  assert.equal((await client.fetchQuery(optionsA)).user.id, "user-a")
  await assert.rejects(
    client.fetchQuery(currentAccountOptions(apiBaseUrl, accountB)),
    (error: unknown) => error instanceof AccountApiError && error.status === 401
  )

  client.clear()
  const administratorOptions = administratorAccessOptions(apiBaseUrl, "user-a")
  globalThis.fetch = (async (input, init) => {
    assert.equal(
      String(input),
      `${apiBaseUrl}/v1/admin/groups?status=pending&page=1&limit=1`
    )
    assert.equal(init?.credentials, "include")
    return Response.json({ data: [] })
  }) as typeof fetch
  assert.deepEqual(await client.fetchQuery(administratorOptions), { data: [] })

  for (const status of [401, 404, 500]) {
    globalThis.fetch = (async () =>
      new Response(null, { status })) as typeof fetch
    await assert.rejects(
      accountRequest(apiBaseUrl, "/v1/me", "include"),
      (error: unknown) =>
        error instanceof AccountApiError && error.status === status
    )
  }

  const mutationPaths: string[] = []
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input)).pathname
    mutationPaths.push(`${init?.method}:${path}`)
    assert.equal(init?.credentials, "include")
    if (path === "/v1/me/profile") {
      assert.equal(
        init?.body,
        JSON.stringify({ bio: "Giới thiệu đã cập nhật" })
      )
      assert.equal(
        new Headers(init?.headers).get("Content-Type"),
        "application/json"
      )
    }
    if (init?.method === "POST") {
      assert.ok(init.body instanceof FormData)
      assert.equal(new Headers(init.headers).has("Content-Type"), false)
      assert.ok(init.body.get("avatar") instanceof File)
    }
    return Response.json({ user: { id: "user-a", image: null } })
  }) as typeof fetch
  await updateOwnProfile(apiBaseUrl, { bio: "Giới thiệu đã cập nhật" })
  await replaceOwnAvatar(
    apiBaseUrl,
    new File(["avatar"], "avatar.png", { type: "image/png" })
  )
  await removeOwnAvatar(apiBaseUrl)
  assert.deepEqual(mutationPaths, [
    "PATCH:/v1/me/profile",
    "POST:/v1/me/avatar",
    "DELETE:/v1/me/avatar",
  ])

  let started!: (signal: AbortSignal) => void
  const pending = new Promise<AbortSignal>((resolve) => {
    started = resolve
  })
  globalThis.fetch = (async (_input, init) => {
    const signal = init!.signal!
    started(signal)
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      })
    })
  }) as typeof fetch
  client.removeQueries({ queryKey: optionsA.queryKey })
  const observer = new QueryObserver(client, optionsA)
  const unsubscribe = observer.subscribe(() => {})
  const signal = await pending
  observer.setOptions(currentAccountOptions(apiBaseUrl, null))
  assert.equal(signal.aborted, true, "Logout cancels the old account request")
  assert.equal(
    observer.getCurrentResult().data,
    undefined,
    "Logout never renders cached private data"
  )
  observer.setOptions(currentAccountOptions(apiBaseUrl, accountB))
  assert.equal(
    observer.getCurrentResult().data,
    undefined,
    "New user never sees the previous account"
  )
  unsubscribe()
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log("Identity/profile checks passed")
