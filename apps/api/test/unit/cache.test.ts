import { expect, test } from "bun:test"

import { stableHash } from "../../src/shared/cache"

test("cache identity is stable across query object key order", () => {
  expect(stableHash({ page: 2, tag: "action" })).toBe(
    stableHash({ tag: "action", page: 2 })
  )
  expect(stableHash({ page: 1 })).not.toBe(stableHash({ page: 2 }))
})
