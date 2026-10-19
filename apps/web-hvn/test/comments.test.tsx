import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { commentKey } from "@workspace/account/comments-api"

const apiBaseUrl = "https://api.example.test"
let status = "guest"
let userId = "owner"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    status,
    user: status === "authenticated" ? { id: userId } : null,
    retry: () => {},
  }),
}))
mock.module("next/navigation", () => ({
  usePathname: () => "/manga/manga/slug",
}))
const { CommentSection } = await import("../modules/comments/comment-section")
const author = {
  id: "owner",
  name: "Người đăng <script>",
  image: null,
  avatarFrame: null,
}
const root = {
  id: "root",
  author,
  body: "**Nội dung công khai** :ba-koharu:",
  chapter: { id: "chapter", number: "2", title: "Tên chương" },
  createdAt: "2026-09-01T18:04:05Z",
  updatedAt: "2026-09-01T18:04:05Z",
  editedAt: null,
  parentId: null,
  version: 7,
  deleted: false,
  hidden: false,
  replies: [
    {
      id: "reply-a",
      author: {
        ...author,
        id: "other",
        name: "Người trả lời",
        image: "https://images.example.test/avatar.webp",
      },
      body: "Reply thứ nhất",
      chapter: null,
      createdAt: "2026-09-01T18:05:05Z",
      updatedAt: "2026-09-01T18:05:05Z",
      editedAt: null,
      parentId: "root",
      version: 1,
      deleted: false,
      hidden: false,
    },
    {
      id: "reply-b",
      author: {
        ...author,
        id: "another",
        name: "Người khác",
        image: "https://lh3.googleusercontent.com/a/default-photo",
      },
      body: "Reply thứ hai",
      chapter: null,
      createdAt: "2026-09-01T18:06:05Z",
      updatedAt: "2026-09-01T18:06:05Z",
      editedAt: null,
      parentId: "root",
      version: 1,
      deleted: false,
      hidden: false,
    },
  ],
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
const key = commentKey(apiBaseUrl, "manga", "manga")
function render(
  comments: unknown[] = [root],
  nextCursor: string | null = "next"
) {
  client.setQueryData(key, {
    pages: [
      {
        data: comments,
        meta: { limit: 10, total: comments.length, nextCursor },
      },
    ],
    pageParams: [null],
  })
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <CommentSection scope="manga" targetId="manga" />
    </QueryClientProvider>
  )
}
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = (() => {
    throw new Error("SSR must use the supplied comment cache")
  }) as typeof fetch
  const guest = render()
  assert.match(guest, /Nội dung công khai/)
  assert.match(guest, /Người đăng &lt;script&gt;/)
  assert.match(guest, /Reply thứ nhất/)
  assert.match(guest, /Reply thứ hai/)
  assert.match(guest, /01:04:05 - 02\/09\/2026/)
  assert.match(guest, /href="\/chapter\/chapter"/)
  assert.match(guest, /mac_dinh.webp/)
  assert.match(guest, /https:\/\/images.example.test\/avatar.webp/)
  assert.doesNotMatch(
    guest,
    /googleusercontent|avatar-frame|data-slot="badge"|@Người|<script|<textarea|>Trả lời<|>Sửa<|>Xóa</
  )
  assert.match(guest, /đăng nhập/)
  assert.match(guest, /returnTo=/)
  assert.match(guest, /Xem thêm/)
  assert.match(
    guest,
    /http:\/\/localhost:3000\/images\/stickers\/bluearchive\/ba-koharu.webp/
  )
  assert.equal((guest.match(/<article\b/g) ?? []).length, 3)
  const nestedReply = {
    ...root.replies[0]!,
    replies: [{ ...root.replies[1]!, body: "Không render cấp thứ hai" }],
  }
  assert.doesNotMatch(
    render([{ ...root, replies: [nestedReply] }]),
    /Không render cấp thứ hai/
  )

  status = "authenticated"
  const own = render()
  assert.match(own, /<textarea/)
  assert.equal(
    (own.match(/>Trả lời<\/button>/g) ?? []).length,
    1,
    "Only the root permits a reply"
  )
  assert.equal((own.match(/>Sửa<\/button>/g) ?? []).length, 1)
  assert.equal((own.match(/>Xóa<\/button>/g) ?? []).length, 1)
  userId = "not-owner"
  assert.doesNotMatch(render(), />Sửa<|>Xóa</)
  status = "error"
  assert.match(render(), /Nội dung công khai/)
  assert.match(render(), /Không thể kiểm tra phiên đăng nhập/)
  status = "loading"
  assert.match(render(), /Nội dung công khai/)
  status = "guest"
  const tombstone = render([{ ...root, body: null, deleted: true }], null)
  assert.match(tombstone, /Bình luận đã bị xóa/)
  assert.match(tombstone, /Reply thứ nhất/)
  assert.doesNotMatch(tombstone, /Nội dung công khai|Xem thêm/)
  assert.match(
    render([{ ...root, body: null, hidden: true }]),
    /Bình luận đã bị ẩn/
  )
  const unsafe = render([
    {
      ...root,
      replies: [],
      body: "<script>alert(1)</script> ![ảnh](https://unsafe.test/image.webp) [link](javascript:alert(1))",
    },
  ])
  assert.doesNotMatch(
    unsafe,
    /<script|src="https:\/\/unsafe.test|href="javascript:/
  )
  assert.match(render([], null), /Chưa có ai bình luận/)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log(
  "HVN public comments, one-level replies, ownership controls, avatars, stickers and safe Markdown passed"
)
