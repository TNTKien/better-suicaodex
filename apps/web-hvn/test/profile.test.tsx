import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock, setSystemTime } from "bun:test"
import * as NextNavigation from "next/navigation"
import { renderToStaticMarkup } from "react-dom/server"
import { AccountApiError, getPublicProfile } from "@workspace/account/api"
import type { components } from "../src/lib/generated/api"

const navigation = { ...NextNavigation }
mock.module("next/navigation", () => ({
  ...navigation,
  useRouter: () => ({ refresh: () => {} }),
}))
mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({ io: async () => {} }))
const { PublicProfileDetails, ProfileView } =
  await import("../modules/account/profile-page")
const { ProfileSkeleton } = await import("../modules/account/profile-skeleton")
const { RecentComments } = await import("../modules/home/recent-comments")
const id = "reader-id"
const profile: components["schemas"]["PublicProfile"] = {
  name: "Tên <script>",
  image: "https://images.test/avatar.webp",
  avatarFrame: null,
  bio: "Giới thiệu <img src=x>\nDòng hai",
  verified: true,
  createdAt: "2026-10-01T23:30:00Z",
  commentCount: 1234,
  groups: [
    { id: "group-1", slug: "nhom-mot", name: "Nhóm một", isLeader: true },
    { id: "group-2", slug: "nhom-hai", name: "Nhóm hai", isLeader: false },
  ],
  recentComments: [
    {
      id: "comment-1",
      body: "Bình luận <script>",
      createdAt: "2026-10-13T23:59:00Z",
      manga: { id: "manga", slug: "truyen", title: "Truyện A" },
      chapter: { id: "chapter", number: "1", title: null },
    },
    {
      id: "comment-2",
      body: "Bình luận truyện",
      createdAt: "2026-10-13T23:58:00Z",
      manga: { id: "manga", slug: "truyen", title: "Truyện A" },
      chapter: null,
    },
  ],
}
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
process.env.API_URL = "https://api.example.test"
const requests: { url: URL; init?: RequestInit }[] = []
let status = 200
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  requests.push({ url, init })
  return Response.json(
    status === 200 ? profile : { error: { message: "Hồ sơ không khả dụng" } },
    { status }
  )
}
const props = { params: Promise.resolve({ id }) }
const is404 = (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
try {
  setSystemTime(new Date("2026-10-14T00:00:00Z"))
  const details = await PublicProfileDetails(props)
  const html = renderToStaticMarkup(details)
  assert.equal(
    requests.length,
    1,
    "Profile and recent comments use a single public profile request"
  )
  assert.equal(
    requests[0]!.url.href,
    "https://api.example.test/v1/profiles/reader-id"
  )
  assert.equal(requests[0]!.init?.credentials, "omit")
  assert.equal(requests[0]!.init?.cache, "no-store")
  assert.equal(
    new Headers(requests[0]!.init?.headers).get("accept"),
    "application/json"
  )
  assert.ok(requests[0]!.init?.signal)
  assert.match(html, /Tường nhà Tên &lt;script&gt;/)
  assert.match(html, /Thông tin cá nhân/)
  assert.match(html, /Đã xác minh/)
  assert.match(html, /huanchuong\.webp/)
  assert.match(html, /ID:<\/dt><dd[^>]*>reader-id/)
  assert.match(html, /href="\/group\/group-1\/nhom-mot"/)
  assert.match(html, /href="\/group\/group-2\/nhom-hai"/)
  assert.equal((html.match(/\(Trưởng nhóm\)/g) ?? []).length, 1)
  assert.match(html, /06:30 - 02\/10\/2026/)
  assert.match(html, /Đã bình luận:<\/dt><dd>1\.234/)
  assert.match(html, /Giới thiệu &lt;img src=x&gt;\nDòng hai/)
  assert.match(html, /Bình luận mới/)
  assert.match(html, /hvn-login-heading hvn-login-heading-info/)
  assert.match(html, /href="\/chapter\/chapter"/)
  assert.match(html, /href="\/manga\/manga\/truyen"/)
  assert.match(html, /href="\/profile\/reader-id"/)
  assert.match(html, /06:59:00 - 14\/10\/2026/)
  assert.match(html, /1 phút trước/)
  assert.match(html, /Bình luận &lt;script&gt;/)
  assert.doesNotMatch(
    html,
    /<script>|<img src=x|Tường Forum|Quyền Upload|Ngày sinh|Giới tính|Được thích|Thành tựu|Yên:|avatar-frame/
  )
  const noData = renderToStaticMarkup(
    <ProfileView
      id={id}
      profile={{
        ...profile,
        verified: false,
        image: null,
        bio: null,
        groups: [],
        commentCount: 0,
        recentComments: [],
      }}
    />
  )
  assert.match(noData, /mac_dinh\.webp/)
  assert.match(noData, /Chưa tham gia nhóm dịch/)
  assert.match(noData, /Chưa có giới thiệu/)
  assert.match(noData, /Chưa có bình luận nào/)
  assert.match(noData, /Đã bình luận:<\/dt><dd>0/)
  assert.doesNotMatch(noData, /Đã xác minh|huanchuong\.webp|Trưởng nhóm/)
  const google = renderToStaticMarkup(
    <ProfileView
      id={id}
      profile={{
        ...profile,
        image: "https://lh3.googleusercontent.com/a/default-initials",
      }}
    />
  )
  assert.match(google, /mac_dinh\.webp/)
  assert.doesNotMatch(google, /default-initials/)
  const loading = renderToStaticMarkup(<ProfileSkeleton />)
  assert.match(loading, /aria-label="Đang tải trang cá nhân"/)
  assert.match(loading, /data-slot="skeleton"/)
  assert.match(loading, /Đang tải bình luận mới/)
  const home = renderToStaticMarkup(
    <RecentComments
      comments={profile.recentComments.map((comment) => ({
        ...comment,
        author: {
          id,
          name: profile.name,
          image: profile.image,
          avatarFrame: null,
        },
      }))}
    />
  )
  assert.match(home, /data-kind="comments"/)
  assert.doesNotMatch(home, /06:59:00 - 14\/10\/2026/)
  for (const code of [400, 404]) {
    status = code
    await assert.rejects(PublicProfileDetails(props), is404)
    assert.equal(await getPublicProfile("https://api.example.test", id), null)
  }
  for (const code of [403, 429, 503]) {
    status = code
    await assert.rejects(
      PublicProfileDetails(props),
      (error: unknown) =>
        error instanceof AccountApiError && error.status === code
    )
  }
  status = 200
  await getPublicProfile("https://api.example.test", "id/with?#")
  assert.equal(requests.at(-1)!.url.pathname, "/v1/profiles/id%2Fwith%3F%23")
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  setSystemTime()
}
console.log(
  "HVN public profile info, recent comments, timezone, privacy/error behavior and skeleton checks passed"
)
