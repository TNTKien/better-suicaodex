import { describe, expect, test } from "bun:test"

import { parseRuntimeEnv } from "../../src/shared/env"
import { createChapterStorage } from "../../src/shared/storage"

const valid = {
  NODE_ENV: "development",
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:password@localhost/redive",
  BETTER_AUTH_SECRET: "a-secure-test-secret-with-32-characters",
  BETTER_AUTH_URL: "http://localhost:3001",
  DISCORD_CLIENT_ID: "discord-id",
  DISCORD_CLIENT_SECRET: "discord-secret",
  ASSET_BASE_URL: "https://assets.example.com/",
}

describe("runtime environment", () => {
  test("normalizes origins and applies cache defaults", () => {
    const env = parseRuntimeEnv({
      ...valid,
      WEB_ORIGIN: "http://localhost:3000/",
    })

    expect(env.WEB_ORIGIN).toBe("http://localhost:3000")
    expect(env.WEB_ALLOWED_ORIGINS).toEqual([])
    expect(env.HIDE_R18).toBe(true)
    expect(env.HIDDEN_MANGA_IDS).toEqual([])
    expect(env.REDIS_CACHE_ENABLED).toBe(false)
    expect(env.ENDPOINT_CACHE_HOMEPAGE_TTL_SECONDS).toBe(45)
    expect(env.ENDPOINT_CACHE_MANGA_RANKING_TTL_SECONDS).toBe(90)
    expect(env.INTERNAL_API_KEY).toBeUndefined()
    expect(env.INTERNAL_API_RATE_LIMIT_PER_SECOND).toBe(100)
    expect(env.TRUSTED_PROXY_IPS).toEqual([])
    expect(env.DISCORD_GROUP_REVIEW_WEBHOOK_URL).toBeUndefined()
    expect(env.DISCORD_GROUP_REVIEW_MENTION_USER_ID).toBeUndefined()
    expect(env.S3_STAGING_BUCKET).toBeUndefined()
    expect(env.AVATAR_FRAMES_ENABLED).toBe(false)
    expect(env.COIN_ENABLED).toBe(false)
    expect(env.SHOP_ENABLED).toBe(false)
    expect(env.GACHA_ENABLED).toBe(false)
    expect(env.COIN_EXCLUDED_GROUP_IDS).toEqual([])
    expect(
      parseRuntimeEnv({ ...valid, COIN_ENABLED: "true" }).COIN_ENABLED
    ).toBe(true)
    expect(
      parseRuntimeEnv({
        ...valid,
        COIN_EXCLUDED_GROUP_IDS: "group-1, group-1,group-2",
      }).COIN_EXCLUDED_GROUP_IDS
    ).toEqual(["group-1", "group-2"])
    expect(() => parseRuntimeEnv({ ...valid, COIN_ENABLED: "yes" })).toThrow(
      "COIN_ENABLED"
    )
    expect(
      parseRuntimeEnv({ ...valid, AVATAR_FRAMES_ENABLED: "true" })
        .AVATAR_FRAMES_ENABLED
    ).toBe(true)
  })

  test("Discord group review alerts require a valid webhook and one user ID together", () => {
    const webhook =
      "https://discord.com/api/webhooks/123456789012345678/private-token"
    const mention = "234567890123456789"
    const env = parseRuntimeEnv({
      ...valid,
      DISCORD_GROUP_REVIEW_WEBHOOK_URL: ` ${webhook} `,
      DISCORD_GROUP_REVIEW_MENTION_USER_ID: ` ${mention} `,
    })
    expect(env.DISCORD_GROUP_REVIEW_WEBHOOK_URL).toBe(webhook)
    expect(env.DISCORD_GROUP_REVIEW_MENTION_USER_ID).toBe(mention)
    expect(
      parseRuntimeEnv({
        ...valid,
        DISCORD_GROUP_REVIEW_WEBHOOK_URL: " ",
        DISCORD_GROUP_REVIEW_MENTION_USER_ID: "",
      }).DISCORD_GROUP_REVIEW_WEBHOOK_URL
    ).toBeUndefined()
    expect(() =>
      parseRuntimeEnv({ ...valid, DISCORD_GROUP_REVIEW_WEBHOOK_URL: webhook })
    ).toThrow("DISCORD_GROUP_REVIEW_MENTION_USER_ID")
    expect(() =>
      parseRuntimeEnv({
        ...valid,
        DISCORD_GROUP_REVIEW_MENTION_USER_ID: mention,
      })
    ).toThrow("DISCORD_GROUP_REVIEW_WEBHOOK_URL")

    for (const url of [
      webhook.replace("https:", "http:"),
      webhook.replace("discord.com", "discord.com.evil.test"),
      webhook.replace("discord.com", "localhost"),
      webhook.replace("discord.com", "user:password@discord.com"),
      `${webhook}?redirect=private-token`,
      `${webhook}#private-token`,
    ]) {
      let message = ""
      try {
        parseRuntimeEnv({
          ...valid,
          DISCORD_GROUP_REVIEW_WEBHOOK_URL: url,
          DISCORD_GROUP_REVIEW_MENTION_USER_ID: mention,
        })
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).toContain("DISCORD_GROUP_REVIEW_WEBHOOK_URL")
      expect(message).not.toContain("private-token")
    }
    for (const id of [
      "someone",
      `<@${mention}>`,
      `@&${mention}`,
      "123",
      "0".repeat(18),
    ])
      expect(() =>
        parseRuntimeEnv({
          ...valid,
          DISCORD_GROUP_REVIEW_WEBHOOK_URL: webhook,
          DISCORD_GROUP_REVIEW_MENTION_USER_ID: id,
        })
      ).toThrow("DISCORD_GROUP_REVIEW_MENTION_USER_ID")
    expect(
      parseRuntimeEnv({
        ...valid,
        DISCORD_GROUP_REVIEW_WEBHOOK_URL: webhook.replace("/api/", "/api/v10/"),
        DISCORD_GROUP_REVIEW_MENTION_USER_ID: mention,
      }).DISCORD_GROUP_REVIEW_WEBHOOK_URL
    ).toContain("/api/v10/webhooks/")
  })

  test("Shop has an independent, strict opt-in flag", () => {
    const env = parseRuntimeEnv({ ...valid, SHOP_ENABLED: "true" })
    expect(env.SHOP_ENABLED).toBe(true)
    expect(env.COIN_ENABLED).toBe(false)
    expect(env.AVATAR_FRAMES_ENABLED).toBe(false)
    expect(
      parseRuntimeEnv({ ...valid, SHOP_ENABLED: "false" }).SHOP_ENABLED
    ).toBe(false)
    for (const value of ["yes", "1", "TRUE"])
      expect(() => parseRuntimeEnv({ ...valid, SHOP_ENABLED: value })).toThrow(
        "SHOP_ENABLED"
      )
  })

  test("gacha is an independent strict opt-in, not implied by Shop", () => {
    const env = parseRuntimeEnv({ ...valid, GACHA_ENABLED: "true" })
    expect(env.GACHA_ENABLED).toBe(true)
    expect(env.SHOP_ENABLED).toBe(false)
    expect(env.COIN_ENABLED).toBe(false)
    expect(env.AVATAR_FRAMES_ENABLED).toBe(false)
    expect(
      parseRuntimeEnv({ ...valid, SHOP_ENABLED: "true" }).GACHA_ENABLED
    ).toBe(false)
    for (const value of ["yes", "1", "TRUE"])
      expect(() => parseRuntimeEnv({ ...valid, GACHA_ENABLED: value })).toThrow(
        "GACHA_ENABLED"
      )
  })

  test("normalizes and deduplicates additional origins without changing the primary", () => {
    const env = parseRuntimeEnv({
      ...valid,
      WEB_ORIGIN: "http://localhost:3000/",
      WEB_ALLOWED_ORIGINS:
        " https://sfw.suicaodex.com/, https://sfw.suicaodex.com, , http://localhost:3000 ",
    })
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000")
    expect(env.WEB_ALLOWED_ORIGINS).toEqual([
      "https://sfw.suicaodex.com",
      "http://localhost:3000",
    ])
  })

  test("rejects comma lists in the primary origin and unsafe additional origins", () => {
    for (const key of ["WEB_ORIGIN", "BETTER_AUTH_URL"] as const)
      expect(() =>
        parseRuntimeEnv({
          ...valid,
          [key]: "http://localhost:3000,https://sfw.suicaodex.com",
        })
      ).toThrow(key)
    for (const value of [
      "*",
      "https://*.suicaodex.com",
      "ftp://suicaodex.com",
      "null",
      "not-a-url",
      "https://user:password@sfw.suicaodex.com",
      "https://sfw.suicaodex.com/path",
      "https://sfw.suicaodex.com/?query=yes",
      "https://sfw.suicaodex.com/#fragment",
      "https://sfw.suicaodex.com%2cevil.test",
    ])
      expect(() =>
        parseRuntimeEnv({ ...valid, WEB_ALLOWED_ORIGINS: value })
      ).toThrow("WEB_ALLOWED_ORIGINS")
  })

  test("validates the internal credential and trusted proxy list", () => {
    const env = parseRuntimeEnv({
      ...valid,
      INTERNAL_API_KEY: "x".repeat(32),
      INTERNAL_API_RATE_LIMIT_PER_SECOND: "80",
      TRUSTED_PROXY_IPS: "10.0.0.2, 2001:db8::1,10.0.0.2",
    })

    expect(env.INTERNAL_API_KEY).toBe("x".repeat(32))
    expect(env.INTERNAL_API_RATE_LIMIT_PER_SECOND).toBe(80)
    expect(env.TRUSTED_PROXY_IPS).toEqual(["10.0.0.2", "2001:db8::1"])

    const secret = "too-short"
    let message = ""
    try {
      parseRuntimeEnv({ ...valid, INTERNAL_API_KEY: secret })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain("INTERNAL_API_KEY")
    expect(message).not.toContain(secret)
    expect(() =>
      parseRuntimeEnv({ ...valid, TRUSTED_PROXY_IPS: "not-an-ip" })
    ).toThrow("TRUSTED_PROXY_IPS.0: must be an IP")
  })

  test("parses emergency content visibility overrides", () => {
    const env = parseRuntimeEnv({
      ...valid,
      HIDE_R18: "false",
      HIDDEN_MANGA_IDS:
        "11111111-1111-4111-8111-111111111111, 018f47a2-46ed-7189-8f5c-57d7aa9b1e4f,11111111-1111-4111-8111-111111111111",
      HIDDEN_CHAPTER_IDS: "22222222-2222-4222-8222-222222222222",
    })

    expect(env.HIDE_R18).toBe(false)
    expect(env.HIDDEN_MANGA_IDS).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "018f47a2-46ed-7189-8f5c-57d7aa9b1e4f",
    ])
    expect(env.HIDDEN_CHAPTER_IDS).toEqual([
      "22222222-2222-4222-8222-222222222222",
    ])
  })

  test("requires a Redis URL only when cache is enabled", () => {
    expect(() =>
      parseRuntimeEnv({ ...valid, REDIS_CACHE_ENABLED: "true" })
    ).toThrow("REDIS_URL: is required when REDIS_CACHE_ENABLED=true")
  })

  test("requires TLS for remote Redis connections", () => {
    expect(() =>
      parseRuntimeEnv({
        ...valid,
        REDIS_CACHE_ENABLED: "true",
        REDIS_URL: "redis://default:password@example.upstash.io:6379",
      })
    ).toThrow("REDIS_URL: remote connections must use rediss://")
  })

  test("requires an HTTP asset origin", () => {
    expect(() =>
      parseRuntimeEnv({ ...valid, ASSET_BASE_URL: "ftp://assets.example.com" })
    ).toThrow("ASSET_BASE_URL: must use the http or https protocol")
  })

  test("enables runtime storage only with a complete staging configuration", () => {
    const storage = {
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_BUCKET: "public",
      S3_STAGING_BUCKET: "private",
      S3_ENDPOINT: "https://s3.example.com",
      S3_REGION: "auto",
    }
    expect(parseRuntimeEnv({ ...valid, ...storage }).S3_BUCKET).toBe("public")
    expect(() =>
      parseRuntimeEnv({ ...valid, S3_STAGING_BUCKET: "private" })
    ).toThrow("S3_ACCESS_KEY_ID")
  })

  test("signs private staging preview URLs", async () => {
    const storage = createChapterStorage(
      parseRuntimeEnv({
        ...valid,
        S3_ACCESS_KEY_ID: "key",
        S3_SECRET_ACCESS_KEY: "secret",
        S3_BUCKET: "public",
        S3_STAGING_BUCKET: "private",
        S3_ENDPOINT: "https://s3.example.com",
        S3_REGION: "auto",
      })
    )!
    const url = new URL(await storage.previewUrl("chapters/page.webp", 60))

    expect(url.searchParams.get("X-Amz-Expires")).toBe("60")
    expect(url.searchParams.has("X-Amz-Signature")).toBe(true)
  })

  test("requires all production providers without exposing values", () => {
    const secretValue = "do-not-print-this-value"
    let message = ""
    try {
      parseRuntimeEnv({
        ...valid,
        NODE_ENV: "production",
        DATABASE_URL: `postgresql://user:${secretValue}@localhost/redive`,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain("GOOGLE_CLIENT_ID")
    expect(message).toContain("GITHUB_CLIENT_SECRET")
    expect(message).not.toContain(secretValue)
  })
})
