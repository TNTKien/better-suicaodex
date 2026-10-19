import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { z } from "zod"

import type { components } from "@/src/lib/generated/api"
import type { FrameIdentity } from "@/modules/avatar-frames/account-api"
import {
  AvatarFrameError,
  avatarFrameRequest,
} from "@/modules/avatar-frames/admin-api"

type MyGroup = NonNullable<components["schemas"]["MyGroup"]["data"]>
const positiveAmount = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .pipe(z.string().refine((value) => BigInt(value) <= 9223372036854775807n))
const attemptSchema = z
  .object({
    name: z.string().min(1).max(800),
    input: z
      .object({
        recipientUserId: z.string().min(1).max(128),
        amount: positiveAmount,
        operationId: z.uuid(),
      })
      .strict(),
  })
  .strict()
export type CoinTransferAttempt = z.infer<typeof attemptSchema>

export function canManageGroupCoin(current: MyGroup, isAdmin: boolean) {
  return (
    current.group.approvalStatus === "approved" &&
    current.group.publicationState === "published" &&
    current.group.slug !== "system" &&
    current.membership.status === "approved" &&
    (current.membership.role === "leader" || isAdmin)
  )
}

export function groupCoinOptions(
  apiBaseUrl: string,
  identity: FrameIdentity,
  groupId: string
) {
  return queryOptions({
    queryKey: [
      "account",
      apiBaseUrl,
      identity.userId,
      identity.sessionId,
      "group-coin",
      groupId,
    ],
    queryFn: ({ signal }) =>
      avatarFrameRequest<components["schemas"]["CoinWallet"]>(
        apiBaseUrl,
        `/v1/contribution/groups/${encodeURIComponent(groupId)}/coin-wallet`,
        { signal }
      ),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export function isCoinTransferInput(value: string) {
  return value.length <= 19 && !/\D/.test(value)
}

export function validateCoinTransfer(amount: string, balance: string) {
  if (!positiveAmount.safeParse(amount).success)
    return "Nhập số coin nguyên lớn hơn 0, trong giới hạn cho phép."
  if (BigInt(amount) > BigInt(balance)) return "Số dư coin của nhóm không đủ."
  return null
}

export function coinTransferStorageKey(
  apiBaseUrl: string,
  identity: FrameIdentity,
  groupId: string
) {
  return JSON.stringify([
    "group-coin-transfer",
    apiBaseUrl,
    identity.userId,
    identity.sessionId,
    groupId,
  ])
}

export function readPendingCoinTransfer(storage: Storage, key: string) {
  const value = storage.getItem(key)
  return value === null ? null : attemptSchema.parse(JSON.parse(value))
}

export function savePendingCoinTransfer(
  storage: Storage,
  key: string,
  attempt: CoinTransferAttempt
) {
  storage.setItem(key, JSON.stringify(attemptSchema.parse(attempt)))
}

export function coinTransferUncertain(error: unknown, resume = false) {
  return (
    !(error instanceof AvatarFrameError) ||
    error.status >= 500 ||
    (resume && [401, 403, 429].includes(error.status)) ||
    ["UPSTREAM_ERROR", "COIN_IDEMPOTENCY_CONFLICT"].includes(error.code)
  )
}

export async function transferGroupCoin(
  apiBaseUrl: string,
  groupId: string,
  attempt: CoinTransferAttempt
) {
  const { input } = attemptSchema.parse(attempt)
  const receipt = await avatarFrameRequest<
    components["schemas"]["CoinTransfer"]
  >(
    apiBaseUrl,
    `/v1/contribution/groups/${encodeURIComponent(groupId)}/coin-wallet/transfers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }
  )
  if (
    receipt.operationId !== input.operationId ||
    receipt.groupId !== groupId ||
    receipt.recipientUserId !== input.recipientUserId ||
    receipt.amount !== input.amount
  )
    throw new Error("Transfer receipt does not match request")
  return receipt
}

export async function refreshGroupCoin(
  client: QueryClient,
  apiBaseUrl: string,
  identity: FrameIdentity,
  recipientUserId: string
) {
  // Receipt balanceAfter is historical; refetch the live wallets instead.
  await Promise.all(
    [...new Set([identity.userId, recipientUserId])].map((userId) =>
      client.invalidateQueries({ queryKey: ["account", apiBaseUrl, userId] })
    )
  )
}

export function groupCoinErrorMessage(error: unknown) {
  if (!(error instanceof AvatarFrameError))
    return "Chưa xác định được kết quả. Vui lòng thử lại cùng giao dịch."
  if (error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  if (error.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại."
  switch (error.code) {
    case "COIN_DISABLED":
      return "Tính năng coin đang tạm tắt."
    case "COIN_GROUP_INELIGIBLE":
      return "Nhóm này không được sử dụng coin."
    case "COIN_INSUFFICIENT_BALANCE":
      return "Số dư coin của nhóm không đủ."
    case "COIN_RECIPIENT_NOT_MEMBER":
      return "Người nhận không còn là thành viên đã duyệt của nhóm."
    case "ACCOUNT_RESTRICTED":
      return "Tài khoản đang bị hạn chế nên không thể chuyển coin."
    case "COIN_AMOUNT_OVERFLOW":
      return "Số coin vượt giới hạn ví của người nhận."
    default:
      return coinTransferUncertain(error)
        ? "Chưa xác định được kết quả. Vui lòng thử lại cùng giao dịch."
        : "Không thể thực hiện thao tác. Hãy kiểm tra quyền tài khoản và tải lại nhóm."
  }
}
