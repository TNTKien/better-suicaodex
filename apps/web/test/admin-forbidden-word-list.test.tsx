import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const {
  AdminForbiddenWordList,
  forbiddenWordsQueryKey,
  runCreateForbiddenWord,
  runDeleteForbiddenWord,
} = await import("../modules/moderation/forbidden-word-list")
const client = new QueryClient()
const originalFetch = globalThis.fetch
const forbiddenWord = {
  id: "0199f711-739b-7000-8000-000000000001",
  word: "abcde",
  createdAt: "2026-09-25T10:00:00Z",
}

try {
  client.setQueryData(forbiddenWordsQueryKey(apiBaseUrl, "admin"), {
    data: [forbiddenWord],
  })
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminForbiddenWordList />
    </QueryClientProvider>
  )

  assert.match(markup, />abcde</)
  assert.match(markup, /1 từ cấm/)
  assert.match(markup, /Xóa từ cấm abcde/)

  const requests: Array<{ body?: unknown; method: string; url: string }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      method: String(init?.method),
      url: String(input),
    })
    return Response.json({ data: [forbiddenWord] }, { status: 201 })
  }
  await runCreateForbiddenWord(apiBaseUrl, forbiddenWord.word)
  assert.deepEqual(requests.at(-1), {
    body: { words: ["abcde"] },
    method: "POST",
    url: `${apiBaseUrl}/v1/admin/comments/forbidden-words`,
  })

  globalThis.fetch = async (input, init) => {
    requests.push({ method: String(init?.method), url: String(input) })
    return Response.json({ data: forbiddenWord })
  }
  await runDeleteForbiddenWord(apiBaseUrl, forbiddenWord)
  assert.deepEqual(requests.at(-1), {
    method: "DELETE",
    url: `${apiBaseUrl}/v1/admin/comments/forbidden-words/${forbiddenWord.id}`,
  })
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin forbidden word list checks passed")
