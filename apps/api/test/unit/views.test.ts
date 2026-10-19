import { describe, expect, test } from "bun:test"
import { addHours, addSeconds } from "date-fns"

import {
  CHAPTER_VIEW_WINDOW_SECONDS,
  chapterViewThreshold,
  createChapterViewToken,
  verifyChapterViewToken,
} from "../../src/features/views/tracking"

describe("chapter view tracking", () => {
  test("uses a strict page majority and a session-bound expiring token", () => {
    expect([0, 1, 10, 20].map(chapterViewThreshold)).toEqual([1, 1, 6, 11])

    const now = new Date("2026-09-09T00:00:00.000Z")
    const token = createChapterViewToken(
      "0199301d-cd89-7000-8000-000000000001",
      "0199301d-cd89-7000-8000-000000000002",
      "test-secret-with-at-least-thirty-two-bytes",
      now
    )
    expect(
      verifyChapterViewToken(
        token,
        "0199301d-cd89-7000-8000-000000000001",
        "0199301d-cd89-7000-8000-000000000002",
        "test-secret-with-at-least-thirty-two-bytes",
        addSeconds(now, 1)
      )
    ).toEqual({ startedAt: now.getTime() })
    expect(
      verifyChapterViewToken(
        token,
        "0199301d-cd89-7000-8000-000000000001",
        "another-session",
        "test-secret-with-at-least-thirty-two-bytes",
        addSeconds(now, 1)
      )
    ).toBeNull()
    expect(
      verifyChapterViewToken(
        token,
        "0199301d-cd89-7000-8000-000000000001",
        "0199301d-cd89-7000-8000-000000000002",
        "test-secret-with-at-least-thirty-two-bytes",
        addHours(now, CHAPTER_VIEW_WINDOW_SECONDS / 3_600 + 1)
      )
    ).toBeNull()
  })
})
