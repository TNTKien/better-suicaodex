import { expect, test } from "bun:test"

import { groupSlug } from "../../src/features/groups/service"

test("groupSlug transliterates Vietnamese and removes emoji", () => {
  expect(groupSlug("Đặng Thái Sơn 😀")).toBe("dang-thai-son")
  expect(groupSlug("日本語 😀")).toBe("untitled")
})

test("groupSlug does not leave a trailing separator when truncated", () => {
  expect(groupSlug(`${"a".repeat(59)} b`)).toBe("a".repeat(59))
})
