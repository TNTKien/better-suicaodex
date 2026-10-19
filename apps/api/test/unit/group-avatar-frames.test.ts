import { expect, test } from "bun:test"
import { parseISO } from "date-fns"

import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"
import type { Auth } from "../../src/features/account/auth"
import { GroupMembershipSchema } from "../../src/features/groups/contract"
import { noPermissions, type GroupRow } from "../../src/features/groups/service"
import type { BusinessCache } from "../../src/shared/cache"

const groupId = "0199f711-739b-7000-8000-000000000010"
const instant = parseISO("2026-10-03T00:00:00Z")
const group: GroupRow = {
  id: groupId,
  name: "Nhóm dịch",
  slug: "nhom-dich",
  avatarUrl: null,
  bannerUrl: null,
  description: null,
  links: {},
  inactive: false,
  approvalStatus: "approved",
  publicationState: "published",
  createdByUserId: "admin",
  reviewedAt: instant,
  reviewedByUserId: "admin",
  createdAt: instant,
  updatedAt: instant,
  deletedAt: null,
  deletedByUserId: null,
  deleteReason: null,
}

function scriptedDatabase(results: unknown[][]) {
  let calls = 0
  const database = {
    select() {
      const result = results[calls++]
      if (!result) throw new Error("Unexpected query")
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
        for: () => chain,
        then: Promise.resolve(result).then.bind(Promise.resolve(result)),
      }
      return chain
    },
  } as unknown as Database
  return { database, calls: () => calls }
}

for (const status of ["approved", "pending"] as const) {
  for (const enabled of [true, false]) {
    test(`group ${status} avatars use one batch projection (enabled=${enabled})`, async () => {
      const rows = ["reader", "other", "next-page"].map((userId) =>
        status === "approved"
          ? {
              name: userId,
              member: {
                ...noPermissions,
                id: `membership-${userId}`,
                groupId,
                userId,
                role: "member",
                createdAt: instant,
              },
            }
          : {
              name: userId,
              application: {
                userId,
                type: "join",
                status: "pending",
                createdAt: instant,
              },
            }
      )
      const mock = scriptedDatabase([
        [group],
        [{ role: "admin" }],
        rows,
        ...(enabled
          ? [
              [
                {
                  userId: "reader",
                  frame: {
                    displayScale: 125,
                    offsetX: 0,
                    offsetY: 0,
                    id: "0199f711-739b-7000-8000-000000000001",
                    name: "Khung thử",
                    assetKey: "avatar-frames/test.webp",
                    previewKey: "avatar-frames/preview.webp",
                    width: 318,
                    height: 318,
                    frameCount: 120,
                  },
                },
              ],
            ]
          : []),
      ])
      const auth = {
        api: { getSession: async () => ({ user: { id: "admin" } }) },
      } as unknown as Auth
      const app = createApp({
        auth,
        avatarFramesEnabled: enabled,
        catalog: {
          database: mock.database,
          cache: {} as BusinessCache,
          assetBaseUrl: "https://assets.example.test/",
        },
        logger: () => undefined,
      })
      const response = await app.request(
        `/v1/contribution/groups/${groupId}/members?status=${status}&limit=2`
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      const result = (await response.json()) as {
        data: Array<{
          avatarFrame: { animated: boolean; assetUrl: string } | null
        }>
        meta: { hasMore: boolean }
      }
      expect(result.data).toHaveLength(2)
      expect(result.meta.hasMore).toBe(true)
      for (const item of result.data)
        expect(GroupMembershipSchema.safeParse(item).success).toBe(true)
      expect(result.data[1]?.avatarFrame).toBeNull()
      if (enabled) {
        expect(result.data[0]?.avatarFrame?.animated).toBe(true)
        expect(result.data[0]?.avatarFrame?.assetUrl).toBe(
          "https://assets.example.test/avatar-frames/test.webp"
        )
      } else expect(result.data[0]?.avatarFrame).toBeNull()
      expect(mock.calls()).toBe(enabled ? 4 : 3)
    })
  }
}
