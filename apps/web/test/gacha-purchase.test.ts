import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query"
import { AvatarFrameError } from "../modules/avatar-frames/admin-api"
import { refreshShopPurchase } from "../modules/shop/api"
import {
  gachaBlockMessage,
  gachaErrorMessage,
  gachaHistoryChestName,
  gachaHistoryOptions,
  gachaStorageKey,
  gachaUncertain,
  personalChestOptions,
  readPendingGacha,
  rollChest,
  savePendingGacha,
  type GachaAttempt,
  type GachaReceipt,
} from "../modules/shop/gacha-api"

const api = "https://api.example.test"
const identity = { userId: "user-a", sessionId: "session-a" }
const id = (suffix: number) =>
  `0199f711-739b-7000-8000-${String(suffix).padStart(12, "0")}`
const attempt: GachaAttempt = {
  name: "Hộp Khung Avatar ngẫu nhiên",
  input: {
    operationId: id(1),
    chestId: id(2),
    expectedChestVersion: 3,
    expectedRuleVersion: 1,
    expectedPoolDigest: "a".repeat(64),
    expectedPrice: "5",
  },
}
export const gachaReceipt: GachaReceipt = {
  id: id(3),
  operationId: id(1),
  chest: {
    id: id(2),
    kind: "common",
    name: "Rương thường",
    version: 3,
    topicId: null as unknown as string,
  },
  frame: { id: id(4), code: "frame", name: "Khung từ máy chủ", rarity: "SSR" },
  price: "5",
  ruleVersion: 1,
  poolDigest: "a".repeat(64),
  duplicate: true,
  refund: "20",
  pity: {
    before: { sinceSr: 9, sinceSsr: 49 },
    after: { sinceSr: 0, sinceSsr: 0 },
    rollSequence: "50",
  },
  transactionGroup: id(5),
  debitLedgerId: id(6),
  refundLedgerId: id(7),
  sequence: "2",
  balanceAfter: "9007199254740993",
  createdAt: "2026-10-09T00:00:00Z",
}
const values = new Map<string, string>()
const storage: Storage = {
  get length() {
    return values.size
  },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => {
    values.set(key, value)
  },
  removeItem: (key) => {
    values.delete(key)
  },
  key: (index) => [...values.keys()][index] ?? null,
}
const key = gachaStorageKey(api, identity)
const purchaseSource = readFileSync(
  new URL("../modules/shop/gacha-purchase.tsx", import.meta.url),
  "utf8"
)
assert.equal((purchaseSource.match(/<Dialog\s/g) ?? []).length, 2)
assert.match(purchaseSource, /open && !opening && !receipt/)
assert.match(purchaseSource, /open && \(opening \|\| receipt\)/)
assert.doesNotMatch(purchaseSource, /Số dư:|Bảo hiểm SR|Tỷ lệ cơ bản|<Image/)
const catalogSource = readFileSync(
  new URL("../modules/shop/gacha-catalog.tsx", import.meta.url),
  "utf8"
)
assert.match(catalogSource, /historyOpen && identity &&/)
assert.match(catalogSource, /!overview && identity && \(\s*<Button/)
const historySource = readFileSync(
  new URL("../modules/shop/gacha-history.tsx", import.meta.url),
  "utf8"
)
assert.deepEqual(
  [...historySource.matchAll(/<TableHead>(.*?)<\/TableHead>/g)].map(
    (match) => match[1]
  ),
  ["Thời gian", "Loại hộp", "Kết quả"]
)
assert.match(historySource, /formatVietnamDateTimeInline\(roll.createdAt\)/)
assert.match(historySource, /roll\.duplicate &&/)
assert.match(historySource, /coinLabel\(roll.refund\)/)
assert.equal(
  gachaHistoryChestName(gachaReceipt.chest),
  "Hộp Khung Avatar ngẫu nhiên"
)
assert.equal(
  gachaHistoryChestName({
    ...gachaReceipt.chest,
    kind: "topic",
    name: "Rương Discord",
  }),
  "Hộp Khung Avatar Discord"
)
assert.equal(readPendingGacha(storage, key), null)
savePendingGacha(storage, key, attempt)
assert.deepEqual(readPendingGacha(storage, key), attempt)
for (const other of [
  { ...identity, userId: "other" },
  { ...identity, sessionId: "other" },
])
  assert.equal(readPendingGacha(storage, gachaStorageKey(api, other)), null)
assert.equal(
  readPendingGacha(storage, gachaStorageKey("https://other.test", identity)),
  null
)
for (const input of [
  { ...attempt.input, expectedPrice: "-1" },
  { ...attempt.input, expectedPrice: "9223372036854775808" },
  { ...attempt.input, expectedPrice: "0" },
  { ...attempt.input, expectedPrice: "05" },
  { ...attempt.input, operationId: "bad" },
  { ...attempt.input, expectedPoolDigest: "bad" },
  { ...attempt.input, expectedChestVersion: 0 },
  { ...attempt.input, expectedRuleVersion: 1.5 },
  { ...attempt.input, frameId: id(9) },
])
  assert.throws(() => savePendingGacha(storage, key, { ...attempt, input }))
assert.throws(() =>
  savePendingGacha(
    {
      ...storage,
      setItem: () => {
        throw new Error("Storage blocked")
      },
    },
    key,
    attempt
  )
)
storage.setItem(key, "bad json")
assert.throws(() => readPendingGacha(storage, key))
savePendingGacha(storage, key, attempt)

const originalFetch = globalThis.fetch
const responseError = (status: number, code: string) =>
  Response.json({ error: { code, message: "raw" } }, { status })
let requests: { path: string; method: string; body: unknown }[] = []
const capture = (url: URL, init: RequestInit) => {
  assert.equal(init.credentials, "include")
  assert.equal(init.cache, "no-store")
  requests.push({
    path: url.pathname,
    method: init.method ?? "GET",
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  })
}
try {
  globalThis.fetch = (async (url: URL, init: RequestInit) => {
    capture(url, init)
    return Response.json({ data: gachaReceipt })
  }) as typeof fetch
  assert.deepEqual(await rollChest(api, attempt, false), gachaReceipt)
  assert.deepEqual(requests, [
    { path: "/v1/me/shop/gacha-rolls", method: "POST", body: attempt.input },
  ])
  requests = []
  await rollChest(api, attempt, true)
  assert.deepEqual(requests, [
    {
      path: `/v1/me/shop/gacha-rolls/${id(1)}`,
      method: "GET",
      body: undefined,
    },
  ])

  requests = []
  globalThis.fetch = (async (url: URL, init: RequestInit) => {
    capture(url, init)
    return init.method === "POST"
      ? Response.json({ data: gachaReceipt })
      : responseError(404, "NOT_FOUND")
  }) as typeof fetch
  await rollChest(api, attempt, true)
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1]?.body, attempt.input)

  // The server may commit even if the response is lost; recovery must only read its receipt.
  requests = []
  globalThis.fetch = (async (url: URL, init: RequestInit) => {
    capture(url, init)
    if (init.method === "POST")
      throw new TypeError("Lost response after commit")
    return Response.json({ data: gachaReceipt })
  }) as typeof fetch
  await assert.rejects(rollChest(api, attempt, false), gachaUncertain)
  assert.equal(
    (await rollChest(api, readPendingGacha(storage, key)!, true)).refund,
    "20"
  )
  assert.deepEqual(
    requests.map((item) => item.method),
    ["POST", "GET"]
  )

  for (const [status, code] of [
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [429, "RATE_LIMITED"],
    [503, "GACHA_DISABLED"],
    [404, "UNKNOWN"],
  ] as const) {
    requests = []
    globalThis.fetch = (async (url: URL, init: RequestInit) => {
      capture(url, init)
      return responseError(status, code)
    }) as typeof fetch
    await assert.rejects(rollChest(api, attempt, true), gachaUncertain)
    assert.deepEqual(
      requests.map((item) => item.method),
      ["GET"]
    )
    assert.deepEqual(readPendingGacha(storage, key), attempt)
  }
  for (const code of [
    "GACHA_QUOTE_CHANGED",
    "GACHA_CHEST_CLOSED",
    "GACHA_POOL_UNAVAILABLE",
    "COIN_INSUFFICIENT_BALANCE",
  ]) {
    globalThis.fetch = (async () => responseError(409, code)) as typeof fetch
    await assert.rejects(
      rollChest(api, attempt, false),
      (error) => !gachaUncertain(error)
    )
  }
  assert.ok(
    gachaUncertain(
      new AvatarFrameError(409, "GACHA_IDEMPOTENCY_CONFLICT", "raw")
    )
  )
  assert.match(
    gachaErrorMessage(new AvatarFrameError(409, "GACHA_QUOTE_CHANGED", "raw")),
    /xác nhận giá mới/
  )
  assert.match(gachaBlockMessage("insufficient_coin"), /không đủ/)

  for (const invalid of [
    { ...gachaReceipt, operationId: id(99) },
    { ...gachaReceipt, chest: { ...gachaReceipt.chest, id: id(99) } },
    { ...gachaReceipt, chest: { ...gachaReceipt.chest, version: 4 } },
    { ...gachaReceipt, price: "10" },
    { ...gachaReceipt, poolDigest: "b".repeat(64) },
    { ...gachaReceipt, ruleVersion: 2 },
    { ...gachaReceipt, frame: null },
    { ...gachaReceipt, refund: "invalid" },
    { ...gachaReceipt, duplicate: false },
  ]) {
    globalThis.fetch = (async () =>
      Response.json({ data: invalid })) as typeof fetch
    await assert.rejects(rollChest(api, attempt, false), gachaUncertain)
  }
  globalThis.fetch = (async () =>
    Response.json({
      data: { ...gachaReceipt, duplicate: false, refund: "0" },
    })) as typeof fetch
  assert.equal((await rollChest(api, attempt, false)).duplicate, false)

  const options = personalChestOptions(api, identity, id(2))
  assert.equal(options.retry, false)
  assert.equal(options.gcTime, 0)
  assert.notDeepEqual(
    options.queryKey,
    personalChestOptions(api, { ...identity, sessionId: "other" }, id(2))
      .queryKey
  )
  const client = new QueryClient()
  try {
    globalThis.fetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.pathname, `/v1/me/shop/chests/${id(2)}`)
      assert.equal(init.method ?? "GET", "GET")
      assert.ok(init.signal)
      return Response.json({
        canRoll: false,
        rollBlockReason: "insufficient_coin",
      })
    }) as typeof fetch
    assert.equal((await client.fetchQuery(options)).canRoll, false)
  } finally {
    client.clear()
  }
  const historyOptions = gachaHistoryOptions(api, identity)
  assert.equal(historyOptions.retry, false)
  assert.equal(historyOptions.gcTime, 0)
  assert.equal(historyOptions.staleTime, 0)
  for (const [otherApi, otherIdentity] of [
    ["https://other.test", identity],
    [api, { ...identity, userId: "other" }],
    [api, { ...identity, sessionId: "other" }],
  ] as const)
    assert.notDeepEqual(
      historyOptions.queryKey,
      gachaHistoryOptions(otherApi, otherIdentity).queryKey
    )
  const historyClient = new QueryClient()
  const observer = new InfiniteQueryObserver(historyClient, historyOptions)
  try {
    const cursors: (string | null)[] = []
    globalThis.fetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.pathname, "/v1/me/shop/gacha-rolls")
      assert.equal(url.searchParams.get("limit"), "20")
      assert.equal(init.method ?? "GET", "GET")
      assert.equal(init.credentials, "include")
      assert.equal(init.cache, "no-store")
      assert.ok(init.signal)
      const cursor = url.searchParams.get("cursor")
      cursors.push(cursor)
      return Response.json({
        data: [
          cursor
            ? { ...gachaReceipt, operationId: id(8), sequence: "1" }
            : gachaReceipt,
        ],
        meta: { limit: 20, nextCursor: cursor ? null : "2" },
      })
    }) as typeof fetch
    assert.deepEqual(cursors, [])
    await observer.refetch()
    assert.equal(observer.getCurrentResult().hasNextPage, true)
    const next = await observer.fetchNextPage()
    assert.deepEqual(cursors, [null, "2"])
    assert.equal(next.hasNextPage, false)
    assert.deepEqual(
      next.data?.pages.flatMap((page) =>
        page.data.map((roll) => roll.sequence)
      ),
      ["2", "1"]
    )
    await refreshShopPurchase(historyClient, api, identity)
    assert.equal(
      historyClient.getQueryState(historyOptions.queryKey)?.isInvalidated,
      true
    )
    globalThis.fetch = (async () =>
      responseError(401, "UNAUTHORIZED")) as typeof fetch
    assert.equal((await observer.refetch()).isError, true)
  } finally {
    observer.destroy()
    historyClient.clear()
  }
  console.log(
    "Gacha purchase/recovery, separate dialogs and private cursor history checks passed"
  )
} finally {
  globalThis.fetch = originalFetch
}
