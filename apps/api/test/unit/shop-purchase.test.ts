import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { ShopPurchaseInputSchema } from "../../src/features/shop/contract"
import { MAX_COIN } from "../../src/features/coin/contract"
import { ShopPurchaseHistoryQuerySchema } from "../../src/features/shop/contract"
import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"

test("Shop purchase input is strict, exact and canonical before fingerprinting", () => {
  const input = {
    operationId: randomUUID(),
    frameId: randomUUID(),
    expectedFrameVersion: 1,
    expectedPrice: "15",
  }
  expect(
    ShopPurchaseInputSchema.parse({
      ...input,
      operationId: input.operationId.toUpperCase(),
      frameId: input.frameId.toUpperCase(),
    })
  ).toEqual(input)
  expect(
    ShopPurchaseInputSchema.parse({
      ...input,
      expectedPrice: MAX_COIN.toString(),
      expectedFrameVersion: 2_147_483_647,
    }).expectedPrice
  ).toBe(MAX_COIN.toString())
  for (const invalid of [
    { ...input, operationId: "bad" },
    { ...input, frameId: "bad" },
    { ...input, expectedFrameVersion: 0 },
    { ...input, expectedFrameVersion: 1.5 },
    { ...input, expectedFrameVersion: 2_147_483_648 },
    ...[
      0,
      15,
      "0",
      "-1",
      "1.5",
      "01",
      "1e2",
      " 15 ",
      (MAX_COIN + 1n).toString(),
    ].map((expectedPrice) => ({ ...input, expectedPrice })),
    ...[
      "quantity",
      "userId",
      "walletId",
      "stock",
      "source",
      "assetKey",
      "refund",
    ].map((key) => ({ ...input, [key]: "forged" })),
  ])
    expect(ShopPurchaseInputSchema.safeParse(invalid).success).toBe(false)
})

test("Shop purchase/history HTTP contracts are private, bounded and generated without live-state fields", async () => {
  expect(ShopPurchaseHistoryQuerySchema.parse({})).toEqual({ limit: 20 })
  expect(
    ShopPurchaseHistoryQuerySchema.parse({
      cursor: MAX_COIN.toString(),
      limit: "100",
    })
  ).toEqual({ cursor: MAX_COIN.toString(), limit: 100 })
  for (const query of [
    { userId: "other" },
    { limit: "101" },
    { cursor: "0" },
    { cursor: "01" },
    { cursor: (MAX_COIN + 1n).toString() },
  ])
    expect(ShopPurchaseHistoryQuerySchema.safeParse(query).success).toBe(false)
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
        { additionalProperties?: boolean; properties: Record<string, unknown> }
      >
    }
  }
  const base = "/v1/me/shop/purchases"
  expect(spec.paths[base]!.post!.responses).toHaveProperty("413")
  expect(spec.paths[base]!.post!.responses).toHaveProperty("409")
  expect(spec.paths[base]!.get!.responses).toHaveProperty("429")
  expect(spec.paths[`${base}/{operationId}`]!.get).toBeDefined()
  expect(spec.components.schemas.ShopPurchaseInput!.additionalProperties).toBe(
    false
  )
  expect(
    Object.keys(spec.components.schemas.ShopPurchaseReceipt!.properties).sort()
  ).toEqual(
    [
      "id",
      "operationId",
      "frame",
      "price",
      "transactionGroup",
      "ledgerId",
      "sequence",
      "balanceAfter",
      "createdAt",
    ].sort()
  )
  for (const [path, method] of [
    [base, "POST"],
    [base, "GET"],
    [`${base}/${randomUUID()}`, "GET"],
  ]) {
    const response = await app.request(path!, { method })
    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  }
})
