import assert from "node:assert/strict"
import {
  CommentApiError,
  commentOptions,
  createComment,
  updateComment,
  deleteComment,
} from "@workspace/account/comments-api"
import { validationError, maxCommentLength } from "@workspace/account/comments"
import { parseCommentBody } from "@workspace/account/comment-stickers"

const originalFetch = globalThis.fetch
const requests: { url: URL; init?: RequestInit }[] = []
let status = 200
let payload: unknown = { data: [], meta: { nextCursor: "cursor" } }
globalThis.fetch = (async (input, init) => {
  requests.push({ url: new URL(String(input)), init })
  return Response.json(payload, { status })
}) as typeof fetch
try {
  const options = commentOptions(
    "https://api.example.test",
    "manga",
    "manga/id"
  )
  assert.deepEqual(options.queryKey, [
    "comments",
    "https://api.example.test",
    "manga",
    "manga/id",
  ])
  assert.equal(options.staleTime, 30_000)
  assert.equal(options.retry, false)
  assert.notEqual(
    options.enabled,
    false,
    "Public reads must not require authentication"
  )
  const query = options.queryFn as (context: {
    pageParam: string | null
    signal: AbortSignal
  }) => Promise<unknown>
  const controller = new AbortController()
  await query({ pageParam: null, signal: controller.signal })
  assert.equal(requests[0]!.url.pathname, "/v1/manga/manga%2Fid/comments")
  assert.equal(requests[0]!.url.searchParams.get("limit"), "10")
  assert.equal(requests[0]!.init?.cache, "no-store")
  assert.equal(requests[0]!.init?.credentials, "include")
  controller.abort()
  assert.equal(requests[0]!.init?.signal?.aborted, true)
  await query({ pageParam: "cursor/id", signal: new AbortController().signal })
  assert.equal(requests.at(-1)!.url.searchParams.get("cursor"), "cursor/id")

  payload = { id: "comment" }
  await createComment("https://api.example.test", "manga", "manga", "Nội dung")
  assert.equal(requests.at(-1)!.init?.method, "POST")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    body: "Nội dung",
  })
  await createComment(
    "https://api.example.test",
    "chapter",
    "chapter",
    "Trả lời",
    "parent"
  )
  assert.equal(requests.at(-1)!.url.pathname, "/v1/chapters/chapter/comments")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    body: "Trả lời",
    parentId: "parent",
  })
  await updateComment("https://api.example.test", "comment/id", "Đã sửa", 7)
  assert.equal(requests.at(-1)!.url.pathname, "/v1/comments/comment%2Fid")
  assert.equal(requests.at(-1)!.init?.method, "PATCH")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    body: "Đã sửa",
    expectedVersion: 7,
  })
  await deleteComment("https://api.example.test", "comment", 8)
  assert.equal(requests.at(-1)!.init?.method, "DELETE")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    expectedVersion: 8,
  })
  status = 409
  payload = { error: { message: "Bình luận đã thay đổi." } }
  await assert.rejects(
    updateComment("https://api.example.test", "comment", "text", 1),
    (error) =>
      error instanceof CommentApiError &&
      error.status === 409 &&
      error.message === "Bình luận đã thay đổi."
  )

  assert.equal(validationError("  **Nội dung** 🙂  "), null)
  for (const body of [
    " ",
    "x".repeat(maxCommentLength + 1),
    "<b>HTML</b>",
    "<!-- HTML -->",
    "![ảnh](https://example.test/x.webp)",
    "![ảnh][source]",
  ]) {
    assert.ok(validationError(body))
  }
  const parsed = parseCommentBody(
    "Nội dung :BA-KOHARU: :ba-koharu: :khong-ton-tai:"
  )
  assert.deepEqual(parsed.stickerNames, ["ba-koharu", "ba-koharu"])
  assert.ok(parsed.text.includes(":khong-ton-tai:"))
  assert.ok(!parsed.text.includes(":BA-KOHARU:"))
} finally {
  globalThis.fetch = originalFetch
}
console.log(
  "Shared comment requests, public cursor reads, versions, validation and sticker parsing passed"
)
