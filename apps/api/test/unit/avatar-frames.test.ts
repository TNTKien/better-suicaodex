import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"
import {
  CreateAvatarFrameSchema,
  EquipAvatarFrameSchema,
  UpdateAvatarFrameSchema,
  CreateFrameTopicSchema,
  FrameOwnershipInputSchema,
} from "../../src/features/avatar-frames/contract"
import { effectiveAvatarFrames } from "../../src/features/avatar-frames/projection"

test("frame alignment rejects out-of-range, fractional and forged values", () => {
  const base = { code: "aligned", name: "Aligned", rarity: "SR" }
  for (const values of [
    { displayScale: 50, offsetX: -50, offsetY: 50 },
    { displayScale: 200, offsetX: 50, offsetY: -50 },
  ]) {
    expect(
      CreateAvatarFrameSchema.safeParse({ ...base, ...values }).success
    ).toBe(true)
    expect(
      UpdateAvatarFrameSchema.safeParse({ expectedVersion: 1, ...values })
        .success
    ).toBe(true)
  }
  for (const values of [
    { displayScale: 49 },
    { displayScale: 201 },
    { displayScale: 125.5 },
    { offsetX: -51 },
    { offsetY: 51 },
    { offsetY: 0.5 },
    { displayScale: "125" },
    { offsetX: null },
  ]) {
    expect(
      CreateAvatarFrameSchema.safeParse({ ...base, ...values }).success
    ).toBe(false)
    expect(
      UpdateAvatarFrameSchema.safeParse({ expectedVersion: 1, ...values })
        .success
    ).toBe(false)
  }
})

test("Shop early rate-limit errors retain public/private no-store headers", async () => {
  for (const [path, method, policy] of [
    ["/v1/shop/avatar-frames", "GET", "no-store"],
    ["/v1/me/shop/avatar-frames", "GET", "private, no-store"],
    ["/v1/me/shop/purchases", "POST", "private, no-store"],
    ["/v1/me/shop/purchases", "GET", "private, no-store"],
    [`/v1/me/shop/purchases/${randomUUID()}`, "GET", "private, no-store"],
    [
      `/v1/admin/avatar-frames/${randomUUID()}/shop`,
      "PATCH",
      "private, no-store",
    ],
  ]) {
    const app = createApp({
      account: { database: {} as Database },
      rateLimit: {},
      logger: () => {},
    })
    for (let i = 0; i < 10; i++) await app.request(path!, { method })
    const response = await app.request(path!, { method })
    expect(response.status).toBe(429)
    expect(response.headers.get("Cache-Control")).toBe(policy!)
  }
})

test("admin frame ownership does not require a reason but preserves strict input validation", () => {
  expect(FrameOwnershipInputSchema.parse({})).toEqual({
    reason: "Admin avatar frame ownership change",
  })
  expect(FrameOwnershipInputSchema.safeParse({ reason: "   " }).success).toBe(
    false
  )
  expect(FrameOwnershipInputSchema.parse({ reason: " Grant reason " })).toEqual(
    { reason: "Grant reason" }
  )
  expect(
    FrameOwnershipInputSchema.safeParse({ reason: "a".repeat(501) }).success
  ).toBe(false)
  expect(FrameOwnershipInputSchema.safeParse({ userId: "other" }).success).toBe(
    false
  )
  expect(FrameOwnershipInputSchema.safeParse({ selected: true }).success).toBe(
    false
  )
})

test("avatar frame contracts reject forged asset/ownership data and expose private guarded operations", async () => {
  expect(
    CreateAvatarFrameSchema.safeParse({
      code: "a",
      name: "Frame",
      rarity: "R",
      limited: true,
    }).success
  ).toBe(false)
  expect(
    CreateAvatarFrameSchema.safeParse({
      code: "a",
      name: "Frame",
      rarity: "SSR",
      assetUrl: "https://evil.example/",
    }).success
  ).toBe(false)
  expect(
    UpdateAvatarFrameSchema.safeParse({ expectedVersion: 1 }).success
  ).toBe(false)
  expect(
    EquipAvatarFrameSchema.safeParse({ frameId: randomUUID(), userId: "other" })
      .success
  ).toBe(false)
  const database = {} as Database
  expect(
    (
      await effectiveAvatarFrames({ database, avatarFramesEnabled: false }, [
        "user",
      ])
    ).size
  ).toBe(0)
  const app = createApp({ account: { database }, logger: () => undefined })
  for (const path of [
    "/v1/me/avatar-frames",
    "/v1/admin/avatar-frames",
    "/v1/admin/avatar-frame-topics",
    `/v1/admin/users/test/avatar-frames`,
  ]) {
    const response = await app.request(path)
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  }
  const spec = (await (await app.request("/openapi.json")).json()) as {
    paths: Record<string, unknown>
    components: { schemas: Record<string, unknown> }
  }
  expect(spec.paths["/v1/me/avatar-frame"]).toBeDefined()
  expect(spec.paths["/v1/admin/avatar-frames/{id}/asset"]).toBeDefined()
  expect(spec.components.schemas.AvatarFrameSummary).toBeDefined()
  expect(spec.components.schemas.AvatarFrameSummary).toMatchObject({
    type: "object",
  })
  expect(spec.components.schemas.CurrentAccount).toMatchObject({
    properties: {
      user: {
        properties: {
          avatarFrame: {
            anyOf: [
              { $ref: "#/components/schemas/AvatarFrameSummary" },
              { type: "null" },
            ],
          },
        },
      },
    },
  })
  expect(spec.paths["/v1/admin/avatar-frame-topics/{id}"]).toBeDefined()
  expect(CreateFrameTopicSchema.safeParse({ name: "   " }).success).toBe(false)
  expect(
    CreateFrameTopicSchema.safeParse({ name: "a".repeat(161) }).success
  ).toBe(false)
  expect(
    UpdateAvatarFrameSchema.safeParse({
      expectedVersion: 1,
      description: "a".repeat(2001),
    }).success
  ).toBe(false)
  expect(
    UpdateAvatarFrameSchema.safeParse({
      expectedVersion: 1,
      description: "",
      topicId: null,
    }).success
  ).toBe(true)
})
