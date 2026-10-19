import { describe, expect, test } from "bun:test"
import {
  CoinAmountSchema,
  CoinOperationSchema,
  MAX_COIN,
  PositiveCoinAmountSchema,
} from "../../src/features/coin/contract"
import {
  createCoinService,
  type CoinTransaction,
} from "../../src/features/coin/service"

describe("coin foundation contract", () => {
  test("decimal strings retain BIGINT precision and reject ambiguous amounts", () => {
    for (const amount of ["0", "1", "9007199254740993", MAX_COIN.toString()])
      expect(CoinAmountSchema.parse(amount)).toBe(amount)
    for (const amount of [
      0,
      5,
      "-1",
      "1.5",
      "01",
      "+1",
      "1e3",
      " 5",
      "",
      (MAX_COIN + 1n).toString(),
    ])
      expect(CoinAmountSchema.safeParse(amount).success).toBe(false)
    expect(PositiveCoinAmountSchema.safeParse("0").success).toBe(false)
  })
  test("operations reject unknown fields and unsafe keys", () => {
    const operation = {
      key: "test:1",
      actorUserId: null,
      sourceType: "test",
      sourceId: "1",
      entries: [
        { owner: { kind: "user", id: "u" }, mode: "credit", amount: "5" },
      ],
    }
    expect(CoinOperationSchema.safeParse(operation).success).toBe(true)
    expect(
      CoinOperationSchema.safeParse({ ...operation, balance: "100" }).success
    ).toBe(false)
    expect(
      CoinOperationSchema.safeParse({ ...operation, key: " " }).success
    ).toBe(false)
    expect(
      CoinOperationSchema.safeParse({ ...operation, entries: [] }).success
    ).toBe(false)
  })
  test("disabled service rejects before accessing the transaction", async () => {
    await expect(
      createCoinService().apply({} as CoinTransaction, {} as never)
    ).rejects.toMatchObject({ code: "COIN_DISABLED" })
  })
})
