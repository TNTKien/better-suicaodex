import { describe, expect, spyOn, test } from "bun:test"

import { RandomMangaQuerySchema } from "../../src/features/catalog/contract"
import { createRandomMangaSelector } from "../../src/features/catalog/random"
import type { BusinessCache } from "../../src/shared/cache"

const disabledCache = {
  async get<T>(): Promise<T | null> {
    return null
  },
  async set() {
    return false
  },
} satisfies Pick<BusinessCache, "get" | "set">

describe.serial("random manga selection", () => {
  test("accepts only 1-10 manga and defaults to one", () => {
    expect(RandomMangaQuerySchema.parse({})).toEqual({ limit: 1 })
    expect(RandomMangaQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 })
    for (const limit of ["0", "11", "1.5", "abc", ""])
      expect(RandomMangaQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  test("reuses each selection for ten minutes even without Redis", async () => {
    let now = 0
    let loads = 0
    const clock = spyOn(performance, "now").mockImplementation(() => now)
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async (limit) => {
        loads++
        return Array.from({ length: limit }, (_, index) => `${loads}-${index}`)
      }
    )
    try {
      const first = await select(5)
      now = 599_999
      expect(await select(5)).toEqual(first)
      expect(loads).toBe(1)
      expect(await select(1)).toHaveLength(1)
      expect(loads).toBe(2)
      now = 600_000
      expect(await select(5)).not.toEqual(first)
      expect(loads).toBe(3)
    } finally {
      clock.mockRestore()
    }
  })

  test("coalesces simultaneous requests and caches an empty selection", async () => {
    let loads = 0
    let release!: (ids: string[]) => void
    const select = createRandomMangaSelector(disabledCache, {}, () => {
      loads++
      return new Promise<string[]>((resolve) => {
        release = resolve
      })
    })
    const first = select(5)
    const second = select(5)
    await Promise.resolve()
    expect(loads).toBe(1)
    release([])
    expect(await first).toEqual([])
    expect(await second).toEqual([])
    expect(await select(5)).toEqual([])
    expect(loads).toBe(1)
  })

  test("uses shared Redis IDs with visibility in the key and does not extend their lifetime", async () => {
    let hit: string[] | null = ["shared-id"]
    let identity: unknown
    let loads = 0
    const cache = {
      async get<T>(resource: string, value: unknown): Promise<T | null> {
        expect(resource).toBe("manga:random")
        identity = value
        return hit as T | null
      },
      async set() {
        return true
      },
    }
    const select = createRandomMangaSelector(
      cache,
      { hideR18: true, hiddenMangaIds: ["hidden-id"] },
      async () => {
        loads++
        return ["fresh-id"]
      }
    )
    expect(await select(5)).toEqual(["shared-id"])
    expect(identity).toEqual({
      limit: 5,
      hideR18: true,
      hiddenMangaIds: ["hidden-id"],
    })
    expect(loads).toBe(0)
    hit = null
    expect(await select(5)).toEqual(["fresh-id"])
    expect(loads).toBe(1)
  })

  test("does not cache failures or leave an in-flight request stuck", async () => {
    let loads = 0
    const select = createRandomMangaSelector(disabledCache, {}, async () => {
      if (++loads === 1) throw new Error("Database unavailable")
      return ["recovered-id"]
    })
    await expect(select(5)).rejects.toThrow("Database unavailable")
    expect(await select(5)).toEqual(["recovered-id"])
    expect(loads).toBe(2)
  })
})
