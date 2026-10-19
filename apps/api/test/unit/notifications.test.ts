import { expect, test } from "bun:test"

import { createApp } from "../../src/app"
import type { CatalogDependencies } from "../../src/features/catalog/routes"

test("notification OpenAPI exposes the private list and read contracts", async () => {
  const app = createApp({
    logger: () => undefined,
    catalog: {
      assetBaseUrl: "https://assets.example.com/",
    } as CatalogDependencies,
  })
  const document = await (await app.request("/openapi.json")).json()

  const list = document.paths["/v1/me/notifications"].get
  expect(
    list.responses[200].content["application/json"].schema.properties.meta
      .properties.unreadCount.minimum
  ).toBe(0)
  expect(
    document.paths["/v1/me/notifications/{notificationId}/read"].post
      .responses[200]
  ).toBeDefined()
  expect(
    document.paths["/v1/me/notifications/read-all"].post.responses[200]
  ).toBeDefined()
  expect(
    document.components.schemas.MangaNewChapterNotification.properties.type
  ).toEqual({ enum: ["manga_new_chapter"], type: "string" })
  expect(document.components.schemas.GroupNotification.properties.type).toEqual(
    {
      enum: [
        "group_join_requested",
        "group_join_approved",
        "group_join_rejected",
        "group_member_removed",
        "group_member_left",
        "group_approved",
        "group_rejected",
        "content_group_added",
        "group_leader_assigned",
      ],
      type: "string",
    }
  )
  expect(
    document.components.schemas.GroupNotification.properties
  ).not.toHaveProperty("reason")
  expect(
    list.responses[200].content["application/json"].schema.properties.data.items
      .anyOf
  ).toEqual([
    { $ref: "#/components/schemas/MangaNewChapterNotification" },
    { $ref: "#/components/schemas/GroupNotification" },
    { $ref: "#/components/schemas/SystemNoticeNotification" },
  ])
})
