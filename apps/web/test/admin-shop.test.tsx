import assert from "node:assert/strict"
import { existsSync } from "node:fs"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"
import {
  type AdminAvatarFrame,
  AvatarFrameError,
  adminFramesOptions,
  defaultFrameFilters,
  frameTopicsOptions,
} from "../modules/avatar-frames/admin-api"
import { defaultFrameAlignment } from "../modules/avatar-frames/avatar-decoration"
import {
  type ChestCatalog,
  type ShopChest,
  adminChestsOptions,
  chestDisplayName,
  chestPoolOptions,
  coinLabel,
  shopErrorMessage,
  shopNeedsReload,
  updateChestSale,
  updateFrameShop,
  validateFrameShopDraft,
} from "../modules/shop/admin-api"

const apiBaseUrl = "https://api.example.test"
let authenticated = true
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: authenticated ? { id: "admin" } : null,
    status: authenticated ? "authenticated" : "guest",
  }),
}))
const { AdminShop, AdminChestCard, AdminChestList, shopTabParam } =
  await import("../modules/shop/admin-shop")
const frame: AdminAvatarFrame = {
  ...defaultFrameAlignment,
  id: "0199f711-739b-7000-8000-000000000001",
  code: "test-frame",
  name: "Khung thử",
  description: "",
  topicId: null,
  rarity: "SR",
  limited: false,
  active: true,
  version: 4,
  shop: { price: "9007199254740993", stock: 10, version: 9 },
  frame: {
    ...defaultFrameAlignment,
    id: "0199f711-739b-7000-8000-000000000001",
    name: "Khung thử",
    assetUrl: "https://cdn.example.test/frame.webp",
    previewUrl: "https://cdn.example.test/preview.webp",
    animated: true,
    width: 318,
    height: 318,
  },
  frameCount: 55,
  byteSize: 1000,
  previewByteSize: 100,
  sha256: "hash",
  sourceSha256: "source",
  createdAt: "2026-10-06T00:00:00Z",
  updatedAt: "2026-10-06T00:00:00Z",
}
const chest: ShopChest = {
  id: "0199f711-739b-7000-8000-000000000002",
  name: "Rương chủ đề mới",
  kind: "topic",
  topic: { id: "0199f711-739b-7000-8000-000000000003", name: "Chủ đề mới" },
  version: 3,
  saleEnabled: false,
  // The wire contract is nullable; the generated Timestamp intersection loses null.
  retiredAt: null as unknown as ShopChest["retiredAt"],
  price: "5",
  pool: { R: 4, SR: 2, SSR: 1, total: 7, digest: "digest" },
  ready: true,
  blockReason: null,
}
const catalog: ChestCatalog = {
  data: [chest],
  meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
  rollEnabled: false,
  rule: {
    version: 1,
    price: "5",
    rates: { R: 8750, SR: 1000, SSR: 250 },
    rateDenominator: 10000,
    srPity: 10,
    ssrPity: 50,
    duplicateRefund: { R: "1", SR: "5", SSR: "20" },
  },
}
const client = new QueryClient()
const originalFetch = globalThis.fetch
try {
  assert.equal(chestDisplayName(chest), "Hộp Khung Avatar Chủ đề mới")
  assert.equal(
    chestDisplayName({ ...chest, kind: "common", topic: null }),
    "Hộp Khung Avatar ngẫu nhiên"
  )
  assert.equal(
    chestDisplayName({
      ...chest,
      topic: { id: null as unknown as string, name: "Chủ đề đã xoá" },
    }),
    "Hộp Khung Avatar Chủ đề đã xoá"
  )
  assert.equal(chest.name, "Rương chủ đề mới")
  assert.equal(coinLabel("9007199254740993"), "9.007.199.254.740.993 coin")
  assert.deepEqual(
    validateFrameShopDraft({
      price: "9223372036854775807",
      stock: "2147483647",
    }),
    {}
  )
  assert.deepEqual(validateFrameShopDraft({ price: " 15 ", stock: "0" }), {})
  for (const price of [
    "",
    "0",
    "-1",
    "1.5",
    "1e3",
    "015",
    "Infinity",
    "9223372036854775808",
    "999999999999999999999999999999",
  ])
    assert.ok(validateFrameShopDraft({ price, stock: "10" }).price)
  for (const stock of [
    "",
    "-1",
    "1.5",
    "1e3",
    "01",
    "2147483648",
    "999999999999999999999999999999",
  ])
    assert.ok(validateFrameShopDraft({ price: "15", stock }).stock)
  for (const code of [
    "VERSION_CONFLICT",
    "SHOP_VERSION_CONFLICT",
    "GACHA_VERSION_CONFLICT",
  ]) {
    const error = new AvatarFrameError(409, code, "Raw error")
    assert.equal(shopNeedsReload(error), true)
    assert.match(shopErrorMessage(error), /tải trạng thái mới/)
  }
  assert.equal(shopNeedsReload(new TypeError("Network error")), true)
  assert.equal(
    shopNeedsReload(
      new AvatarFrameError(503, "SERVICE_UNAVAILABLE", "Unavailable")
    ),
    true
  )
  assert.equal(
    shopNeedsReload(new AvatarFrameError(400, "VALIDATION_ERROR", "Invalid")),
    false
  )
  assert.match(
    shopErrorMessage(new AvatarFrameError(403, "FORBIDDEN", "Denied")),
    /không có quyền/
  )
  assert.match(
    shopErrorMessage(
      new AvatarFrameError(409, "GACHA_POOL_UNAVAILABLE", "Pool invalid")
    ),
    /R, SR và SSR/
  )
  assert.equal(shopTabParam.parse("invalid"), null)
  const chestOptions = adminChestsOptions(apiBaseUrl, "admin", 2)
  assert.equal(chestOptions.retry, false)
  assert.equal(chestOptions.gcTime, 0)
  assert.equal(chestOptions.staleTime, 30_000)
  assert.notDeepEqual(
    chestOptions.queryKey,
    adminChestsOptions(apiBaseUrl, "other", 2).queryKey
  )
  assert.notDeepEqual(
    chestOptions.queryKey,
    adminChestsOptions("https://other.example.test", "admin", 2).queryKey
  )
  client.setQueryData(chestOptions.queryKey, catalog)
  client.setQueryData(
    adminFramesOptions(apiBaseUrl, "admin", defaultFrameFilters).queryKey,
    { data: [frame], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }
  )
  client.setQueryData(frameTopicsOptions(apiBaseUrl, "admin").queryKey, {
    data: [],
  })
  const render = (searchParams = "") =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={searchParams}>
          <AdminShop />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    )
  const framesMarkup = render()
  assert.match(framesMarkup, /9.007.199.254.740.993 coin/)
  assert.match(framesMarkup, /Giá \/ tồn kho/)
  assert.match(framesMarkup, /href="\/admin\/avatar-frames"/)
  const catalogLink = framesMarkup.match(
    /<a\b[^>]*href="\/admin\/avatar-frames"[^>]*>/
  )![0]
  assert.doesNotMatch(catalogLink, /\brole="button"/)
  assert.doesNotMatch(catalogLink, /\btype="button"/)
  assert.doesNotMatch(
    framesMarkup,
    /Thêm khung|>Chủ đề<|Hộp Khung Avatar Chủ đề mới|frame.webp/
  )
  const chestsMarkup = render("?shopTab=chests&chestPage=2")
  assert.match(chestsMarkup, /Hộp Khung Avatar Chủ đề mới/)
  assert.doesNotMatch(chestsMarkup, /rương/i)
  assert.match(chestsMarkup, /Gacha đang tắt/)
  assert.match(chestsMarkup, /87,5%/)
  assert.match(chestsMarkup, /2,5%/)
  assert.match(chestsMarkup, /2\/2/)
  assert.match(chestsMarkup, /Xem pool/)
  assert.match(chestsMarkup, /Bảo hiểm dùng chung/)
  assert.doesNotMatch(chestsMarkup, /Khung thử/)
  for (const [name, file] of [
    ["Genshin Impact", "genshin-chest.webp"],
    ["Honkai Impact 3rd", "hi3-chest.webp"],
    ["Honkai Impact 3", "hi3-chest.webp"],
    ["Honkai: Star Rail", "hsr-chest.webp"],
    ["Zenless Zen Zero", "zzz-chest.webp"],
    ["Zenless Zone Zero", "zzz-chest.webp"],
    ["Arknights: Endfield", "a9e-chest.png"],
    ["Discord", "discord-chest.webp"],
  ] as const) {
    assert.ok(
      existsSync(new URL(`../public/images/shop/${file}`, import.meta.url))
    )
    const markup = renderToStaticMarkup(
      <AdminChestCard
        chest={{ ...chest, topic: { ...chest.topic!, name } }}
        onPool={() => {}}
        onSale={() => {}}
      />
    )
    assert.ok(markup.includes(`src="/images/shop/${file}"`))
    assert.match(markup, /object-contain/)
    assert.match(markup, /alt=""/)
    assert.doesNotMatch(markup, /_next\/image/)
  }
  const commonMarkup = renderToStaticMarkup(
    <AdminChestCard
      chest={{ ...chest, kind: "common", topic: null }}
      onPool={() => {}}
      onSale={() => {}}
    />
  )
  assert.ok(
    existsSync(
      new URL("../public/images/shop/normal-chest.png", import.meta.url)
    )
  )
  assert.match(commonMarkup, /src="\/images\/shop\/normal-chest.png"/)
  assert.match(commonMarkup, /Hộp Khung Avatar ngẫu nhiên/)
  assert.doesNotMatch(commonMarkup, /rương/i)
  for (const fallback of [
    { ...chest, topic: { ...chest.topic!, name: "Chủ đề chưa có ảnh" } },
    { ...chest, topic: { ...chest.topic!, name: "constructor" } },
  ]) {
    const markup = renderToStaticMarkup(
      <AdminChestCard chest={fallback} onPool={() => {}} onSale={() => {}} />
    )
    assert.doesNotMatch(markup, /<img/)
    assert.match(markup, /lucide-package-open/)
  }
  for (const blocked of [
    { ...chest, ready: false, blockReason: "pool_unavailable" as const },
    {
      ...chest,
      retiredAt: "2026-10-06T00:00:00Z",
      ready: false,
      blockReason: "retired" as const,
    },
  ]) {
    const markup = renderToStaticMarkup(
      <AdminChestCard chest={blocked} onPool={() => {}} onSale={() => {}} />
    )
    const button = markup.match(
      /<button[^>]*aria-label="Mở bán Hộp Khung Avatar Chủ đề mới"[^>]*>/
    )![0]
    assert.match(button, /disabled=""/)
  }
  const canCloseMarkup = renderToStaticMarkup(
    <AdminChestCard
      chest={{ ...chest, saleEnabled: true, ready: false }}
      onPool={() => {}}
      onSale={() => {}}
    />
  )
  const closeButton = canCloseMarkup.match(
    /<button[^>]*aria-label="Đóng bán Hộp Khung Avatar Chủ đề mới"[^>]*>/
  )![0]
  assert.doesNotMatch(closeButton, /\sdisabled=""/)
  const loadingMarkup = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <NuqsTestingAdapter>
        <AdminChestList apiBaseUrl={apiBaseUrl} userId="fresh" />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
  assert.match(loadingMarkup, /Đang tải hộp/)
  authenticated = false
  assert.equal(render(), "")
  authenticated = true

  let requestUrl = ""
  let requestInit: RequestInit = {}
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init ?? {}
    return Response.json({ data: frame })
  }) as typeof fetch
  await updateFrameShop(apiBaseUrl, frame, {
    price: "9007199254740993",
    stock: "0",
  })
  assert.equal(
    requestUrl,
    `${apiBaseUrl}/v1/admin/avatar-frames/${frame.id}/shop`
  )
  assert.equal(requestInit.method, "PATCH")
  assert.equal(requestInit.credentials, "include")
  assert.deepEqual(JSON.parse(String(requestInit.body)), {
    expectedVersion: 4,
    expectedShopVersion: 9,
    price: "9007199254740993",
    stock: 0,
  })
  assert.throws(
    () => updateFrameShop(apiBaseUrl, frame, { price: "0", stock: "10" }),
    /Invalid shop fields/
  )
  await updateChestSale(apiBaseUrl, chest)
  assert.equal(requestUrl, `${apiBaseUrl}/v1/admin/shop/chests/${chest.id}`)
  assert.deepEqual(JSON.parse(String(requestInit.body)), {
    expectedVersion: 3,
    saleEnabled: true,
  })
  await updateChestSale(apiBaseUrl, { ...chest, saleEnabled: true })
  assert.equal(JSON.parse(String(requestInit.body)).saleEnabled, false)
  await client.fetchQuery(
    chestPoolOptions(apiBaseUrl, "admin", chest.id, 2, "SSR")
  )
  assert.equal(
    requestUrl,
    `${apiBaseUrl}/v1/shop/chests/${chest.id}/pool?page=2&limit=20&rarity=SSR`
  )
  await client.fetchQuery(adminChestsOptions(apiBaseUrl, "fresh", 1))
  assert.equal(requestUrl, `${apiBaseUrl}/v1/admin/shop/chests?page=1&limit=20`)
  let attempts = 0
  globalThis.fetch = (async () => {
    attempts++
    return Response.json(
      { error: { code: "SHOP_VERSION_CONFLICT", message: "Changed" } },
      { status: 409 }
    )
  }) as typeof fetch
  await assert.rejects(
    updateFrameShop(apiBaseUrl, frame, { price: "15", stock: "10" }),
    (error: unknown) =>
      error instanceof AvatarFrameError && shopNeedsReload(error)
  )
  assert.equal(attempts, 1)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log("Admin Shop checks passed")
