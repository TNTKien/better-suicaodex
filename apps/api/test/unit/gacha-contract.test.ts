import { expect, test } from "bun:test"
import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"
import {
  GachaHistoryQuerySchema,
  GachaRuleSchema,
} from "../../src/features/shop/gacha-contract"
import { NORMAL_GACHA_RULE } from "../../src/features/shop/gacha-policy"

test("gacha OpenAPI exposes all nine routes, strict mutation inputs and private decimal-string snapshots", async () => {
  expect(GachaRuleSchema.parse(NORMAL_GACHA_RULE)).toEqual(NORMAL_GACHA_RULE)
  expect(GachaHistoryQuerySchema.parse({})).toEqual({ limit: 20 })
  const app = createApp({
    account: { database: {} as Database },
    logger: () => {},
  })
  const spec = (await (await app.request("/openapi.json")).json()) as {
    paths: Record<
      string,
      Record<string, { responses: Record<string, unknown> }>
    >
    components: {
      schemas: Record<
        string,
        {
          additionalProperties?: boolean
          properties: Record<string, { type?: string }>
        }
      >
    }
  }
  for (const [path, method] of [
    ["/v1/shop/chests", "get"],
    ["/v1/shop/chests/{chestId}", "get"],
    ["/v1/shop/chests/{chestId}/pool", "get"],
    ["/v1/me/shop/chests/{chestId}", "get"],
    ["/v1/me/shop/gacha-rolls", "post"],
    ["/v1/me/shop/gacha-rolls/{operationId}", "get"],
    ["/v1/me/shop/gacha-rolls", "get"],
    ["/v1/admin/shop/chests", "get"],
    ["/v1/admin/shop/chests/{chestId}", "patch"],
  ]) {
    const route = spec.paths[path!]![method!]!
    expect(route).toBeDefined()
    for (const status of ["200", "400", "401", "403", "404", "429", "503"])
      expect(route.responses).toHaveProperty(status)
    if (["post", "patch"].includes(method!)) {
      expect(route.responses).toHaveProperty("409")
      expect(route.responses).toHaveProperty("413")
    }
  }
  const schemas = spec.components.schemas
  expect(schemas.GachaRollInput!.additionalProperties).toBe(false)
  expect(Object.keys(schemas.GachaRollInput!.properties).sort()).toEqual([
    "chestId",
    "expectedChestVersion",
    "expectedPoolDigest",
    "expectedPrice",
    "expectedRuleVersion",
    "operationId",
  ])
  expect(schemas.UpdateShopChestInput!.additionalProperties).toBe(false)
  expect(Object.keys(schemas.UpdateShopChestInput!.properties).sort()).toEqual([
    "expectedVersion",
    "saleEnabled",
  ])
  for (const field of ["price", "refund", "sequence", "balanceAfter"])
    expect(schemas.GachaReceipt!.properties[field]!.type).toBe("string")
  for (const field of [
    "actorUserId",
    "coinOperationKey",
    "fingerprint",
    "balance",
    "pity",
    "owned",
    "stock",
  ])
    expect(schemas.ShopChest!.properties).not.toHaveProperty(field)
  for (const field of [
    "actorUserId",
    "coinOperationKey",
    "fingerprint",
    "currentBalance",
    "ruleSnapshot",
  ])
    expect(schemas.GachaReceipt!.properties).not.toHaveProperty(field)
})
