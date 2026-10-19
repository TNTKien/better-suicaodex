import { describe, expect, test } from "bun:test"

import {
  engagementBucketDate,
  engagementWindowStart,
} from "../../src/features/ranking/engagement"

describe("ranking calendar", () => {
  test("uses Vietnam calendar boundaries for daily windows", () => {
    expect(engagementBucketDate(new Date("2026-09-06T16:59:59Z"))).toBe(
      "2026-09-06"
    )
    expect(engagementBucketDate(new Date("2026-09-06T17:00:00Z"))).toBe(
      "2026-09-07"
    )
    expect(engagementWindowStart(7, new Date("2026-09-06T17:00:00Z"))).toBe(
      "2026-09-01"
    )
  })
})
