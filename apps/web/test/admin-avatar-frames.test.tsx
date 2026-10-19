import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"

import {
  type AdminAvatarFrame,
  type FrameList,
  AvatarFrameError,
  MAX_FRAME_SOURCE_BYTES,
  adminFramesKey,
  adminFramesOptions,
  adminFramesPath,
  createFrame,
  defaultFrameFilters,
  findFrameByCode,
  frameErrorMessage,
  frameNeedsReload,
  updateFrame,
  uploadFrame,
  validateFrameFile,
  frameTopicsOptions,
  saveFrameWithAsset,
  saveFrameTopic,
  removeFrameTopic,
} from "../modules/avatar-frames/admin-api"
import {
  AdminFramePreview,
  SelectedFramePreview,
} from "../modules/avatar-frames/admin-preview"
import {
  defaultFrameAlignment,
  frameOverlayStyle,
} from "../modules/avatar-frames/avatar-decoration"

const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const { AdminAvatarFrameList, frameListParams } =
  await import("../modules/avatar-frames/admin-list")
const frame: AdminAvatarFrame = {
  ...defaultFrameAlignment,
  id: "0199f711-739b-7000-8000-000000000001",
  code: "furina",
  name: "Furina",
  description: "Khung đặc biệt",
  topicId: null,
  rarity: "SSR",
  limited: true,
  active: true,
  version: 3,
  shop: { price: "100", stock: 0, version: 1 },
  frame: {
    ...defaultFrameAlignment,
    id: "0199f711-739b-7000-8000-000000000001",
    name: "Furina",
    assetUrl: "https://cdn.example.test/furina-animated.webp",
    previewUrl: "https://cdn.example.test/furina-preview.webp",
    animated: true,
    width: 318,
    height: 318,
  },
  frameCount: 120,
  byteSize: 3_000_000,
  previewByteSize: 35_000,
  sha256: "abc",
  sourceSha256: "def",
  createdAt: "2026-10-03T00:00:00Z",
  updatedAt: "2026-10-03T00:00:00Z",
}
const result: FrameList = {
  data: [frame],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
}
const client = new QueryClient()
const originalFetch = globalThis.fetch

try {
  assert.equal(
    adminFramesPath(defaultFrameFilters),
    "/v1/admin/avatar-frames?page=1&limit=20"
  )
  assert.equal(
    adminFramesPath({
      page: 2,
      q: " Khung đẹp ",
      rarity: "SSR",
      limited: "true",
      active: "false",
    }),
    "/v1/admin/avatar-frames?page=2&limit=20&q=Khung+%C4%91%E1%BA%B9p&rarity=SSR&active=false&limited=true"
  )
  assert.match(adminFramesPath({ ...defaultFrameFilters, page: -3 }), /page=1&/)
  assert.equal(frameListParams.rarity.parse("legendary"), null)
  assert.equal(frameListParams.active.parse("false"), "false")
  assert.equal(frameListParams.page.parse("3"), 3)
  assert.notDeepEqual(
    adminFramesKey(apiBaseUrl, "one"),
    adminFramesKey(apiBaseUrl, "two")
  )
  const options = adminFramesOptions(apiBaseUrl, "admin", defaultFrameFilters)
  assert.equal(options.retry, false)
  assert.equal(options.gcTime, 0)
  assert.equal(options.staleTime, 30_000)
  client.setQueryData(options.queryKey, result)
  const topic = {
    id: "0199f711-739b-7000-8000-000000000002",
    name: "Genshin Impact",
    version: 2,
  }
  client.setQueryData(frameTopicsOptions(apiBaseUrl, "admin").queryKey, {
    data: [{ ...topic, frameCount: 1 }],
  })
  assert.match(
    adminFramesPath({ ...defaultFrameFilters, topicId: topic.id }),
    /topicId=0199f711/
  )
  assert.match(
    adminFramesPath({ ...defaultFrameFilters, topicId: "none" }),
    /topicId=none/
  )
  const renderList = (searchParams = "") =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={searchParams}>
          <AdminAvatarFrameList />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    )
  const markup = renderList()
  assert.match(markup, /Furina/)
  assert.match(markup, /Khung đặc biệt/)
  assert.match(markup, /Limited/)
  assert.match(markup, /SSR/)
  assert.match(markup, /Ảnh động/)
  assert.match(markup, /Đang bật/)
  assert.match(markup, /furina-preview.webp/)
  assert.doesNotMatch(markup, /furina-animated.webp/)
  assert.doesNotMatch(markup, /Cấp khung|Thu hồi|Trang bị/)
  assert.match(markup, /aria-label="Quản lý khung Furina"/)

  const filtered = {
    ...defaultFrameFilters,
    page: 2,
    rarity: "SSR" as const,
    limited: "true" as const,
    active: "false" as const,
    q: "draft",
  }
  client.setQueryData(
    adminFramesOptions(apiBaseUrl, "admin", filtered).queryKey,
    {
      data: [{ ...frame, name: "Bản nháp thử", active: false, frame: null }],
      meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
    }
  )
  const filteredMarkup = renderList(
    "?page=2&q=draft&rarity=SSR&limited=true&active=false"
  )
  assert.match(filteredMarkup, /Bản nháp thử/)
  assert.match(filteredMarkup, /Chưa có ảnh/)
  assert.match(filteredMarkup, /2\/2/)
  assert.doesNotMatch(filteredMarkup, /furina-animated.webp/)

  const preview = renderToStaticMarkup(
    <AdminFramePreview frame={frame.frame} animate />
  )
  assert.match(preview, /furina-animated.webp/)
  assert.match(preview, /prefers-reduced-motion: reduce/)
  assert.match(
    preview,
    /srcSet="https:\/\/cdn.example.test\/furina-preview.webp"/i
  )
  const staticPreview = renderToStaticMarkup(
    <AdminFramePreview frame={{ ...frame.frame!, animated: false }} animate />
  )
  assert.doesNotMatch(staticPreview, /<picture/)
  const catalogPreview = renderToStaticMarkup(
    <AdminFramePreview frame={frame.frame} />
  )
  for (const markup of [staticPreview, catalogPreview])
    assert.match(markup, /<img[^>]*class="[^"]*\bmax-w-none\b/)

  const file = new File(["fake-webp-fixture"], "frame.webp", {
    type: "image/webp",
  })
  const selectedPreview = renderToStaticMarkup(
    <SelectedFramePreview file={file} />
  )
  const previewSource = readFileSync(
    new URL("../modules/avatar-frames/admin-preview.tsx", import.meta.url),
    "utf8"
  )
  assert.match(previewSource, /const \{ account \} = useAccount\(\)/)
  assert.match(previewSource, /src=\{account\?\.user\.image \?\? undefined\}/)
  assert.doesNotMatch(previewSource, /http:\/\/localhost:9000\/users\//)
  for (const markup of [preview, staticPreview, selectedPreview]) {
    assert.match(markup, /width:125%;height:125%;left:50%;top:50%/)
    assert.match(markup, /data-slot="avatar"[^>]*class="[^"]*size-32/)
    assert.match(markup, /data-slot="avatar-fallback"/)
    assert.match(markup, /relative flex size-40 items-center justify-center/)
  }
  const alignment = { displayScale: 130, offsetX: 4, offsetY: -6 }
  assert.deepEqual(
    frameOverlayStyle({ displayScale: NaN }),
    frameOverlayStyle(defaultFrameAlignment)
  )
  for (const markup of [
    renderToStaticMarkup(
      <AdminFramePreview frame={frame.frame} alignment={alignment} animate />
    ),
    renderToStaticMarkup(
      <AdminFramePreview frame={frame.frame} alignment={alignment} />
    ),
    renderToStaticMarkup(
      <SelectedFramePreview file={file} alignment={alignment} />
    ),
  ])
    assert.match(markup, /width:130%;height:130%;left:54%;top:44%/)
  assert.equal(validateFrameFile(file), null)
  assert.equal(
    validateFrameFile(new File(["png"], "frame.PNG", { type: "image/png" })),
    null
  )
  assert.match(validateFrameFile(new File([], "empty.webp"))!, /trống/)
  assert.match(
    validateFrameFile(new File(["GIF"], "frame.gif", { type: "image/gif" }))!,
    /Chỉ nhận/
  )
  assert.match(
    validateFrameFile(
      new File(["bad"], "frame.webp", { type: "image/svg+xml" })
    )!,
    /Chỉ nhận/
  )
  assert.match(
    validateFrameFile({ ...file, size: MAX_FRAME_SOURCE_BYTES + 1 } as File)!,
    /10 MiB/
  )

  const requests: Array<{ url: string; init: RequestInit | undefined }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init })
    return Response.json({ data: frame })
  }
  await createFrame(apiBaseUrl, {
    code: "new-frame",
    name: "Khung mới",
    rarity: "R",
    limited: false,
  })
  assert.equal(requests.at(-1)?.init?.method, "POST")
  assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)), {
    code: "new-frame",
    name: "Khung mới",
    rarity: "R",
    limited: false,
  })
  assert.equal(requests.at(-1)?.init?.credentials, "include")
  assert.equal(requests.at(-1)?.init?.cache, "no-store")
  await updateFrame(apiBaseUrl, frame.id, {
    expectedVersion: 3,
    name: "Mới",
    rarity: "SSR",
    limited: true,
  })
  assert.equal(requests.at(-1)?.init?.method, "PATCH")
  assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)), {
    expectedVersion: 3,
    name: "Mới",
    rarity: "SSR",
    limited: true,
  })
  await updateFrame(apiBaseUrl, frame.id, { expectedVersion: 4, active: false })
  assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)), {
    expectedVersion: 4,
    active: false,
  })
  await updateFrame(apiBaseUrl, frame.id, { expectedVersion: 4, ...alignment })
  assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)), {
    expectedVersion: 4,
    ...alignment,
  })
  await uploadFrame(apiBaseUrl, frame, file)
  const upload = requests.at(-1)!
  assert.equal(
    upload.url,
    `${apiBaseUrl}/v1/admin/avatar-frames/${frame.id}/asset`
  )
  assert.equal(upload.init?.method, "POST")
  assert.equal(new Headers(upload.init?.headers).has("content-type"), false)
  assert.ok(upload.init?.body instanceof FormData)
  assert.equal(upload.init.body.get("expectedVersion"), "3")
  assert.equal((upload.init.body.get("file") as File).name, "frame.webp")
  const beforeInvalid = requests.length
  await assert.rejects(
    uploadFrame(apiBaseUrl, frame, new File([], "bad.webp")),
    AvatarFrameError
  )
  assert.equal(requests.length, beforeInvalid)

  await saveFrameTopic(apiBaseUrl, " Tên mới ", topic)
  assert.equal(requests.at(-1)?.init?.method, "PATCH")
  assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)), {
    name: "Tên mới",
    expectedVersion: 2,
  })
  await removeFrameTopic(apiBaseUrl, topic)
  assert.equal(requests.at(-1)?.init?.method, "DELETE")
  assert.deepEqual(JSON.parse(String(requests.at(-1)?.init?.body)), {
    expectedVersion: 2,
  })

  // A create can succeed while upload fails: the caller receives the saved
  // ID/version first, and its retry uses PATCH rather than POSTing a duplicate.
  const saving = {
    code: "create-with-image",
    name: "Ảnh khi tạo",
    description: "Mô tả",
    topicId: topic.id,
    rarity: "SR" as const,
    limited: false,
  }
  let persisted: AdminAvatarFrame | null = null
  const operations: string[] = []
  globalThis.fetch = async (input, init) => {
    operations.push(`${init?.method} ${new URL(String(input)).pathname}`)
    if (String(input).endsWith("/asset")) {
      assert.equal((init?.body as FormData).get("expectedVersion"), "3")
      assert.equal(persisted?.id, frame.id)
      return Response.json(
        { error: { code: "INVALID_AVATAR_FRAME", message: "Invalid image" } },
        { status: 400 }
      )
    }
    assert.equal(JSON.parse(String(init?.body)).topicId, topic.id)
    return Response.json({ data: frame })
  }
  await assert.rejects(
    saveFrameWithAsset(apiBaseUrl, saving, null, file, (saved) => {
      persisted = saved
    }),
    AvatarFrameError
  )
  assert.deepEqual(operations, [
    "POST /v1/admin/avatar-frames",
    `POST /v1/admin/avatar-frames/${frame.id}/asset`,
  ])
  operations.length = 0
  await assert.rejects(
    saveFrameWithAsset(apiBaseUrl, saving, persisted, file, (saved) => {
      persisted = saved
    }),
    AvatarFrameError
  )
  assert.deepEqual(operations, [
    `PATCH /v1/admin/avatar-frames/${frame.id}`,
    `POST /v1/admin/avatar-frames/${frame.id}/asset`,
  ])
  operations.length = 0
  await assert.rejects(
    saveFrameWithAsset(apiBaseUrl, saving, null, new File([], "bad.webp"), () =>
      assert.fail("No metadata should be created")
    ),
    AvatarFrameError
  )
  assert.equal(operations.length, 0)

  let pageCalls = 0
  globalThis.fetch = async () => {
    pageCalls += 1
    return Response.json({
      ...result,
      data: pageCalls === 1 ? [{ ...frame, code: "furina-other" }] : [frame],
      meta: { ...result.meta, totalPages: 2 },
    })
  }
  assert.equal((await findFrameByCode(apiBaseUrl, "furina"))?.id, frame.id)
  assert.equal(pageCalls, 2)
  globalThis.fetch = async () =>
    Response.json({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
  assert.equal(await findFrameByCode(apiBaseUrl, "missing"), null)

  for (const [status, code, message, reload] of [
    [409, "VERSION_CONFLICT", "Khung đã thay đổi", true],
    [403, "LIMITED_IMMUTABLE", "Không thể đổi loại limited", false],
    [409, "FRAME_CODE_CONFLICT", "Mã khung đã tồn tại", false],
    [401, "UNAUTHORIZED", "Phiên đăng nhập", false],
    [429, "IMAGE_PROCESSOR_BUSY", "đang bận", false],
    [503, "MEDIA_STORAGE_UNAVAILABLE", "Kho ảnh", true],
  ] as const) {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return Response.json({ error: { code, message: "upstream" } }, { status })
    }
    await assert.rejects(
      updateFrame(apiBaseUrl, frame.id, { expectedVersion: 3, active: true }),
      (error: unknown) => {
        assert.ok(error instanceof AvatarFrameError)
        assert.ok(frameErrorMessage(error).includes(message))
        assert.equal(frameNeedsReload(error), reload)
        return true
      }
    )
    assert.equal(calls, 1)
  }
  assert.equal(frameNeedsReload(new TypeError("Failed to fetch")), true)
  assert.match(frameErrorMessage(new Error()), /chưa xác định/)

  let querySignal: AbortSignal | null | undefined
  globalThis.fetch = (_input, init) => {
    querySignal = init?.signal
    return new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError"))
      )
    )
  }
  const pending = client
    .fetchQuery({ ...options, staleTime: 0 })
    .catch(() => null)
  await client.cancelQueries({ queryKey: adminFramesKey(apiBaseUrl, "admin") })
  await pending
  assert.equal(querySignal?.aborted, true)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}
console.log("Admin avatar frame catalog checks passed")
