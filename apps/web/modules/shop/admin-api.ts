import { queryOptions } from "@tanstack/react-query"

import type { components, paths } from "@/src/lib/generated/api"
import {
  type AdminAvatarFrame,
  AvatarFrameError,
  avatarFrameRequest,
  frameErrorMessage,
  frameNeedsReload,
} from "@/modules/avatar-frames/admin-api"

export type ShopChest = components["schemas"]["ShopChest"]
export type ChestCatalog = components["schemas"]["ShopChestCatalog"]
export type ChestPool = components["schemas"]["ShopChestPool"]
export type FrameShopInput =
  paths["/v1/admin/avatar-frames/{id}/shop"]["patch"]["requestBody"]["content"]["application/json"]
export type FrameShopDraft = { price: string; stock: string }

const chestImages = new Map([
  ["Genshin Impact", "/images/shop/genshin-chest.webp"],
  ["Honkai Impact 3rd", "/images/shop/hi3-chest.webp"],
  ["Honkai Impact 3", "/images/shop/hi3-chest.webp"],
  ["Honkai: Star Rail", "/images/shop/hsr-chest.webp"],
  ["Zenless Zen Zero", "/images/shop/zzz-chest.webp"],
  ["Zenless Zone Zero", "/images/shop/zzz-chest.webp"],
  ["Arknights: Endfield", "/images/shop/a9e-chest.png"],
  ["Discord", "/images/shop/discord-chest.webp"],
])

export function chestImage(chest: ShopChest) {
  return chest.kind === "common"
    ? "/images/shop/normal-chest.png"
    : chestImages.get(chest.topic?.name ?? "")
}

export function chestDisplayName(chest: ShopChest) {
  return chest.kind === "common"
    ? "Hộp Khung Avatar ngẫu nhiên"
    : `Hộp Khung Avatar ${chest.topic?.name ?? "Khác"}`
}

export function coinLabel(value: string) {
  return `${BigInt(value).toLocaleString("vi-VN")} coin`
}

export function validateFrameShopDraft(draft: FrameShopDraft) {
  const errors: { price?: string; stock?: string } = {}
  if (
    !/^[1-9]\d{0,18}$/.test(draft.price.trim()) ||
    BigInt(draft.price.trim()) > 9223372036854775807n
  )
    errors.price =
      "Giá phải là số nguyên dương, tối đa 9.223.372.036.854.775.807 coin."
  if (
    !/^(0|[1-9]\d{0,9})$/.test(draft.stock.trim()) ||
    Number(draft.stock.trim()) > 2147483647
  )
    errors.stock = "Tồn kho phải là số nguyên từ 0 đến 2.147.483.647."
  return errors
}

export function updateFrameShop(
  apiBaseUrl: string,
  frame: AdminAvatarFrame,
  draft: FrameShopDraft
) {
  if (Object.keys(validateFrameShopDraft(draft)).length)
    throw new Error("Invalid shop fields")
  const input: FrameShopInput = {
    expectedVersion: frame.version,
    expectedShopVersion: frame.shop.version,
    price: draft.price.trim(),
    stock: Number(draft.stock.trim()),
  }
  return avatarFrameRequest<{ data: AdminAvatarFrame }>(
    apiBaseUrl,
    `/v1/admin/avatar-frames/${encodeURIComponent(frame.id)}/shop`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }
  )
}

export function adminChestsOptions(
  apiBaseUrl: string,
  userId: string,
  page: number
) {
  return queryOptions({
    queryKey: ["account", apiBaseUrl, userId, "admin-shop-chests", page],
    queryFn: ({ signal }) =>
      avatarFrameRequest<ChestCatalog>(
        apiBaseUrl,
        `/v1/admin/shop/chests?page=${Math.max(1, page)}&limit=20`,
        { signal }
      ),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export function chestPoolOptions(
  apiBaseUrl: string,
  userId: string,
  chestId: string,
  page: number,
  rarity: "all" | "R" | "SR" | "SSR"
) {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    limit: "20",
  })
  if (rarity !== "all") params.set("rarity", rarity)
  return queryOptions({
    queryKey: [
      "account",
      apiBaseUrl,
      userId,
      "admin-shop-pool",
      chestId,
      page,
      rarity,
    ],
    queryFn: ({ signal }) =>
      avatarFrameRequest<ChestPool>(
        apiBaseUrl,
        `/v1/shop/chests/${encodeURIComponent(chestId)}/pool?${params}`,
        { signal }
      ),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export function updateChestSale(apiBaseUrl: string, chest: ShopChest) {
  const input: components["schemas"]["UpdateShopChestInput"] = {
    expectedVersion: chest.version,
    saleEnabled: !chest.saleEnabled,
  }
  return avatarFrameRequest<{ data: ShopChest }>(
    apiBaseUrl,
    `/v1/admin/shop/chests/${encodeURIComponent(chest.id)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }
  )
}

export function shopErrorMessage(error: unknown) {
  if (error instanceof AvatarFrameError) {
    if (
      [
        "VERSION_CONFLICT",
        "SHOP_VERSION_CONFLICT",
        "GACHA_VERSION_CONFLICT",
      ].includes(error.code)
    )
      return "Dữ liệu Shop đã thay đổi. Hãy tải trạng thái mới trước khi tiếp tục."
    if (error.code === "GACHA_POOL_UNAVAILABLE")
      return "Pool hộp chưa có đủ khung R, SR và SSR hợp lệ."
    if (error.status === 403) return "Bạn không có quyền quản lý SuicaoShop."
  }
  return frameErrorMessage(error)
}

export function shopNeedsReload(error: unknown) {
  return (
    frameNeedsReload(error) ||
    (error instanceof AvatarFrameError && error.status === 409)
  )
}
