import { queryOptions, type QueryClient } from "@tanstack/react-query"

import {
  currentAccountOptions,
  type CurrentAccount,
} from "@/modules/account/api"
import type { components, paths } from "@/src/lib/generated/api"

import { AvatarFrameError, avatarFrameRequest } from "./admin-api"

export type FrameIdentity = { userId: string; sessionId: string }
type InventoryPage = components["schemas"]["AvatarFrameInventory"]
type InventoryItem = InventoryPage["data"][number]
export type OwnFrame = Omit<InventoryItem, "frame"> & {
  frame: NonNullable<InventoryItem["frame"]>
}
export type OwnInventory = Omit<
  InventoryPage,
  "data" | "meta" | "selectedFrameId"
> & {
  data: OwnFrame[]
  // The generated nullable Id $ref is an intersection; preserve API null here.
  selectedFrameId: InventoryPage["selectedFrameId"] | null
}
type EquipInput =
  paths["/v1/me/avatar-frame"]["put"]["requestBody"]["content"]["application/json"]

export function ownFramesKey(apiBaseUrl: string, identity: FrameIdentity) {
  return [
    "account",
    apiBaseUrl,
    identity.userId,
    identity.sessionId,
    "avatar-frames",
  ] as const
}

export function ownFramesOptions(apiBaseUrl: string, identity: FrameIdentity) {
  return queryOptions({
    queryKey: ownFramesKey(apiBaseUrl, identity),
    queryFn: async ({ signal }): Promise<OwnInventory> => {
      const data: OwnFrame[] = []
      let page = 1
      while (true) {
        signal.throwIfAborted()
        const result = await avatarFrameRequest<InventoryPage>(
          apiBaseUrl,
          `/v1/me/avatar-frames?page=${page}&limit=100`,
          { signal }
        )
        for (const item of result.data) {
          if (!item.frame) throw new Error("Missing owned frame summary")
          data.push({ ...item, frame: item.frame })
        }
        if (page >= result.meta.totalPages)
          return {
            data,
            selectedFrameId: result.selectedFrameId,
            enabled: result.enabled,
          }
        page += 1
      }
    },
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export async function setOwnFrame(
  apiBaseUrl: string,
  identity: FrameIdentity,
  frameId: string | null
) {
  const input: EquipInput | undefined =
    frameId === null ? undefined : { frameId }
  const result = await avatarFrameRequest<CurrentAccount>(
    apiBaseUrl,
    "/v1/me/avatar-frame",
    {
      method: input ? "PUT" : "DELETE",
      ...(input
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}),
    }
  )
  if (result.user.id !== identity.userId)
    throw new AvatarFrameError(401, "ACCOUNT_CHANGED", "Account changed")
  return result
}

export async function refreshOwnFrames(
  client: QueryClient,
  apiBaseUrl: string,
  identity: FrameIdentity,
  updated?: CurrentAccount
) {
  const key = currentAccountOptions(apiBaseUrl, identity).queryKey
  // Never recreate private account cache after logout/account switching.
  if (
    updated &&
    client.getQueryData<CurrentAccount>(key)?.user.id === identity.userId
  )
    client.setQueryData(key, updated)
  await Promise.all([
    client.invalidateQueries({
      queryKey: ["account", apiBaseUrl, identity.userId],
    }),
    client.invalidateQueries({ queryKey: ["comments", apiBaseUrl] }),
  ])
}

export function ownFrameErrorMessage(error: unknown) {
  if (!(error instanceof AvatarFrameError))
    return "Mất kết nối hoặc hết thời gian chờ. Hãy tải trạng thái mới trước khi thử lại; thao tác có thể đã được lưu."
  if (error.status === 401)
    return "Phiên đăng nhập đã hết hạn hoặc tài khoản đã thay đổi. Vui lòng đăng nhập lại."
  switch (error.code) {
    case "AVATAR_FRAMES_DISABLED":
      return "Tính năng khung avatar đang tắt. Bạn vẫn có thể gỡ khung đang chọn."
    case "FRAME_UNAVAILABLE":
    case "NOT_FOUND":
      return "Khung không còn khả dụng hoặc quyền sở hữu đã thay đổi. Hãy tải lại kho khung."
    case "ACCOUNT_RESTRICTED":
      return "Tài khoản đang bị hạn chế nên không thể chọn khung mới. Bạn vẫn có thể gỡ khung."
    default:
      return error.status === 403
        ? "Bạn không được phép thực hiện thao tác này. Hãy kiểm tra tài khoản và tải lại kho khung."
        : error.message
  }
}

export function canEquipOwnFrame(
  item: OwnFrame,
  enabled: boolean,
  activeAccount: boolean
) {
  return enabled && activeAccount && item.active && !item.selected
}

export function canUnequipOwnFrame(
  item: OwnFrame,
  selectedFrameId: string | null
) {
  return item.selected && selectedFrameId === item.frame.id
}
