import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { adminUserQueryKey } from "@/modules/moderation/account-moderation"
import type { components, paths } from "@/src/lib/generated/api"

import { avatarFrameRequest, type AdminAvatarFrame } from "./admin-api"

type InventoryPage = components["schemas"]["AvatarFrameInventory"]
type InventoryItem = InventoryPage["data"][number]
export type UserFrame = Omit<InventoryItem, "frame"> & {
  frame: NonNullable<InventoryItem["frame"]>
}
export type UserFrameInventory = Omit<InventoryPage, "meta" | "data"> & {
  data: UserFrame[]
}
type OwnershipPath = paths["/v1/admin/users/{userId}/avatar-frames/{frameId}"]
type OwnershipInput =
  OwnershipPath["put"]["requestBody"]["content"]["application/json"]
type OwnershipResult =
  OwnershipPath["put"]["responses"][200]["content"]["application/json"]

export function userFramesOptions(
  apiBaseUrl: string,
  actorUserId: string,
  targetUserId: string
) {
  return queryOptions({
    queryKey: [
      ...adminUserQueryKey(apiBaseUrl, actorUserId, targetUserId),
      "avatar-frames",
    ],
    queryFn: async ({ signal }): Promise<UserFrameInventory> => {
      const data: UserFrame[] = []
      let page = 1
      // Read every inventory page, not just the visible grid page: an owned
      // frame must not become grantable merely because it is on another page.
      while (true) {
        signal.throwIfAborted()
        const result = await avatarFrameRequest<InventoryPage>(
          apiBaseUrl,
          `/v1/admin/users/${encodeURIComponent(targetUserId)}/avatar-frames?page=${page}&limit=100`,
          { signal }
        )
        for (const item of result.data) {
          // The shared generated summary type is nullable. Fail closed rather
          // than treating an unknown owned frame as available to grant.
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

export function canGrantFrame(frame: AdminAvatarFrame) {
  return frame.active && !frame.limited && frame.frame !== null
}

export function changeUserFrame(
  apiBaseUrl: string,
  targetUserId: string,
  frameId: string,
  kind: "grant" | "revoke"
) {
  const input: OwnershipInput = {}
  return avatarFrameRequest<OwnershipResult>(
    apiBaseUrl,
    `/v1/admin/users/${encodeURIComponent(targetUserId)}/avatar-frames/${encodeURIComponent(frameId)}`,
    {
      method: kind === "grant" ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  )
}

export async function invalidateUserFrames(
  client: QueryClient,
  apiBaseUrl: string
) {
  // Revoke can clear an equipped frame. Refresh private account/admin/audit
  // projections and comment avatars, including when a request timed out.
  await Promise.all([
    client.invalidateQueries({ queryKey: ["account", apiBaseUrl] }),
    client.invalidateQueries({ queryKey: ["comments", apiBaseUrl] }),
  ])
}
