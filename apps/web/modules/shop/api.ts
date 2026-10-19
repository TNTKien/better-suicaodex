import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { z } from "zod"

import type { components, paths } from "@/src/lib/generated/api"
import type { FrameIdentity } from "@/modules/avatar-frames/account-api"
import {
  AvatarFrameError,
  avatarFrameRequest,
} from "@/modules/avatar-frames/admin-api"

export type ShopFrame = components["schemas"]["ShopAvatarFrame"] &
  Partial<
    Pick<
      components["schemas"]["PersonalShopAvatarFrame"],
      "owned" | "canPurchase" | "purchaseBlockReason"
    >
  >
export type ShopCatalog =
  paths["/v1/shop/avatar-frames"]["get"]["responses"][200]["content"]["application/json"] & {
    balance?: string
  }
type PersonalCatalog =
  paths["/v1/me/shop/avatar-frames"]["get"]["responses"][200]["content"]["application/json"]
type ShopTopics =
  paths["/v1/shop/avatar-frame-topics"]["get"]["responses"][200]["content"]["application/json"]
type Receipt = components["schemas"]["ShopPurchaseReceipt"]
export type ShopFilters = {
  page: number
  q: string
  rarity: "all" | "R" | "SR" | "SSR"
  topicId: string
}

export function shopFramesKey(
  apiBaseUrl: string,
  identity: FrameIdentity | null
) {
  return identity
    ? [
        "account",
        apiBaseUrl,
        identity.userId,
        identity.sessionId,
        "shop-frames",
      ]
    : ["shop-frames", apiBaseUrl, "public"]
}

export function shopFramesPath(filters: ShopFilters, personal: boolean) {
  const params = new URLSearchParams({
    page: String(Math.max(1, filters.page)),
    limit: "20",
  })
  if (filters.q.trim()) params.set("q", filters.q.trim().slice(0, 160))
  if (filters.rarity !== "all") params.set("rarity", filters.rarity)
  if (filters.topicId !== "all") params.set("topicId", filters.topicId)
  return `/v1/${personal ? "me/" : ""}shop/avatar-frames?${params}`
}

export function shopFramesOptions(
  apiBaseUrl: string,
  identity: FrameIdentity | null,
  filters: ShopFilters
) {
  return queryOptions({
    queryKey: [...shopFramesKey(apiBaseUrl, identity), filters],
    queryFn: ({ signal }) =>
      avatarFrameRequest<ShopCatalog | PersonalCatalog>(
        apiBaseUrl,
        shopFramesPath(filters, !!identity),
        { signal }
      ),
    staleTime: 30_000,
    gcTime: identity ? 0 : 5 * 60_000,
    retry: false,
    networkMode: "always",
  })
}

export function shopTopicsOptions(apiBaseUrl: string) {
  return queryOptions({
    queryKey: ["shop-frame-topics", apiBaseUrl],
    queryFn: ({ signal }) =>
      avatarFrameRequest<ShopTopics>(
        apiBaseUrl,
        "/v1/shop/avatar-frame-topics",
        { signal }
      ),
    staleTime: 60_000,
    retry: false,
    networkMode: "always",
  })
}

export function shopWalletOptions(
  apiBaseUrl: string,
  identity: FrameIdentity | null
) {
  return queryOptions({
    queryKey: [
      "account",
      apiBaseUrl,
      identity?.userId,
      identity?.sessionId,
      "coin-wallet",
    ],
    queryFn: ({ signal }) =>
      avatarFrameRequest<components["schemas"]["CoinWallet"]>(
        apiBaseUrl,
        "/v1/me/coin-wallet",
        { signal }
      ),
    enabled: !!identity,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export function shopChestsOptions(apiBaseUrl: string, page: number) {
  return queryOptions({
    queryKey: ["shop-chests", apiBaseUrl, page],
    queryFn: ({ signal }) =>
      avatarFrameRequest<components["schemas"]["ShopChestCatalog"]>(
        apiBaseUrl,
        `/v1/shop/chests?page=${Math.max(1, page)}&limit=20`,
        { signal }
      ),
    staleTime: 30_000,
    retry: false,
  })
}

export function shopChestPoolOptions(
  apiBaseUrl: string,
  chestId: string,
  page: number,
  rarity: "all" | "R" | "SR" | "SSR"
) {
  const params = new URLSearchParams({ page: String(page), limit: "20" })
  if (rarity !== "all") params.set("rarity", rarity)
  return queryOptions({
    queryKey: ["shop-chest-pool", apiBaseUrl, chestId, page, rarity],
    queryFn: ({ signal }) =>
      avatarFrameRequest<components["schemas"]["ShopChestPool"]>(
        apiBaseUrl,
        `/v1/shop/chests/${encodeURIComponent(chestId)}/pool?${params}`,
        { signal }
      ),
    staleTime: 30_000,
    retry: false,
  })
}

const attemptSchema = z
  .object({
    name: z.string().min(1).max(800),
    input: z
      .object({
        operationId: z.uuid(),
        frameId: z.uuid(),
        expectedFrameVersion: z.number().int().min(1).max(2147483647),
        expectedPrice: z
          .string()
          .regex(/^[1-9]\d{0,18}$/)
          .refine((value) => BigInt(value) <= 9223372036854775807n),
      })
      .strict(),
  })
  .strict()
export type PurchaseAttempt = z.infer<typeof attemptSchema>

export function purchaseStorageKey(
  apiBaseUrl: string,
  identity: FrameIdentity
) {
  return JSON.stringify([
    "shop-purchase",
    apiBaseUrl,
    identity.userId,
    identity.sessionId,
  ])
}

export function readPendingPurchase(storage: Storage, key: string) {
  const value = storage.getItem(key)
  return value === null ? null : attemptSchema.parse(JSON.parse(value))
}

export function savePendingPurchase(
  storage: Storage,
  key: string,
  attempt: PurchaseAttempt
) {
  storage.setItem(key, JSON.stringify(attemptSchema.parse(attempt)))
}

export function purchaseUncertain(error: unknown) {
  return (
    !(error instanceof AvatarFrameError) ||
    error.status >= 500 ||
    ["UPSTREAM_ERROR", "SHOP_IDEMPOTENCY_CONFLICT"].includes(error.code)
  )
}

export async function purchaseFrame(
  apiBaseUrl: string,
  attempt: PurchaseAttempt,
  resume: boolean
) {
  const { input } = attemptSchema.parse(attempt)
  let result: { data: Receipt } | undefined
  if (resume) {
    try {
      result = await avatarFrameRequest<{ data: Receipt }>(
        apiBaseUrl,
        `/v1/me/shop/purchases/${input.operationId}`
      )
    } catch (error) {
      if (
        !(error instanceof AvatarFrameError) ||
        error.status !== 404 ||
        error.code !== "NOT_FOUND"
      )
        throw new Error("Cannot determine purchase receipt", { cause: error })
    }
  }
  result ??= await avatarFrameRequest<{ data: Receipt }>(
    apiBaseUrl,
    "/v1/me/shop/purchases",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }
  )
  if (
    result.data?.operationId !== input.operationId ||
    result.data.frame.id !== input.frameId ||
    result.data.price !== input.expectedPrice
  )
    throw new Error("Purchase receipt does not match quote")
  return result.data
}

export async function refreshShopPurchase(
  client: QueryClient,
  apiBaseUrl: string,
  identity: FrameIdentity
) {
  // Receipt balanceAfter is historical, never write it over the live balance.
  await Promise.all([
    client.invalidateQueries({
      queryKey: ["account", apiBaseUrl, identity.userId],
    }),
    client.invalidateQueries({ queryKey: ["shop-frames", apiBaseUrl] }),
  ])
}

export function purchaseErrorMessage(error: unknown) {
  if (purchaseUncertain(error))
    return "Chưa xác định được kết quả mua. Vui lòng thử lại."
  if (!(error instanceof AvatarFrameError)) return "Không thể xử lý yêu cầu."
  if (error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  if (error.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại."
  switch (error.code) {
    case "SHOP_QUOTE_CHANGED":
      return "Giá hoặc thông tin khung đã thay đổi. Hãy chọn lại khung và xác nhận giá mới."
    case "SHOP_ALREADY_OWNED":
      return "Bạn đã sở hữu khung này."
    case "SHOP_SOLD_OUT":
      return "Khung này vừa hết hàng."
    case "COIN_INSUFFICIENT_BALANCE":
      return "Số dư coin không đủ để mua khung này."
    case "SHOP_FRAME_UNAVAILABLE":
    case "LIMITED_FRAME_PROTECTED":
      return "Khung này không còn được bán trực tiếp."
    case "ACCOUNT_RESTRICTED":
      return "Tài khoản đang bị hạn chế nên không thể mua khung."
    case "AVATAR_FRAMES_DISABLED":
      return "Tính năng khung avatar đang tạm tắt."
    default:
      return "Không thể mua khung. Vui lòng tải lại Shop hoặc kiểm tra quyền tài khoản."
  }
}

export function framePurchaseLabel(item: ShopFrame, guest: boolean) {
  if (item.owned) return "Đã sở hữu"
  if (item.availability === "sold_out") return "Hết hàng"
  if (guest) return "Đăng nhập để mua"
  if (item.purchaseBlockReason === "insufficient_coin") return "Không đủ coin"
  return item.canPurchase ? "Mua ngay" : "Chưa thể mua"
}
