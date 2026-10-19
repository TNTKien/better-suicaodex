import { describe, expect, test } from "bun:test"
import { commentRewardWords } from "../../src/features/comments/text"
import { creditedTenthsForGroups } from "../../src/features/coin/views"
import { TransferInputSchema } from "../../src/features/coin/api-contract"

describe("coin reward rules", () => {
  test("counts visible word tokens, not markup or sticker names", () => {
    expect(commentRewardWords("Cảm ơn nhóm dịch")).toBe(4)
    expect(commentRewardWords("Cảm ơn nhóm dịch nhiều!")).toBe(5)
    expect(commentRewardWords("Cảm ơn nhóm dịch nhiều!".normalize("NFD"))).toBe(
      5
    )
    expect(commentRewardWords("a b c d e 1 2 3 4 5 😀 😍")).toBe(0)
    expect(commentRewardWords("12 34 ab cd ef")).toBe(5)
    expect(
      commentRewardWords("<div>Cảm ơn</div> [spoiler]nhóm dịch nhiều[/spoiler]")
    ).toBe(5)
    expect(
      commentRewardWords("[sticker:hsr_hello] :kyaru-vuong: :hsr-danheng:")
    ).toBe(0)
    expect(
      commentRewardWords("[spoiler][spoiler]Cảm ơn nhóm dịch nhiều[/spoiler]")
    ).toBe(5)
    expect(
      commentRewardWords("[nhóm](https://domain.com/path/extra/words) dịch")
    ).toBe(2)
    expect(commentRewardWords("&nbsp; &amp; &lt; &quot; &#39;")).toBe(0)
    expect(commentRewardWords("c&#7843;m ơn nhóm dịch nhiều")).toBe(5)
    expect(commentRewardWords("Cảm ơn *** *** nhiều")).toBe(3)
  })
  test("credited tenths follow half-up rounding without reallocating rounding loss/gain", () => {
    expect([0, 1, 2, 3, 4, 6, 20, 21].map(creditedTenthsForGroups)).toEqual([
      0, 10, 5, 3, 3, 2, 1, 0,
    ])
  })
  test("transfer input is positive precise strings with an operation ID and no forged owner", () => {
    const base = {
      recipientUserId: "user",
      amount: "9007199254740993",
      operationId: crypto.randomUUID(),
    }
    expect(TransferInputSchema.safeParse(base).success).toBe(true)
    for (const amount of [
      0,
      5,
      "0",
      "-1",
      "1.1",
      "05",
      "1e2",
      "9223372036854775808",
    ])
      expect(TransferInputSchema.safeParse({ ...base, amount }).success).toBe(
        false
      )
    expect(
      TransferInputSchema.safeParse({ ...base, actorUserId: "admin" }).success
    ).toBe(false)
  })
})
