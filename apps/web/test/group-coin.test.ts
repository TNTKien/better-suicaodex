import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { components } from "../src/lib/generated/api"
import { AvatarFrameError } from "../modules/avatar-frames/admin-api"
import {
  canManageGroupCoin,
  coinTransferStorageKey,
  coinTransferUncertain,
  groupCoinErrorMessage,
  groupCoinOptions,
  isCoinTransferInput,
  readPendingCoinTransfer,
  refreshGroupCoin,
  savePendingCoinTransfer,
  transferGroupCoin,
  validateCoinTransfer,
  type CoinTransferAttempt,
} from "../modules/groups/coin-api"
import { GroupCoinWallet } from "../modules/groups/coin-wallet"
import { MembershipList } from "../modules/groups/workspace"

const apiBaseUrl = "https://api.example.test"
const identity = { userId: "leader", sessionId: "session-a" }
const groupId = "0199f711-739b-7000-8000-000000000001"
const current: NonNullable<components["schemas"]["MyGroup"]["data"]> = {
  group: {
    id: groupId,
    name: "Nhóm dịch",
    slug: "nhom-dich",
    approvalStatus: "approved",
    publicationState: "published",
    inactive: false,
    avatarUrl: null,
    bannerUrl: null,
    description: null,
    links: {},
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-09T00:00:00Z",
  },
  membership: {
    status: "approved",
    role: "leader",
    name: "Leader",
    userId: identity.userId,
    permissions: {
      canAddManga: true,
      canEditManga: true,
      canDeleteManga: true,
      canAddChapter: true,
      canEditChapter: true,
      canDeleteChapter: true,
    },
    avatarFrame: null,
    createdAt: "2026-10-09T00:00:00Z",
  },
}
assert.equal(canManageGroupCoin(current, false), true)
assert.equal(
  canManageGroupCoin(
    { ...current, membership: { ...current.membership, role: "member" } },
    false
  ),
  false
)
assert.equal(
  canManageGroupCoin(
    { ...current, membership: { ...current.membership, role: "member" } },
    true
  ),
  true
)
for (const status of ["pending", "rejected"] as const) {
  assert.equal(
    canManageGroupCoin(
      { ...current, membership: { ...current.membership, status } },
      true
    ),
    false
  )
  assert.equal(
    canManageGroupCoin(
      { ...current, group: { ...current.group, approvalStatus: status } },
      true
    ),
    false
  )
}
assert.equal(
  canManageGroupCoin(
    {
      ...current,
      group: { ...current.group, publicationState: "hidden" },
    },
    true
  ),
  false
)
assert.equal(
  canManageGroupCoin(
    { ...current, group: { ...current.group, slug: "system" } },
    true
  ),
  false
)
assert.equal(
  canManageGroupCoin(
    { ...current, group: { ...current.group, inactive: true } },
    false
  ),
  true
)

for (const value of ["", "0", "10", "9007199254740993", "9223372036854775807"])
  assert.equal(isCoinTransferInput(value), true)
for (const value of [
  "abc",
  "10coin",
  "-1",
  "+1",
  "1.5",
  "1e3",
  "1,000",
  " 10 ",
  "10\n",
  "１２",
  "12345678901234567890",
])
  assert.equal(isCoinTransferInput(value), false)

assert.equal(validateCoinTransfer("1", "10"), null)
assert.equal(validateCoinTransfer("9007199254740993", "9007199254740993"), null)
assert.equal(
  validateCoinTransfer("9223372036854775807", "9223372036854775807"),
  null
)
for (const invalid of [
  "",
  "0",
  "-1",
  "1.5",
  "01",
  "1e3",
  "abc",
  "9223372036854775808",
  "12345678901234567890",
])
  assert.ok(validateCoinTransfer(invalid, "9223372036854775807"))
assert.match(validateCoinTransfer("11", "10")!, /không đủ/)

const attempt: CoinTransferAttempt = {
  name: "Member",
  input: {
    recipientUserId: "member",
    amount: "9007199254740993",
    operationId: "0199f711-739b-7000-8000-000000000002",
  },
}
const entries = new Map<string, string>()
const storage: Storage = {
  get length() {
    return entries.size
  },
  getItem: (key) => entries.get(key) ?? null,
  setItem: (key, value) => {
    entries.set(key, value)
  },
  removeItem: (key) => {
    entries.delete(key)
  },
  clear: () => {
    entries.clear()
  },
  key: (index) => [...entries.keys()][index] ?? null,
}
const key = coinTransferStorageKey(apiBaseUrl, identity, groupId)
assert.equal(readPendingCoinTransfer(storage, key), null)
savePendingCoinTransfer(storage, key, attempt)
assert.deepEqual(readPendingCoinTransfer(storage, key), attempt)
for (const other of [
  coinTransferStorageKey(apiBaseUrl, { ...identity, userId: "other" }, groupId),
  coinTransferStorageKey(
    apiBaseUrl,
    { ...identity, sessionId: "other" },
    groupId
  ),
  coinTransferStorageKey(apiBaseUrl, identity, "other"),
  coinTransferStorageKey("https://other.test", identity, groupId),
])
  assert.notEqual(key, other)
assert.throws(() =>
  savePendingCoinTransfer(storage, key, {
    ...attempt,
    input: { ...attempt.input, amount: "0" },
  })
)
assert.deepEqual(readPendingCoinTransfer(storage, key), attempt)
storage.setItem(key, "bad-json")
assert.throws(() => readPendingCoinTransfer(storage, key))
assert.throws(() =>
  savePendingCoinTransfer(
    {
      ...storage,
      setItem: () => {
        throw new Error("Storage denied")
      },
    },
    key,
    attempt
  )
)

assert.equal(coinTransferUncertain(new Error("Lost response")), true)
assert.equal(
  coinTransferUncertain(new AvatarFrameError(500, "UPSTREAM_ERROR", "")),
  true
)
assert.equal(
  coinTransferUncertain(
    new AvatarFrameError(409, "COIN_IDEMPOTENCY_CONFLICT", "")
  ),
  true
)
assert.equal(
  coinTransferUncertain(
    new AvatarFrameError(409, "COIN_INSUFFICIENT_BALANCE", "")
  ),
  false
)
for (const status of [401, 403, 429]) {
  const error = new AvatarFrameError(status, "DENIED", "")
  assert.equal(coinTransferUncertain(error), false)
  assert.equal(coinTransferUncertain(error, true), true)
}
assert.match(
  groupCoinErrorMessage(
    new AvatarFrameError(403, "COIN_RECIPIENT_NOT_MEMBER", "")
  ),
  /thành viên đã duyệt/
)
assert.match(
  groupCoinErrorMessage(new AvatarFrameError(503, "COIN_DISABLED", "")),
  /tạm tắt/
)

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})
const options = groupCoinOptions(apiBaseUrl, identity, groupId)
client.setQueryData(options.queryKey, { balance: "9007199254740993" })
const markup = renderToStaticMarkup(
  createElement(
    QueryClientProvider,
    { client },
    createElement(MembershipList, {
      apiBaseUrl,
      userId: identity.userId,
      groupId,
      status: "approved",
      busy: false,
      coinWallet: createElement(GroupCoinWallet, {
        apiBaseUrl,
        identity,
        groupId,
        recipient: null,
        onClose: () => {},
        disabled: false,
      }),
    })
  )
)
assert.match(markup, /Coin nhóm/)
assert.match(markup, /9\.007\.199\.254\.740\.993 coin/)
assert.match(markup, /Danh sách thành viên/)
assert.equal((markup.match(/data-slot="card-header"/g) ?? []).length, 1)
assert.doesNotMatch(markup, /Thu gọn hoặc mở rộng coin nhóm/)
assert.match(
  markup.slice(
    markup.indexOf('data-slot="card-header"'),
    markup.indexOf('data-slot="card-action"')
  ),
  /Coin nhóm:/
)
assert.equal(options.retry, false)
assert.equal(options.gcTime, 0)
assert.notDeepEqual(
  options.queryKey,
  groupCoinOptions(apiBaseUrl, { ...identity, sessionId: "other" }, groupId)
    .queryKey
)

const personalKey = [
  "account",
  apiBaseUrl,
  identity.userId,
  identity.sessionId,
  "me",
]
const recipientKey = [
  "account",
  apiBaseUrl,
  attempt.input.recipientUserId,
  "me",
]
const unrelatedKey = ["account", apiBaseUrl, "other", "me"]
for (const queryKey of [personalKey, recipientKey, unrelatedKey])
  client.setQueryData(queryKey, { balance: "1" })
await refreshGroupCoin(
  client,
  apiBaseUrl,
  identity,
  attempt.input.recipientUserId
)
assert.equal(client.getQueryState(options.queryKey)?.isInvalidated, true)
assert.equal(client.getQueryState(personalKey)?.isInvalidated, true)
assert.equal(client.getQueryState(recipientKey)?.isInvalidated, true)
assert.equal(client.getQueryState(unrelatedKey)?.isInvalidated, false)
client.clear()

const originalFetch = globalThis.fetch
const receipt = {
  ...attempt.input,
  groupId,
  transactionGroup: "0199f711-739b-7000-8000-000000000003",
  balanceAfter: "10",
  createdAt: "2026-10-09T00:00:00Z",
}
const requests: string[] = []
try {
  globalThis.fetch = (async (url, init) => {
    assert.equal(
      String(url),
      `${apiBaseUrl}/v1/contribution/groups/${groupId}/coin-wallet/transfers`
    )
    assert.equal(init?.credentials, "include")
    assert.equal(init?.method, "POST")
    requests.push(String(init.body))
    if (requests.length === 1) throw new Error("Response lost after commit")
    return Response.json(receipt)
  }) as typeof fetch
  await assert.rejects(transferGroupCoin(apiBaseUrl, groupId, attempt))
  assert.deepEqual(
    await transferGroupCoin(apiBaseUrl, groupId, attempt),
    receipt
  )
  assert.equal(requests[0], requests[1])
  globalThis.fetch = (async () =>
    Response.json({ ...receipt, amount: "1" })) as typeof fetch
  await assert.rejects(
    transferGroupCoin(apiBaseUrl, groupId, attempt),
    /does not match/
  )
  await assert.rejects(
    transferGroupCoin(apiBaseUrl, groupId, {
      ...attempt,
      input: { ...attempt.input, amount: "0" },
    })
  )
} finally {
  globalThis.fetch = originalFetch
}
console.log("Group coin checks passed")
