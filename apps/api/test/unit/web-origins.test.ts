import { describe, expect, test } from "bun:test"

import {
  allowedWebOrigins,
  isTrustedWebOrigin,
} from "../../src/shared/web-origins"

const primary = "http://localhost:3000"
const additional = "https://sfw.suicaodex.com"

describe("web origin allowlist", () => {
  test("includes the primary origin and deduplicates exact additional origins", () => {
    expect(allowedWebOrigins(primary)).toEqual([primary])
    expect(
      allowedWebOrigins(primary, [additional, primary, additional])
    ).toEqual([primary, additional])
  })

  test("matches exact origins without wildcard, prefix or missing-origin bypasses", () => {
    const allowed = allowedWebOrigins(primary, [additional])
    expect(isTrustedWebOrigin(primary, allowed)).toBe(true)
    expect(isTrustedWebOrigin(additional, allowed)).toBe(true)
    expect(isTrustedWebOrigin(primary, primary)).toBe(true)
    expect(isTrustedWebOrigin(additional, primary)).toBe(false)
    for (const origin of [
      undefined,
      "",
      "null",
      "http://sfw.suicaodex.com",
      "https://sfw.suicaodex.com:444",
      "https://sfw.suicaodex.com.evil.test",
      "https://sfw.suicaodex.com/",
      "https://other.suicaodex.com",
      `${primary},${additional}`,
    ])
      expect(isTrustedWebOrigin(origin, allowed)).toBe(false)
    expect(isTrustedWebOrigin(primary, [])).toBe(false)
  })
})
