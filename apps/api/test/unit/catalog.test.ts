import { describe, expect, test } from "bun:test"

import {
  normalizeCatalogQuery,
  normalizeDecimal,
  recommendationTagThreshold,
  resolveAssetUrl,
  resolveCoverKey,
  resolveCoverUrl,
  resolveGroupLinks,
  resolveMangaLinks,
  resolvePersonLinks,
} from "../../src/features/catalog/routes"
import { MangaCatalogQuerySchema } from "../../src/features/catalog/contract"

describe("catalog queries", () => {
  test("uses SCD-compatible tag mode defaults and accepts explicit modes", () => {
    expect(MangaCatalogQuerySchema.parse({})).toMatchObject({
      includeTagMode: "and",
      excludeTagMode: "or",
      hasChapter: "true",
    })
    expect(
      MangaCatalogQuerySchema.parse({
        includeTagMode: "or",
        excludeTagMode: "and",
      })
    ).toMatchObject({ includeTagMode: "or", excludeTagMode: "and" })
    expect(
      MangaCatalogQuerySchema.parse({ hasChapter: "false" })
    ).toMatchObject({ hasChapter: "false" })
    expect(MangaCatalogQuerySchema.parse({ hasChapter: "all" })).toMatchObject({
      hasChapter: "all",
    })
    expect(
      MangaCatalogQuerySchema.safeParse({ hasChapter: "no" }).success
    ).toBe(false)
  })

  test("normalizes equivalent cache identities", () => {
    const base = {
      page: 1,
      limit: 20,
      sort: "latestChapter" as const,
      direction: "desc" as const,
      hasChapter: "true" as const,
      includeTagMode: "and" as const,
      excludeTagMode: "or" as const,
      status: undefined,
      language: "PT-BR",
      excludeTag: ["00000000-0000-4000-8000-000000000003"],
      author: [],
      artist: [],
      group: [],
    }
    const left = normalizeCatalogQuery({
      ...base,
      q: "  Wise   Lover ",
      includeTag: [
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000001",
      ],
    })
    const right = normalizeCatalogQuery({
      ...base,
      q: "wise lover",
      includeTag: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "00000000-0000-4000-8000-000000000001",
      ],
    })

    expect(left).toEqual(right)
    expect(left.language).toBe("pt-br")
  })

  test("requires all sparse recommendation tags and caps dense matches at three", () => {
    expect([0, 1, 2, 3, 8].map(recommendationTagThreshold)).toEqual([
      0, 1, 2, 3, 3,
    ])
  })
})

describe("catalog assets", () => {
  test("resolves only relative storage keys", () => {
    expect(
      resolveAssetUrl(
        "https://assets.example.com/root",
        "covers/manga/cover.webp"
      )
    ).toBe("https://assets.example.com/root/covers/manga/cover.webp")
    expect(() =>
      resolveAssetUrl("https://assets.example.com", "/cover.webp")
    ).toThrow()
    expect(() =>
      resolveAssetUrl(
        "https://assets.example.com",
        "https://evil.example/cover.webp"
      )
    ).toThrow()
    expect(() =>
      resolveAssetUrl("https://assets.example.com/root", "../cover.webp")
    ).toThrow()
  })

  test("uses the 512px variant for native manga covers", () => {
    expect(resolveCoverKey("covers/manga/cover.512.webp")).toBe(
      "covers/manga/cover.512.webp"
    )
    expect(resolveCoverKey("covers/manga/cover.jpg")).toBe(
      "covers/manga/cover.jpg"
    )
    expect(
      resolveCoverUrl(
        "http://localhost:9000",
        "covers/f9a5ed37-bdac-454f-8ba6-3b445abdd2f8/bcdd9868-91a7-4829-8fd9-a61715ca005b.webp"
      )
    ).toBe(
      "http://localhost:9000/covers/f9a5ed37-bdac-454f-8ba6-3b445abdd2f8/bcdd9868-91a7-4829-8fd9-a61715ca005b.512.webp"
    )
    expect(
      resolveCoverUrl(
        "https://assets.example.com",
        "covers/018f47a2-46ed-7189-8f5c-57d7aa9b1e4f/018f47a2-46ed-7189-8f5c-57d7aa9b1e50.webp"
      )
    ).toBe(
      "https://assets.example.com/covers/018f47a2-46ed-7189-8f5c-57d7aa9b1e4f/018f47a2-46ed-7189-8f5c-57d7aa9b1e50.512.webp"
    )
    expect(resolveCoverKey("covers/manga/cover.webp")).toBe(
      "covers/manga/cover.webp"
    )
  })
})

describe("catalog numbers", () => {
  test("formats exact PostgreSQL numeric values without fixed-scale zeros", () => {
    expect(normalizeDecimal("9.500")).toBe("9.5")
    expect(normalizeDecimal("24.000")).toBe("24")
    expect(normalizeDecimal(null)).toBeNull()
  })
})

describe("catalog external links", () => {
  test("resolves known identifiers and rejects unsafe or unknown links", () => {
    expect(
      resolveMangaLinks({
        al: "193582",
        ap: "sample-manga-1",
        bl: "ignored",
        bw: "series/244417",
        raw: "javascript:alert(1)",
      })
    ).toEqual([
      {
        key: "al",
        label: "AniList",
        url: "https://anilist.co/manga/193582",
      },
      {
        key: "ap",
        label: "Anime-Planet",
        url: "https://www.anime-planet.com/manga/sample-manga-1",
      },
      {
        key: "bw",
        label: "BookWalker",
        url: "https://bookwalker.jp/series/244417",
      },
    ])
    expect(resolveMangaLinks({ bw: "https://[", raw: "not a URL" })).toEqual([])
    expect(
      resolveMangaLinks({
        bw: "//example.com/series/1",
        raw: "https://bookwalker.jp@example.com/",
      })
    ).toEqual([])
    expect(resolveMangaLinks({ raw: "http://example.com/series/1" })).toEqual([
      { key: "raw", label: "Raw", url: "http://example.com/series/1" },
    ])
  })

  test("normalizes allowlisted group links", () => {
    expect(
      resolveGroupLinks({
        website: "https://scan.example/about",
        discord: "suicaodex",
        twitter: "@suicaodex",
        email: "ignored@example.com",
      })
    ).toEqual([
      {
        key: "website",
        label: "Website",
        url: "https://scan.example/about",
      },
      {
        key: "discord",
        label: "Discord",
        url: "https://discord.gg/suicaodex",
      },
      {
        key: "twitter",
        label: "X/Twitter",
        url: "https://x.com/suicaodex",
      },
    ])
    expect(
      resolveGroupLinks({
        website: "javascript:alert(1)",
        discord: "https://example.com/invite/suicaodex",
        twitter: "https://example.com/suicaodex",
      })
    ).toEqual([])
  })

  test("keeps only allowlisted person link hosts", () => {
    expect(
      resolvePersonLinks({
        website: "https://creator.example/about",
        twitter: "https://twitter.com/creator",
        pixiv: "https://www.pixiv.net/users/123",
        fanbox: "https://creator.fanbox.cc/",
        fantia: "https://fantia.jp/fanclubs/123",
        skeb: "https://skeb.jp/@creator",
        youtube: "https://www.youtube.com/@creator",
      })
    ).toHaveLength(7)
    expect(
      resolvePersonLinks({
        website: "javascript:alert(1)",
        twitter: "https://example.com/creator",
        pixiv: "https://pixiv.net.evil.example/users/123",
        fanbox: "https://evilfanbox.cc/creator",
        unknown: "https://creator.example",
      })
    ).toEqual([])
  })
})
