import assert from "node:assert/strict"
import "./case-reel.test"
import { gachaReceipt } from "./gacha-purchase.test"
import { existsSync, readFileSync } from "node:fs"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AvatarFrameError } from "../modules/avatar-frames/admin-api"
import { defaultFrameAlignment } from "../modules/avatar-frames/avatar-decoration"
import {
  framePurchaseLabel,
  purchaseErrorMessage,
  purchaseFrame,
  purchaseStorageKey,
  purchaseUncertain,
  readPendingPurchase,
  refreshShopPurchase,
  savePendingPurchase,
  shopFramesKey,
  shopFramesOptions,
  shopFramesPath,
  shopTopicsOptions,
  shopWalletOptions,
  shopChestsOptions,
  shopChestPoolOptions,
  type PurchaseAttempt,
  type ShopFrame,
} from "../modules/shop/api"
import type { ChestCatalog } from "../modules/shop/admin-api"
import { ShopCategoryLink } from "../modules/shop/navigation"

const apiBaseUrl = "https://api.example.test"
const identity = { userId: "user-a", sessionId: "session-a" }
const { PagePagination: renderPagination } =
  await import("../components/page-pagination")
const paginationCapture: { element?: ReturnType<typeof renderPagination> } = {}
mock.module("../components/page-pagination", () => ({
  PagePagination: (props: Parameters<typeof renderPagination>[0]) => {
    paginationCapture.element = renderPagination(props)
    return paginationCapture.element
  },
}))
let authenticated = false
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    status: authenticated ? "authenticated" : "guest",
    account: authenticated
      ? { user: { name: "user-a", image: null }, profile: { status: "active" } }
      : null,
    identity: authenticated ? identity : null,
  }),
}))
const { AvatarFrameShop, ShopFrameCard, ShopFrameDetails, shopFrameParams } =
  await import("../modules/shop/avatar-frame-shop")
const { Shop } = await import("../modules/shop/shop")
const { default: CaseOpening, CaseOpeningResult } =
  await import("../modules/shop/case-opening")
const item: ShopFrame = {
  frame: {
    ...defaultFrameAlignment,
    id: "0199f711-739b-7000-8000-000000000001",
    name: "Khung Avatar tên dài để kiểm tra hai dòng",
    assetUrl: "https://cdn.example.test/animated.webp",
    previewUrl: "https://cdn.example.test/preview.webp",
    animated: true,
    width: 318,
    height: 318,
  },
  code: "test-frame",
  description: "",
  topic: { id: "0199f711-739b-7000-8000-000000000002", name: "Discord" },
  rarity: "SR",
  price: "9007199254740993",
  stock: 10,
  frameVersion: 4,
  availability: "in_stock",
}
const attempt: PurchaseAttempt = {
  name: item.frame.name,
  input: {
    operationId: "0199f711-739b-7000-8000-000000000003",
    frameId: item.frame.id,
    expectedFrameVersion: item.frameVersion,
    expectedPrice: item.price,
  },
}
const receipt = {
  id: "0199f711-739b-7000-8000-000000000004",
  ...attempt.input,
  operationId: attempt.input.operationId,
  frame: {
    id: item.frame.id,
    name: item.frame.name,
    rarity: "SR",
    code: item.code,
  },
  price: item.price,
  balanceAfter: "1",
  transactionGroup: "0199f711-739b-7000-8000-000000000005",
  ledgerId: "0199f711-739b-7000-8000-000000000006",
  sequence: "1",
  createdAt: "2026-10-06T00:00:00Z",
}
const filters = { page: 1, q: "", rarity: "all" as const, topicId: "all" }
const chests: ChestCatalog = {
  data: [
    {
      id: "0199f711-739b-7000-8000-000000000007",
      kind: "common",
      topic: null,
      name: "Rương thường",
      version: 1,
      saleEnabled: false,
      retiredAt: null as unknown as ChestCatalog["data"][number]["retiredAt"],
      price: "5",
      pool: { R: 4, SR: 2, SSR: 1, total: 7, digest: "digest" },
      ready: true,
      blockReason: null,
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
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
const store = new Map<string, string>()
const storage: Storage = {
  get length() {
    return store.size
  },
  clear: () => store.clear(),
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, value)
  },
  removeItem: (key) => {
    store.delete(key)
  },
  key: (index) => [...store.keys()][index] ?? null,
}
const originalFetch = globalThis.fetch
const client = new QueryClient()
const errorResponse = (status: number, code: string) =>
  Response.json({ error: { code, message: "Raw server error" } }, { status })
try {
  const shopSource = readFileSync(
    new URL("../modules/shop/avatar-frame-shop.tsx", import.meta.url),
    "utf8"
  )
  assert.match(shopSource, /mutation\.isPending \? "Đang mua" : "Xác nhận"/)
  assert.match(shopSource, /aria-busy=\{mutation\.isPending\}/)
  assert.match(shopSource, /saved && attempt && !mutation\.isPending && !open/)
  assert.doesNotMatch(
    shopSource,
    /Kiểm tra\/thử lại|Thao tác sẽ tìm receipt|Không trừ coin lần hai/
  )
  assert.equal(
    purchaseErrorMessage(new TypeError("Lost response")),
    "Chưa xác định được kết quả mua. Vui lòng thử lại."
  )
  assert.equal(
    shopFramesPath(filters, false),
    "/v1/shop/avatar-frames?page=1&limit=20"
  )
  assert.equal(
    shopFramesPath(
      { page: -3, q: " x y ", rarity: "SSR", topicId: "none" },
      true
    ),
    "/v1/me/shop/avatar-frames?page=1&limit=20&q=x+y&rarity=SSR&topicId=none"
  )
  assert.equal(shopFrameParams.rarity.parse("invalid"), null)
  assert.equal(shopFrameParams.page.defaultValue, 1)
  assert.notDeepEqual(
    shopFramesKey(apiBaseUrl, null),
    shopFramesKey(apiBaseUrl, identity)
  )
  assert.notDeepEqual(
    shopFramesKey(apiBaseUrl, identity),
    shopFramesKey(apiBaseUrl, { ...identity, sessionId: "other" })
  )
  assert.notDeepEqual(
    shopFramesKey(apiBaseUrl, identity),
    shopFramesKey(apiBaseUrl, { ...identity, userId: "other" })
  )
  assert.equal(shopFramesOptions(apiBaseUrl, identity, filters).retry, false)
  assert.equal(shopFramesOptions(apiBaseUrl, identity, filters).gcTime, 0)
  assert.equal(shopFramesOptions(apiBaseUrl, null, filters).staleTime, 30_000)

  const key = purchaseStorageKey(apiBaseUrl, identity)
  assert.equal(readPendingPurchase(storage, key), null)
  savePendingPurchase(storage, key, attempt)
  assert.deepEqual(readPendingPurchase(storage, key), attempt)
  assert.equal(
    readPendingPurchase(
      storage,
      purchaseStorageKey(apiBaseUrl, { ...identity, userId: "other" })
    ),
    null
  )
  storage.setItem(key, "invalid json")
  assert.throws(() => readPendingPurchase(storage, key))
  storage.setItem(
    key,
    JSON.stringify({
      ...attempt,
      input: { ...attempt.input, expectedPrice: "-1" },
    })
  )
  assert.throws(() => readPendingPurchase(storage, key))
  savePendingPurchase(storage, key, attempt)
  const blockedStorage = {
    ...storage,
    setItem: () => {
      throw new Error("Storage denied")
    },
  }
  assert.throws(() => savePendingPurchase(blockedStorage, key, attempt))

  let requests: { path: string; method: string; body?: unknown }[] = []
  globalThis.fetch = (async (url: URL, init: RequestInit) => {
    requests.push({
      path: url.pathname,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    })
    assert.equal(init.credentials, "include")
    assert.equal(init.cache, "no-store")
    return Response.json({ data: receipt })
  }) as typeof fetch
  assert.equal(
    (await purchaseFrame(apiBaseUrl, attempt, false)).operationId,
    attempt.input.operationId
  )
  assert.deepEqual(requests[0], {
    path: "/v1/me/shop/purchases",
    method: "POST",
    body: attempt.input,
  })
  requests = []
  assert.equal(
    (await purchaseFrame(apiBaseUrl, attempt, true)).price,
    item.price
  )
  assert.deepEqual(requests, [
    {
      path: `/v1/me/shop/purchases/${attempt.input.operationId}`,
      method: "GET",
      body: undefined,
    },
  ])

  requests = []
  globalThis.fetch = (async (url: URL, init: RequestInit) => {
    requests.push({
      path: url.pathname,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    })
    return init.method === "POST"
      ? Response.json({ data: receipt })
      : errorResponse(404, "NOT_FOUND")
  }) as typeof fetch
  await purchaseFrame(apiBaseUrl, attempt, true)
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1]?.body, attempt.input)
  assert.deepEqual(readPendingPurchase(storage, key), attempt)

  // Lost response: retry reads the committed receipt, never POSTs a new operation.
  let posts = 0
  globalThis.fetch = (async (_url: URL, init: RequestInit) => {
    if (init.method === "POST") {
      posts++
      throw new TypeError("Lost response")
    }
    return Response.json({ data: receipt })
  }) as typeof fetch
  await assert.rejects(purchaseFrame(apiBaseUrl, attempt, false), (error) =>
    purchaseUncertain(error)
  )
  await purchaseFrame(apiBaseUrl, readPendingPurchase(storage, key)!, true)
  assert.equal(posts, 1)
  for (const status of [401, 403, 429, 503]) {
    posts = 0
    globalThis.fetch = (async (_url: URL, init: RequestInit) => {
      if (init.method === "POST") posts++
      return errorResponse(status, "UNAUTHORIZED")
    }) as typeof fetch
    await assert.rejects(purchaseFrame(apiBaseUrl, attempt, true), (error) =>
      purchaseUncertain(error)
    )
    assert.equal(posts, 0)
  }
  globalThis.fetch = (async () =>
    errorResponse(409, "SHOP_QUOTE_CHANGED")) as typeof fetch
  await assert.rejects(
    purchaseFrame(apiBaseUrl, attempt, false),
    (error) =>
      !purchaseUncertain(error) &&
      /xác nhận giá mới/.test(purchaseErrorMessage(error))
  )
  for (const code of [
    "SHOP_ALREADY_OWNED",
    "SHOP_SOLD_OUT",
    "COIN_INSUFFICIENT_BALANCE",
  ])
    assert.equal(
      purchaseUncertain(new AvatarFrameError(409, code, "Raw")),
      false
    )
  globalThis.fetch = (async () =>
    Response.json({
      data: { ...receipt, operationId: "other" },
    })) as typeof fetch
  await assert.rejects(
    purchaseFrame(apiBaseUrl, attempt, false),
    /does not match/
  )

  globalThis.fetch = (async (url: URL) =>
    Response.json(
      url.pathname.includes("topics")
        ? { data: [] }
        : {
            data: [item],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
            purchaseEnabled: true,
          }
    )) as typeof fetch
  await client.fetchQuery(shopTopicsOptions(apiBaseUrl))
  await client.fetchQuery(shopFramesOptions(apiBaseUrl, null, filters))
  const privateKey = shopFramesOptions(apiBaseUrl, identity, filters).queryKey
  client.setQueryData(privateKey, {
    balance: "500",
    data: [
      {
        ...item,
        owned: true,
        canPurchase: false,
        purchaseBlockReason: "already_owned",
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    purchaseEnabled: true,
  })
  const inventoryKey = [
    "account",
    apiBaseUrl,
    identity.userId,
    identity.sessionId,
    "avatar-frames",
  ]
  client.setQueryData(inventoryKey, { data: [] })
  assert.equal(shopWalletOptions(apiBaseUrl, null).enabled, false)
  assert.notDeepEqual(
    shopWalletOptions(apiBaseUrl, identity).queryKey,
    shopWalletOptions(apiBaseUrl, { ...identity, sessionId: "other" }).queryKey
  )
  const catalogRequests: string[] = []
  globalThis.fetch = (async (url: URL, init: RequestInit) => {
    catalogRequests.push(`${url.pathname}${url.search}`)
    assert.equal(init.method ?? "GET", "GET")
    assert.ok(init.signal)
    if (url.pathname.endsWith("coin-wallet"))
      return Response.json({ balance: item.price })
    if (url.pathname.endsWith("/pool"))
      return Response.json({
        data: [
          {
            frame: item.frame,
            code: item.code,
            rarity: item.rarity,
            topic: item.topic,
          },
        ],
        meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
        poolDigest: "digest",
      })
    return Response.json(chests)
  }) as typeof fetch
  const walletOptions = shopWalletOptions(apiBaseUrl, identity)
  assert.equal((await client.fetchQuery(walletOptions)).balance, item.price)
  await client.fetchQuery(shopChestsOptions(apiBaseUrl, 1))
  await client.fetchQuery(
    shopChestPoolOptions(apiBaseUrl, chests.data[0]!.id, 2, "SR")
  )
  assert.deepEqual(catalogRequests, [
    "/v1/me/coin-wallet",
    "/v1/shop/chests?page=1&limit=20",
    `/v1/shop/chests/${chests.data[0]!.id}/pool?page=2&limit=20&rarity=SR`,
  ])
  await refreshShopPurchase(client, apiBaseUrl, identity)
  assert.equal(client.getQueryState(privateKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(inventoryKey)?.isInvalidated, true)
  assert.equal(
    client.getQueryState(walletOptions.queryKey)?.isInvalidated,
    true
  )
  assert.equal(
    (client.getQueryData(privateKey) as { balance: string }).balance,
    "500"
  )

  const renderCard = (frame: ShopFrame, guest = false, disabled = false) =>
    renderToStaticMarkup(
      <ShopFrameCard
        item={frame}
        account={null}
        guest={guest}
        disabled={disabled}
        onView={() => {
          throw new Error("No dialog during rendering")
        }}
        onBuy={() => {
          throw new Error("No purchase during rendering")
        }}
      />
    )
  let markup = renderCard({ ...item, description: "Mô tả đầy đủ của sản phẩm" })
  assert.doesNotMatch(markup, /Mô tả đầy đủ của sản phẩm/)
  assert.doesNotMatch(markup, /href="\/login/)
  assert.match(markup, /9\.007\.199\.254\.740\.993 coin/)
  assert.match(markup, /data-slot="card-title"[^>]*class="[^"]*truncate/)
  assert.doesNotMatch(markup, /line-clamp-2/)
  assert.match(markup, /preview.webp/)
  assert.doesNotMatch(markup, /animated.webp/)
  assert.doesNotMatch(markup, /prefers-reduced-motion/)
  assert.match(markup, /lucide-user-round/)
  assert.match(markup, /Discord/)
  assert.match(markup, /Ảnh động/)
  assert.match(markup, /Còn 10/)
  assert.match(markup, /aria-label="Xem chi tiết Khung Avatar/)
  assert.match(markup, /aria-haspopup="dialog"/)
  assert.match(markup, /width:125%;height:125%/)
  assert.match(markup, /rounded-full/)
  assert.match(markup, /images\/suicao_coin.webp/)
  assert.ok(
    existsSync(new URL("../public/images/suicao_coin.webp", import.meta.url))
  )
  markup = renderCard({ ...item, frame: { ...item.frame, animated: false } })
  assert.doesNotMatch(markup, /Ảnh động/)
  markup = renderCard({ ...item, canPurchase: true })
  assert.match(markup, /aria-label="Mua ngay: Khung Avatar/)
  assert.doesNotMatch(markup, /<button\b[^>]*\sdisabled(?:=|\s|>)/)
  assert.equal((markup.match(/<button\b/g) ?? []).length, 2)
  assert.doesNotMatch(
    markup,
    /<button\b[^>]*>[\s\S]*?<button\b[\s\S]*?<\/button>[\s\S]*?<\/button>/
  )
  markup = renderCard(item, true)
  assert.match(
    markup,
    /href="\/login\?returnTo=%2Fshop%3Fcategory%3Davatar-frame"/
  )
  assert.match(markup, /Đăng nhập để mua/)
  markup = renderCard({ ...item, canPurchase: true }, false, true)
  assert.match(markup, /<button\b[^>]*\sdisabled=""[^>]*aria-label="Mua ngay:/)
  markup = renderCard({
    ...item,
    owned: true,
    canPurchase: false,
    purchaseBlockReason: "already_owned",
  })
  assert.match(markup, /<button\b[^>]*\sdisabled=""[^>]*aria-label="Đã sở hữu:/)
  assert.doesNotMatch(
    markup.match(/<button\b[^>]*aria-label="Xem chi tiết[^>]*>/)![0],
    /\sdisabled(?:=|\s|>)/
  )
  markup = renderCard({ ...item, stock: 0, availability: "sold_out" })
  assert.match(markup, /<button\b[^>]*\sdisabled=""[^>]*aria-label="Hết hàng:/)
  assert.doesNotMatch(
    markup.match(/<button\b[^>]*aria-label="Xem chi tiết[^>]*>/)![0],
    /\sdisabled(?:=|\s|>)/
  )
  assert.match(markup, /Còn 0/)
  const description = "Mô tả đầy đủ không bị rút gọn\nDòng thứ hai của sản phẩm"
  markup = renderToStaticMarkup(
    <ShopFrameDetails
      item={{ ...item, description, owned: true }}
      account={null}
    />
  )
  assert.match(markup, /animated.webp/)
  assert.match(markup, /prefers-reduced-motion: reduce/)
  assert.match(markup, /lucide-user-round/)
  assert.match(markup, /Đã sở hữu/)
  assert.match(markup, /Discord/)
  assert.match(markup, /<h3[^>]*>Khung Avatar tên dài/)
  assert.match(markup, /Còn 10/)
  assert.match(markup, /data-slot="separator"/)
  assert.doesNotMatch(markup, /Mã khung|test-frame|<dl/)
  assert.ok(markup.includes(description))
  assert.doesNotMatch(markup, /line-clamp/)
  assert.equal(
    framePurchaseLabel({ ...item, availability: "sold_out", stock: 0 }, false),
    "Hết hàng"
  )
  assert.equal(
    framePurchaseLabel(
      { ...item, canPurchase: false, purchaseBlockReason: "insufficient_coin" },
      false
    ),
    "Không đủ coin"
  )
  assert.equal(
    framePurchaseLabel({ ...item, canPurchase: true }, false),
    "Mua ngay"
  )
  markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AvatarFrameShop />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
  assert.match(markup, /Tìm tên khung trong Shop/)
  assert.match(markup, /Lọc độ hiếm/)
  assert.match(markup, /Lọc chủ đề/)
  assert.match(markup, /Khung Avatar tên dài/)
  assert.doesNotMatch(markup, /animated.webp/)
  const pagedFilters = {
    ...filters,
    page: 4,
    q: "Khung & tên",
    rarity: "SSR" as const,
    topicId: item.topic!.id,
  }
  client.setQueryData(
    shopFramesOptions(apiBaseUrl, null, pagedFilters).queryKey,
    {
      data: [item],
      meta: { page: 4, limit: 20, total: 200, totalPages: 10 },
      purchaseEnabled: true,
    }
  )
  let onPageUrlUpdate: (params: URLSearchParams) => void = () => {}
  markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        searchParams={{ ...pagedFilters, page: "4", category: "avatar-frame" }}
        onUrlUpdate={({ searchParams }) => onPageUrlUpdate(searchParams)}
      >
        <AvatarFrameShop />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
  assert.match(markup, /data-slot="pagination"/)
  assert.match(markup, /data-slot="pagination-ellipsis"/)
  assert.deepEqual(
    [...markup.matchAll(/aria-label="Đến trang (\d+)"/g)].map((match) =>
      Number(match[1])
    ),
    [1, 2, 3, 4, 5, 10]
  )
  const nextPageTag = markup.match(
    /<a\b(?=[^>]*aria-label="Đến trang 5")[^>]*>/
  )![0]
  const href = nextPageTag.match(/href="([^"]+)"/)![1]!.replaceAll("&amp;", "&")
  const pageUrl = new URL(href, "https://shop.example.test")
  assert.equal(pageUrl.pathname, "/shop")
  assert.equal(pageUrl.searchParams.get("category"), "avatar-frame")
  assert.equal(pageUrl.searchParams.get("page"), "5")
  assert.equal(pageUrl.searchParams.get("q"), pagedFilters.q)
  assert.equal(pageUrl.searchParams.get("rarity"), "SSR")
  assert.equal(pageUrl.searchParams.get("topicId"), pagedFilters.topicId)
  // Exercise real pagination handlers -> nuqs URL state -> the page query.
  const controls = paginationCapture
    .element!.props.children.props.children.flat()
    .map(
      (node: { props: { children: { props: Record<string, unknown> } } }) =>
        node.props.children.props
    )
  const fetchedPages: string[] = []
  globalThis.fetch = (async (url: URL) => {
    const page = url.searchParams.get("page")!
    fetchedPages.push(page)
    assert.equal(url.searchParams.get("q"), pagedFilters.q)
    assert.equal(url.searchParams.get("rarity"), pagedFilters.rarity)
    assert.equal(url.searchParams.get("topicId"), pagedFilters.topicId)
    return Response.json({
      data: [
        { ...item, frame: { ...item.frame, name: `Khung trang ${page}` } },
      ],
      meta: { page: Number(page), limit: 20, total: 200, totalPages: 10 },
      purchaseEnabled: true,
    })
  }) as typeof fetch
  for (const [label, page] of [
    ["Đến trang trước", 3],
    ["Đến trang 5", 5],
    ["Đến trang sau", 5],
    ["Đến trang 1", 1],
  ] as const) {
    const link = controls.find(
      (control: Record<string, unknown>) => control["aria-label"] === label
    )!.render as {
      props: { onNavigate: (event: { preventDefault: () => void }) => void }
    }
    assert.equal(typeof link.props.onNavigate, "function")
    const urlUpdate = new Promise<URLSearchParams>((resolve) => {
      onPageUrlUpdate = resolve
    })
    let prevented = false
    link.props.onNavigate({
      preventDefault: () => {
        prevented = true
      },
    })
    assert.equal(prevented, true)
    const params = await urlUpdate
    assert.equal(params.get("category"), "avatar-frame")
    assert.equal(params.get("page"), page === 1 ? null : String(page))
    assert.equal(params.get("q"), pagedFilters.q)
    assert.equal(params.get("rarity"), pagedFilters.rarity)
    assert.equal(params.get("topicId"), pagedFilters.topicId)
    const result = await client.fetchQuery(
      shopFramesOptions(apiBaseUrl, null, { ...pagedFilters, page })
    )
    assert.equal(result.data[0]?.frame.name, `Khung trang ${page}`)
  }
  assert.deepEqual(fetchedPages, ["3", "5", "1"])
  // Category navigation resets frame-only filters instead of carrying page 4 into boxes.
  let categoryLink: ReturnType<typeof ShopCategoryLink> | undefined
  function CategoryNavigationProbe() {
    categoryLink = ShopCategoryLink({ category: "gacha", children: "Hộp" })
    return categoryLink
  }
  renderToStaticMarkup(
    <NuqsTestingAdapter
      searchParams={{ ...pagedFilters, page: "4", category: "avatar-frame" }}
      onUrlUpdate={({ searchParams }) => onPageUrlUpdate(searchParams)}
    >
      <CategoryNavigationProbe />
    </NuqsTestingAdapter>
  )
  const categoryUpdate = new Promise<URLSearchParams>((resolve) => {
    onPageUrlUpdate = resolve
  })
  let categoryPrevented = false
  categoryLink!.props.onNavigate({
    preventDefault: () => {
      categoryPrevented = true
    },
  })
  assert.equal(categoryPrevented, true)
  assert.equal((await categoryUpdate).toString(), "category=gacha")

  const renderShop = (category: string) =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={{ category }}>
          <Shop />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    )
  for (const category of ["all", "avatar-frame", "gacha", "invalid"]) {
    markup = renderShop(category)
    assert.match(markup, /Đăng nhập để xem số dư/)
    assert.equal(
      markup.includes('aria-label="Khung Avatar"'),
      category !== "gacha"
    )
    assert.equal(
      markup.includes('aria-label="Hộp Khung Avatar"'),
      category !== "avatar-frame"
    )
    assert.equal(
      markup.includes("Tìm tên khung trong Shop"),
      category === "avatar-frame"
    )
    if (category !== "avatar-frame") {
      assert.match(markup, /normal-chest.png/)
      assert.match(markup, /Hộp Khung Avatar ngẫu nhiên/)
      assert.match(markup, /Xem khung/)
      assert.match(markup, /Tạm đóng/)
      assert.doesNotMatch(markup, /Thử hiệu ứng|Mở thử|Bản xem thử/)
    }
    assert.doesNotMatch(markup, /animated.webp/)
  }
  markup = renderToStaticMarkup(
    <CaseOpening
      receipt={gachaReceipt}
      account={null}
      samples={[]}
      winner={{
        id: gachaReceipt.frame.id,
        name: gachaReceipt.frame.name,
        rarity: gachaReceipt.frame.rarity,
        frame: { ...item.frame, id: gachaReceipt.frame.id },
        topic: item.topic,
      }}
    />
  )
  assert.match(markup, /Đang mở hộp/)
  assert.match(markup, /data-phase="waiting"/)
  assert.match(markup, /preview.webp/)
  assert.match(markup, /Bỏ qua/)
  assert.match(markup, /Khung từ máy chủ/)
  assert.doesNotMatch(markup, /animated.webp|XEM THỬ|Mở thử|Bản xem thử/)
  markup = renderToStaticMarkup(
    <CaseOpening
      receipt={null}
      winner={null}
      account={null}
      samples={[
        {
          id: item.frame.id,
          name: item.frame.name,
          frame: item.frame,
          rarity: item.rarity,
          topic: item.topic,
        },
      ]}
    />
  )
  assert.match(markup, /gacha-case-cruising/)
  assert.match(markup, /Đang mở hộp/)
  assert.match(markup, /preview.webp/)
  assert.doesNotMatch(
    markup,
    /BẠN NHẬN ĐƯỢC|Khung đã vào kho|hoàn .* coin|data-slot="spinner"/
  )
  markup = renderToStaticMarkup(
    <CaseOpening
      receipt={gachaReceipt}
      account={null}
      samples={[]}
      winner={{ ...gachaReceipt.frame, frame: null, topic: null }}
    />
  )
  assert.match(markup, /Khung từ máy chủ/)
  assert.match(markup, /lucide-frame/)
  markup = renderToStaticMarkup(
    <CaseOpeningResult
      receipt={gachaReceipt}
      account={null}
      winner={{ ...gachaReceipt.frame, frame: item.frame, topic: null }}
    />
  )
  assert.match(markup, /Khung đã sở hữu — hoàn 20 coin/)
  assert.match(markup, /animated.webp/)
  assert.match(markup, /Khung từ máy chủ/)
  markup = renderToStaticMarkup(
    <CaseOpeningResult
      receipt={{ ...gachaReceipt, duplicate: false, refund: "0" }}
      account={null}
      winner={{ ...gachaReceipt.frame, frame: null, topic: null }}
    />
  )
  assert.match(markup, /Khung đã vào kho của bạn; chưa tự động trang bị/)
  assert.doesNotMatch(markup, /hoàn 0 coin/)
  const { ShopChestCard } = await import("../modules/shop/gacha-catalog")
  const renderChest = (
    props: Partial<Parameters<typeof ShopChestCard>[0]> = {}
  ) =>
    renderToStaticMarkup(
      <ShopChestCard
        chest={{ ...chests.data[0]!, saleEnabled: true }}
        guest={false}
        disabled={false}
        rollEnabled
        onBuy={() => {
          throw new Error("No purchase during render")
        }}
        onView={() => {}}
        {...props}
      />
    )
  assert.match(renderChest(), /Mua hộp/)
  assert.match(
    renderChest({ guest: true }),
    /href="\/login\?returnTo=%2Fshop%3Fcategory%3Dgacha"/
  )
  assert.match(renderChest({ rollEnabled: false }), /disabled=""[^>]*>Tạm đóng/)
  assert.match(
    renderChest({ chest: chests.data[0]! }),
    /disabled=""[^>]*>Chưa mở bán/
  )
  assert.match(
    renderChest({
      chest: { ...chests.data[0]!, saleEnabled: true, ready: false },
    }),
    /disabled=""[^>]*>Chưa khả dụng/
  )
  const loadingClient = new QueryClient()
  try {
    markup = renderToStaticMarkup(
      <QueryClientProvider client={loadingClient}>
        <NuqsTestingAdapter>
          <AvatarFrameShop />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    )
    assert.match(
      markup,
      /aria-label="Đang tải khung trong Shop" aria-busy="true"/
    )
    assert.match(markup, /data-slot="skeleton"/)
    assert.match(markup, /motion-reduce:animate-none/)
    assert.equal([...markup.matchAll(/data-slot="card"/g)].length, 20)
    assert.doesNotMatch(markup, /animated.webp|data-slot="spinner"/)
  } finally {
    loadingClient.clear()
  }
  authenticated = true
  client.setQueryData(walletOptions.queryKey, { balance: item.price })
  markup = renderShop("gacha")
  assert.match(markup, /9\.007\.199\.254\.740\.993 coin/)
  assert.doesNotMatch(markup, /Đăng nhập để xem số dư/)
  markup = renderShop("avatar-frame")
  assert.match(markup, /Đã sở hữu/)
  assert.doesNotMatch(markup, /Kho khung/)
  assert.doesNotMatch(markup, /animated.webp/)
  assert.equal(posts, 0)
  console.log("Avatar frame Shop checks passed")
} finally {
  client.clear()
  globalThis.fetch = originalFetch
}
