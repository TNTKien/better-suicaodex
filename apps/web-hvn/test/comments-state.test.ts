import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as React from "react"
import * as Tanstack from "@tanstack/react-query"
import { commentKey } from "@workspace/account/comments-api"

const react = { ...React }
const tanstack = { ...Tanstack }
const states: unknown[] = []
let cursor = 0
mock.module("react", () => ({
  ...react,
  useState: (initial: unknown) => {
    const index = cursor++
    if (!(index in states)) states[index] = initial
    return [
      states[index],
      (value: unknown) => {
        states[index] =
          typeof value === "function" ? value(states[index]) : value
      },
    ]
  },
}))
const client = new Tanstack.QueryClient()
const pending: Promise<void>[] = []
type Mutation = {
  mutationFn: (variables: unknown) => Promise<unknown>
  onSuccess?: (data: unknown, variables: unknown) => Promise<void>
  onError?: (error: Error) => void | Promise<void>
}
mock.module("@tanstack/react-query", () => ({
  ...tanstack,
  useQueryClient: () => client,
  useInfiniteQuery: (options: { enabled?: unknown }) => {
    assert.notEqual(options.enabled, false)
    return {
      data: { pages: [{ data: [{ id: "root" }], meta: { nextCursor: null } }] },
    }
  },
  useMutation: (options: Mutation) => ({
    isPending: false,
    mutate: (variables: unknown) => {
      pending.push(
        (async () => {
          try {
            await options.onSuccess?.(
              await options.mutationFn(variables),
              variables
            )
          } catch (error) {
            await options.onError?.(error as Error)
          }
        })()
      )
    },
  }),
}))
const notices: { type: string; title: string }[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: { add: (notice: (typeof notices)[number]) => notices.push(notice) },
}))
const { useCommentThread } = await import("@workspace/account/comments")
const apiBaseUrl = "https://api.example.test"
function capture() {
  cursor = 0
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Isolated harness supplies React and query hook state.
  return useCommentThread<{ id: string }>(apiBaseUrl, "manga", "manga")
}
const requests: { url: URL; init?: RequestInit }[] = []
let responseStatus = 200
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input, init) => {
  requests.push({ url: new URL(String(input)), init })
  return Response.json(
    responseStatus === 200
      ? { id: "comment" }
      : { error: { message: "Bình luận đã thay đổi." } },
    { status: responseStatus }
  )
}) as typeof fetch
const settle = async () => {
  await Promise.all(pending.splice(0))
}
try {
  const mangaKey = commentKey(apiBaseUrl, "manga", "manga")
  const chapterKey = commentKey(apiBaseUrl, "chapter", "chapter")
  const otherApiKey = commentKey("https://other.example.test", "manga", "manga")
  for (const key of [mangaKey, chapterKey, otherApiKey])
    client.setQueryData(key, {})
  let thread = capture()
  assert.deepEqual(thread.items, [{ id: "root" }])
  thread.setState({
    body: "Bản nháp",
    edit: null,
    reply: { id: "root", author: "Người đăng", body: "trả lời" },
  })
  thread = capture()
  thread.submit("  trả lời  ", "root", "chapter")
  await settle()
  assert.equal(requests.at(-1)!.url.pathname, "/v1/chapters/chapter/comments")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    body: "trả lời",
    parentId: "root",
  })
  thread = capture()
  assert.equal(thread.state.body, "Bản nháp")
  assert.equal(thread.state.reply, null)
  assert.equal(client.getQueryState(mangaKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(chapterKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(otherApiKey)?.isInvalidated, false)
  assert.equal(notices.at(-1)?.type, "success")

  thread.submit("  Bình luận mới  ")
  await settle()
  assert.equal(requests.at(-1)!.url.pathname, "/v1/manga/manga/comments")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    body: "Bình luận mới",
  })
  assert.equal(capture().state.body, "")
  const beforeInvalid = requests.length
  thread.submit("<b>Không hỗ trợ</b>")
  thread.submitEdit("root", " ", 7)
  await settle()
  assert.equal(requests.length, beforeInvalid)
  assert.equal(notices.at(-1)?.type, "error")

  thread = capture()
  thread.setState({
    body: "",
    reply: null,
    edit: { id: "root", body: "Sửa", version: 7 },
  })
  thread.submitEdit("root", "  Sửa  ", 7)
  await settle()
  assert.equal(requests.at(-1)!.init?.method, "PATCH")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    body: "Sửa",
    expectedVersion: 7,
  })
  assert.equal(capture().state.edit, null)

  thread = capture()
  const beforeConfirm = requests.length
  thread.submitDelete("root", 8)
  assert.equal(
    requests.length,
    beforeConfirm,
    "Choosing delete must await confirmation"
  )
  thread = capture()
  assert.deepEqual(thread.deleteTarget, { id: "root", version: 8 })
  thread.remove.mutate(thread.deleteTarget!)
  await settle()
  assert.equal(requests.at(-1)!.init?.method, "DELETE")
  assert.deepEqual(JSON.parse(String(requests.at(-1)!.init?.body)), {
    expectedVersion: 8,
  })
  assert.equal(capture().deleteTarget, null)

  responseStatus = 409
  thread = capture()
  thread.setState({
    body: "",
    reply: null,
    edit: { id: "root", body: "Xung đột", version: 1 },
  })
  thread.submitEdit("root", "Xung đột", 1)
  await settle()
  assert.equal(capture().state.edit, null)
  assert.equal(notices.at(-1)?.title, "Bình luận đã thay đổi.")
  thread = capture()
  thread.submitDelete("root", 1)
  thread = capture()
  thread.remove.mutate(thread.deleteTarget!)
  await settle()
  assert.equal(capture().deleteTarget, null)

  responseStatus = 503
  thread = capture()
  thread.setState({
    body: "Giữ bản nháp",
    reply: null,
    edit: { id: "root", body: "Sửa lại", version: 2 },
  })
  thread.submitEdit("root", "Sửa lại", 2)
  await settle()
  assert.equal(capture().state.edit?.body, "Sửa lại")
  assert.equal(capture().state.body, "Giữ bản nháp")
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log(
  "Shared comment composer, chapter replies, invalidation, confirmation and version conflicts passed"
)
