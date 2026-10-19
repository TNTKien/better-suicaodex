import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import { z } from "zod"
import type { components } from "@/src/lib/generated/api"
import type { FrameIdentity } from "@/modules/avatar-frames/account-api"
import {
  AvatarFrameError,
  avatarFrameRequest,
} from "@/modules/avatar-frames/admin-api"

export type PersonalChest = components["schemas"]["PersonalShopChest"]
export type GachaReceipt = components["schemas"]["GachaReceipt"]
export type GachaHistory = components["schemas"]["GachaHistory"]

export function gachaHistoryOptions(
  apiBaseUrl: string,
  identity: FrameIdentity
) {
  return infiniteQueryOptions({
    queryKey: [
      "account",
      apiBaseUrl,
      identity.userId,
      identity.sessionId,
      "gacha-history",
    ],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "20" })
      if (pageParam) params.set("cursor", pageParam)
      return avatarFrameRequest<GachaHistory>(
        apiBaseUrl,
        `/v1/me/shop/gacha-rolls?${params}`,
        { signal }
      )
    },
    getNextPageParam: ({ meta }) => meta.nextCursor ?? undefined,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export function gachaHistoryChestName(chest: GachaReceipt["chest"]) {
  return chest.kind === "common"
    ? "Hộp Khung Avatar ngẫu nhiên"
    : chest.name.replace(/^Rương /, "Hộp Khung Avatar ")
}

export function personalChestOptions(
  apiBaseUrl: string,
  identity: FrameIdentity,
  chestId: string
) {
  return queryOptions({
    queryKey: [
      "account",
      apiBaseUrl,
      identity.userId,
      identity.sessionId,
      "shop-chest",
      chestId,
    ],
    queryFn: ({ signal }) =>
      avatarFrameRequest<PersonalChest>(
        apiBaseUrl,
        `/v1/me/shop/chests/${encodeURIComponent(chestId)}`,
        { signal }
      ),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n)
const version = z.number().int().min(1).max(2147483647)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const attemptSchema = z
  .object({
    name: z.string().min(1).max(800),
    input: z
      .object({
        operationId: z.uuid(),
        chestId: z.uuid(),
        expectedChestVersion: version,
        expectedRuleVersion: version,
        expectedPoolDigest: digest,
        expectedPrice: money.refine((value) => BigInt(value) > 0n),
      })
      .strict(),
  })
  .strict()
export type GachaAttempt = z.infer<typeof attemptSchema>

export function gachaStorageKey(apiBaseUrl: string, identity: FrameIdentity) {
  return JSON.stringify([
    "shop-gacha",
    apiBaseUrl,
    identity.userId,
    identity.sessionId,
  ])
}

export function readPendingGacha(storage: Storage, key: string) {
  const value = storage.getItem(key)
  return value === null ? null : attemptSchema.parse(JSON.parse(value))
}

export function savePendingGacha(
  storage: Storage,
  key: string,
  attempt: GachaAttempt
) {
  storage.setItem(key, JSON.stringify(attemptSchema.parse(attempt)))
}

export function gachaUncertain(error: unknown) {
  return (
    !(error instanceof AvatarFrameError) ||
    error.status >= 500 ||
    ["UPSTREAM_ERROR", "GACHA_IDEMPOTENCY_CONFLICT"].includes(error.code)
  )
}

// Validate the receipt fields used by the UI before acknowledging a paid operation.
const receiptSchema = z.object({
  operationId: z.uuid(),
  chest: z.object({ id: z.uuid(), version }),
  frame: z.object({
    id: z.uuid(),
    name: z.string().min(1),
    rarity: z.enum(["R", "SR", "SSR"]),
  }),
  ruleVersion: version,
  poolDigest: digest,
  price: money,
  duplicate: z.boolean(),
  refund: money,
})

export async function rollChest(
  apiBaseUrl: string,
  attempt: GachaAttempt,
  resume: boolean
) {
  const { input } = attemptSchema.parse(attempt)
  let result: { data: GachaReceipt } | undefined
  if (resume) {
    try {
      result = await avatarFrameRequest<{ data: GachaReceipt }>(
        apiBaseUrl,
        `/v1/me/shop/gacha-rolls/${input.operationId}`
      )
    } catch (error) {
      if (
        !(error instanceof AvatarFrameError) ||
        error.status !== 404 ||
        error.code !== "NOT_FOUND"
      )
        throw new Error("Cannot determine gacha receipt", { cause: error })
    }
  }
  result ??= await avatarFrameRequest<{ data: GachaReceipt }>(
    apiBaseUrl,
    "/v1/me/shop/gacha-rolls",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }
  )
  const receipt = receiptSchema.parse(result.data)
  if (
    receipt.operationId !== input.operationId ||
    receipt.chest.id !== input.chestId ||
    receipt.chest.version !== input.expectedChestVersion ||
    receipt.ruleVersion !== input.expectedRuleVersion ||
    receipt.poolDigest !== input.expectedPoolDigest ||
    receipt.price !== input.expectedPrice ||
    (!receipt.duplicate && receipt.refund !== "0")
  )
    throw new Error("Gacha receipt does not match quote")
  return result.data
}

export function gachaBlockMessage(reason: PersonalChest["rollBlockReason"]) {
  switch (reason) {
    case "insufficient_coin":
      return "Số dư coin không đủ để mua hộp này."
    case "chest_closed":
      return "Hộp này chưa mở bán."
    case "pool_unavailable":
      return "Hộp chưa có đủ khung ở mỗi độ hiếm."
    case "sequence_limit":
      return "Tài khoản đã đạt giới hạn lượt mở hộp."
    default:
      return "Tính năng mở hộp đang tạm tắt."
  }
}

export function gachaErrorMessage(error: unknown) {
  if (gachaUncertain(error))
    return "Chưa xác định được kết quả mua hộp. Vui lòng thử lại."
  if (!(error instanceof AvatarFrameError)) return "Không thể mua hộp."
  if (error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  if (error.status === 429)
    return "Bạn thao tác quá nhanh. Hãy đợi một chút rồi thử lại."
  switch (error.code) {
    case "GACHA_QUOTE_CHANGED":
    case "GACHA_VERSION_CONFLICT":
      return "Giá hoặc danh sách khung đã thay đổi. Hãy kiểm tra lại và xác nhận giá mới."
    case "GACHA_CHEST_CLOSED":
      return gachaBlockMessage("chest_closed")
    case "GACHA_POOL_UNAVAILABLE":
      return gachaBlockMessage("pool_unavailable")
    case "COIN_INSUFFICIENT_BALANCE":
      return gachaBlockMessage("insufficient_coin")
    case "ACCOUNT_RESTRICTED":
      return "Tài khoản đang bị hạn chế nên không thể mua hộp."
    default:
      return "Không thể mua hộp. Hãy tải lại Shop hoặc kiểm tra quyền tài khoản."
  }
}
