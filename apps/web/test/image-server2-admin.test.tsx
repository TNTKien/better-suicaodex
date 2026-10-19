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
const { AdminImageServer2 } = await import("../modules/image-server2/admin")
const client = new QueryClient()
const key = ["account", apiBaseUrl, "admin", "image-server2"]
const render = (mangaId?: string) =>
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminImageServer2 mangaId={mangaId} />
    </QueryClientProvider>
  )
try {
  client.setQueryData([...key, "worker"], {
    enabled: false,
    uploadConfigured: false,
    readEnabled: true,
  })
  client.setQueryData([...key, "mangas", "", 1], {
    data: [
      {
        id: "manga-a",
        title: "SV2 demo",
        slug: "sv2-demo",
        chapters: 10,
        ready: 4,
        failed: 1,
        running: 1,
        queued: 2,
      },
    ],
    meta: { page: 1, limit: 20, hasMore: false },
  })
  const paused = render()
  assert.match(paused, /role="switch"[^>]*aria-checked="false"/)
  assert.match(paused, /Upload đang tắt trong cấu hình/)
  assert.match(paused, /không khởi động tiến trình/)
  assert.match(paused, /SV2 demo/)
  assert.match(paused, /4 \/ 10/)
  assert.match(paused, /aria-label="Chọn SV2 demo"/)
  assert.match(paused, /href="\/admin\/image-server2\/manga-a\/chapters"/)
  for (const query of client.getQueryCache().getAll()) {
    const options = query.options as {
      refetchInterval?: number | false
      refetchIntervalInBackground?: boolean
      refetchOnWindowFocus?: boolean | "always"
    }
    assert.equal(options.refetchInterval, 15_000)
    assert.equal(options.refetchIntervalInBackground, false)
    assert.equal(options.refetchOnWindowFocus, "always")
  }
  client.setQueryData([...key, "worker"], {
    enabled: true,
    uploadConfigured: true,
    readEnabled: false,
  })
  const resumed = render()
  assert.match(resumed, /role="switch"[^>]*aria-checked="true"/)
  assert.doesNotMatch(resumed, /Upload đang tắt trong cấu hình/)
  client.setQueryData([...key, "mangas", "", 1], {
    data: [],
    meta: { page: 1, limit: 20, hasMore: false },
  })
  assert.match(render(), /Không có dữ liệu phù hợp/)

  client.clear()
  client.setQueryData([...key, "worker"], {
    enabled: true,
    uploadConfigured: true,
    readEnabled: true,
  })
  client.setQueryData([...key, "chapters", "manga-a", "all", 1], {
    manga: { id: "manga-a", title: "SV2 direct route" },
    data: [
      {
        id: "chapter-a",
        number: "9",
        title: "Cô bạn tội nghiệp",
        pagesVersion: 0,
        sourceVersion: null,
        state: "missing",
        verified: 0,
        total: 19,
        attempts: 0,
        lastErrorCode: null,
        nextRetryAt: null,
        updatedAt: null,
      },
    ],
    meta: { page: 1, limit: 20, hasMore: false },
  })
  const detail = render("manga-a")
  assert.match(detail, /SV2 direct route/)
  assert.match(detail, /Ch\. 9/)
  assert.match(detail, /0 \/ 19/)
  assert.match(detail, /href="\/admin\/image-server2"/)
  assert.match(detail, /Bấm Làm mới/)
  assert.ok(
    !client
      .getQueryCache()
      .getAll()
      .some((query) => query.queryKey[4] === "mangas"),
    "A chapter route must not mount the manga list query"
  )
  for (const query of client.getQueryCache().getAll()) {
    const options = query.options as {
      refetchInterval?: number | false
      refetchIntervalInBackground?: boolean
      refetchOnWindowFocus?: boolean | "always"
      refetchOnReconnect?: boolean
    }
    assert.equal(options.refetchInterval, 15_000)
    assert.equal(options.refetchIntervalInBackground, false)
    assert.equal(options.refetchOnWindowFocus, "always")
    assert.equal(options.refetchOnReconnect, false)
  }
} finally {
  client.clear()
  mock.restore()
}
console.log("Server 2 admin switch and progress rendering checks passed")
