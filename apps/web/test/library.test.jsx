import assert from "node:assert/strict"
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"

import { loginHref } from "../modules/account/api"
import {
  deleteLibraryItem,
  LibraryApiError,
  libraryItemOptions,
  libraryListOptions,
  librarySearchParser,
  librarySortParser,
  libraryTabParser,
  putLibraryItem,
} from "../modules/library/api"

const apiBaseUrl = "https://api.example.test"
const mangaId = "019916a5-3013-7b3f-a0ef-66237490a7bb"
const originalFetch = globalThis.fetch
const client = new QueryClient()
const feedback = []
let actionProps
let accountState = {
  account: null,
  apiBaseUrl,
  retry: async () => {},
  status: "guest",
  user: null,
}

try {
  const methods = []
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${apiBaseUrl}/v1/me/library/${mangaId}`)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    methods.push(init?.method ?? "GET")
    if (init?.method === "PUT") {
      assert.deepEqual(JSON.parse(String(init.body)), { category: "reading" })
      return Response.json({ data: { category: "reading" } })
    }
    if (init?.method === "DELETE") return new Response(null, { status: 204 })
    return Response.json({ data: null })
  }

  const options = libraryItemOptions(apiBaseUrl, "user-a", mangaId)
  assert.equal(await client.fetchQuery(options), null)
  assert.notDeepEqual(
    options.queryKey,
    libraryItemOptions(apiBaseUrl, "user-b", mangaId).queryKey
  )
  assert.equal(libraryItemOptions(apiBaseUrl, null, mangaId).enabled, false)
  assert.equal(
    (await putLibraryItem(apiBaseUrl, mangaId, "reading")).category,
    "reading"
  )
  await deleteLibraryItem(apiBaseUrl, mangaId)
  assert.deepEqual(methods, ["GET", "PUT", "DELETE"])

  const listRequests = []
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    listRequests.push(url.pathname + url.search)
    return Response.json({
      data: [],
      meta: {
        limit: 20,
        nextCursor: listRequests.length === 1 ? "cursor-2" : null,
      },
    })
  }
  const listOptions = libraryListOptions(
    apiBaseUrl,
    "user-a",
    "reading",
    "needle",
    "latestChapter"
  )
  assert.equal(listOptions.gcTime, 5 * 60_000)
  assert.equal(listOptions.staleTime, 30_000)
  const listClient = new QueryClient()
  const list = await listClient.fetchInfiniteQuery({
    ...listOptions,
    pages: 2,
  })
  assert.equal(list.pages.length, 2)
  assert.deepEqual(listRequests, [
    "/v1/me/library?category=reading&limit=20&sort=latestChapter&q=needle",
    "/v1/me/library?category=reading&limit=20&sort=latestChapter&q=needle&cursor=cursor-2",
  ])
  listClient.clear()
  assert.notDeepEqual(
    listOptions.queryKey,
    libraryListOptions(apiBaseUrl, "user-a", "completed").queryKey
  )
  assert.equal(libraryListOptions(apiBaseUrl, null, "following").enabled, false)
  assert.equal(libraryTabParser.parseServerSide("completed"), "completed")
  assert.equal(libraryTabParser.parseServerSide("invalid"), "following")
  assert.equal(librarySearchParser.parseServerSide("needle"), "needle")
  assert.equal(
    librarySortParser.parseServerSide("latestChapter"),
    "latestChapter"
  )
  assert.equal(librarySortParser.parseServerSide("invalid"), "addedAt")

  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(
    putLibraryItem(apiBaseUrl, mangaId, "plan"),
    (error) => error instanceof LibraryApiError && error.status === 401
  )
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}

mock.module("../modules/account/provider", () => ({
  useAccount: () => accountState,
}))
mock.module("@bprogress/next/app", () => ({
  useRouter: () => ({ push: () => {} }),
}))
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: (options) => {
      feedback.push(`${options.type}:${options.title}`)
      actionProps = options.actionProps
      return "toast-id"
    },
    close: (id) => feedback.push(`close:${id}`),
  },
}))

const { MangaLibraryAction, showLibraryLoginToast } =
  await import("../modules/library/manga-library-action")
const { MyLibrary } = await import("../modules/library/my-library")
const returnTo = `/manga/${mangaId}/manga-demo`
const guestActionClient = new QueryClient()
const markup = renderToStaticMarkup(
  <QueryClientProvider client={guestActionClient}>
    <MangaLibraryAction mangaId={mangaId} returnTo={returnTo} />
  </QueryClientProvider>
)
assert.match(markup, /Thêm vào thư viện/)
assert.match(markup, /w-52/)
assert.doesNotMatch(markup, /href=/)
guestActionClient.clear()

const guestLibraryClient = new QueryClient()
const guestLibrary = renderToStaticMarkup(
  <QueryClientProvider client={guestLibraryClient}>
    <NuqsTestingAdapter>
      <MyLibrary />
    </NuqsTestingAdapter>
  </QueryClientProvider>
)
assert.match(guestLibrary, /Đăng nhập để xem thư viện truyện của bạn/)
assert.match(guestLibrary, /returnTo=%2Fmy-library/)
guestLibraryClient.clear()

accountState = {
  ...accountState,
  status: "authenticated",
  user: { id: "user-a" },
}
const authenticatedLibraryClient = new QueryClient()
const authenticatedLibrary = renderToStaticMarkup(
  <QueryClientProvider client={authenticatedLibraryClient}>
    <NuqsTestingAdapter searchParams="?tab=reading">
      <MyLibrary />
    </NuqsTestingAdapter>
  </QueryClientProvider>
)
for (const label of ["Theo dõi", "Đang đọc", "Sẽ đọc", "Đã hoàn thành"])
  assert.match(authenticatedLibrary, new RegExp(label))
assert.match(authenticatedLibrary, /data-orientation="vertical"/)
assert.match(authenticatedLibrary, /aria-label="Danh mục thư viện"/)
assert.match(authenticatedLibrary, /placeholder="Tìm kiếm\.\.\."/)
assert.match(authenticatedLibrary, /aria-label="Sắp xếp thư viện"/)
assert.match(authenticatedLibrary, /Đang tải thư viện/)
assert.match(authenticatedLibrary, /data-slot="spinner"/)
authenticatedLibraryClient.clear()

const populatedLibraryClient = new QueryClient()
populatedLibraryClient.setQueryData(
  libraryListOptions(apiBaseUrl, "user-a", "reading").queryKey,
  {
    pages: [
      {
        data: [
          {
            category: "reading",
            createdAt: "2026-09-05T00:00:00.000Z",
            updatedAt: "2026-09-05T00:00:00.000Z",
            manga: {
              id: mangaId,
              slug: "manga-demo",
              title: "Manga demo",
              cover: null,
            },
          },
        ],
        meta: { limit: 20, nextCursor: null },
      },
    ],
    pageParams: [null],
  }
)
const populatedLibrary = renderToStaticMarkup(
  <QueryClientProvider client={populatedLibraryClient}>
    <NuqsTestingAdapter searchParams="?tab=reading">
      <MyLibrary />
    </NuqsTestingAdapter>
  </QueryClientProvider>
)
assert.match(populatedLibrary, /aria-label="Xóa Manga demo khỏi thư viện"/)
populatedLibraryClient.clear()

let destination
showLibraryLoginToast(returnTo, (href) => {
  destination = href
})
assert.deepEqual(feedback, ["info:Bạn cần đăng nhập để dùng chức năng này!"])
assert.equal(actionProps.children, "Đăng nhập")
actionProps.onClick()
assert.equal(destination, loginHref(returnTo))
assert.deepEqual(feedback, [
  "info:Bạn cần đăng nhập để dùng chức năng này!",
  "close:toast-id",
])

console.log("Authenticated library action checks passed")
