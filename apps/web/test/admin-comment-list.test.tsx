import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"
import type { AvatarDecorationFrame } from "../modules/avatar-frames/avatar-decoration"

const apiBaseUrl = "https://api.example.test"
const frame: NonNullable<AvatarDecorationFrame> = {
  displayScale: 125,
  offsetX: 0,
  offsetY: 0,
  id: "0199f711-739b-7000-8000-000000000001",
  name: "Khung",
  assetUrl: "https://cdn.example.test/frame.webp",
  previewUrl: "https://cdn.example.test/frame-preview.webp",
  animated: true,
  width: 318,
  height: 318,
}
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const {
  AdminCommentList,
  adminCommentsPath,
  adminCommentsQueryKey,
  invalidateAdminCommentQueries,
  runAdminCommentAction,
  runAdminCommentBulkAction,
} = await import("../modules/moderation/comment-list")
const client = new QueryClient()
const originalFetch = globalThis.fetch
const queryKey = adminCommentsQueryKey(apiBaseUrl, "admin")
const key = [...queryKey, 1, "", "all", "", "", ""]
const visibleComment = {
  id: "0199f711-739b-7000-8000-000000000001",
  parentId: null,
  body: "Bình luận đang hiển thị",
  status: "visible" as const,
  version: 1,
  author: { id: "user-1", name: "Người đọc", image: null, avatarFrame: frame },
  manga: {
    id: "0199f711-739b-7000-8000-000000000010",
    slug: "truyen-thu-nghiem",
    title: "Truyện thử nghiệm",
  },
  chapter: {
    id: "0199f711-739b-7000-8000-000000000011",
    volume: "1",
    number: "2",
    title: "Chương hai",
  },
  createdAt: "2026-09-25T10:00:00Z",
  updatedAt: "2026-09-25T10:00:00Z",
  editedAt: "2026-09-25T10:00:00Z",
}

try {
  client.setQueryData(key, {
    data: [
      visibleComment,
      {
        ...visibleComment,
        id: "0199f711-739b-7000-8000-000000000002",
        body: "Bình luận đã bị ẩn",
        parentId: visibleComment.id,
        status: "hidden",
        version: 2,
      },
    ],
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
  })
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AdminCommentList />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )

  assert.match(markup, /Bình luận đang hiển thị/)
  assert.match(markup, /data-slot="avatar"[^>]*size-10 overflow-hidden/)
  assert.match(markup, /src="https:\/\/cdn.example.test\/frame.webp"/)
  assert.match(markup, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(markup, /data-slot="avatar(?:-fallback)?"[^>]*rounded-md/)
  assert.match(markup, /Bình luận đã bị ẩn/)
  assert.match(markup, /Người đọc/)
  assert.match(markup, /Truyện thử nghiệm/)
  assert.match(markup, /Vol. 1 - Ch. 2/)
  assert.match(markup, /Phản hồi/)
  assert.match(markup, /Đã ẩn/)
  assert.match(markup, /2 bình luận/)
  assert.match(markup, /Chọn tất cả bình luận trong trang/)
  assert.match(markup, /Chọn bình luận của Người đọc/)

  assert.equal(
    adminCommentsPath(2, "  nội dung  ", "hidden", {
      mangaId: visibleComment.manga.id,
      chapterId: visibleComment.chapter.id,
      userId: visibleComment.author.id,
    }),
    `/v1/admin/comments?page=2&limit=20&q=n%E1%BB%99i+dung&status=hidden&mangaId=${visibleComment.manga.id}&chapterId=${visibleComment.chapter.id}&userId=user-1`
  )

  let actionRequest: { body: unknown; method: string; url: string } | undefined
  globalThis.fetch = async (input, init) => {
    actionRequest = {
      body: JSON.parse(String(init?.body)),
      method: String(init?.method),
      url: String(input),
    }
    return Response.json({ data: { ...visibleComment, status: "hidden" } })
  }
  await runAdminCommentAction(
    apiBaseUrl,
    visibleComment as unknown as Parameters<typeof runAdminCommentAction>[1]
  )
  assert.deepEqual(actionRequest, {
    body: { expectedVersion: 1, hidden: true },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/comments/${visibleComment.id}/visibility`,
  })

  await runAdminCommentBulkAction(
    apiBaseUrl,
    [
      visibleComment,
      { ...visibleComment, id: "0199f711-739b-7000-8000-000000000003" },
    ] as unknown as Parameters<typeof runAdminCommentBulkAction>[1],
    true
  )
  assert.deepEqual(actionRequest, {
    body: {
      hidden: true,
      items: [
        { expectedVersion: 1, id: visibleComment.id },
        {
          expectedVersion: 1,
          id: "0199f711-739b-7000-8000-000000000003",
        },
      ],
    },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/comments/visibility`,
  })

  const publicKey = ["comments", apiBaseUrl, "manga", visibleComment.manga.id]
  client.setQueryData(publicKey, { data: [] })
  assert.equal(client.getQueryState(key)?.isInvalidated, false)
  assert.equal(client.getQueryState(publicKey)?.isInvalidated, false)
  await invalidateAdminCommentQueries(client, apiBaseUrl, "admin")
  assert.equal(client.getQueryState(key)?.isInvalidated, true)
  assert.equal(client.getQueryState(publicKey)?.isInvalidated, true)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin comment list rendering checks passed")
