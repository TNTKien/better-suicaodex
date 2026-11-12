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

const loadManga = async (ids: string[]) => ids.map((id) => ({ id }))

describe.serial("random manga selection", () => {
  test("accepts only 1-10 manga and defaults to one", () => {
    expect(RandomMangaQuerySchema.parse({})).toEqual({ limit: 1 })
    expect(RandomMangaQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 })
    for (const limit of ["0", "11", "1.5", "abc", ""])
      expect(RandomMangaQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  test("samples again per request without mutating the pool or repeating IDs within a batch", async () => {
    const ids = ["a", "b", "c", "d"]
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => ids,
      loadManga
    )
    const random = spyOn(Math, "random")
    try {
      for (const [index, value] of [0, 0.25, 0.5, 0.99].entries()) {
        random.mockReturnValue(value)
        expect(await select(1)).toEqual([{ id: ids[index] }])
        const batch = await select(10)
        expect(batch).toHaveLength(4)
        expect(new Set(batch.map(({ id }) => id))).toEqual(new Set(ids))
      }
      expect(ids).toEqual(["a", "b", "c", "d"])
    } finally {
      random.mockRestore()
    }
  })

  test("shares one pool across limits for ten minutes even without Redis", async () => {
    let now = 0
    let loads = 0
    const clock = spyOn(performance, "now").mockImplementation(() => now)
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => [`pool-${++loads}`],
      loadManga
    )
    try {
      expect(await select(1)).toEqual([{ id: "pool-1" }])
      now = 599_999
      expect(await select(6)).toEqual([{ id: "pool-1" }])
      expect(await select(10)).toEqual([{ id: "pool-1" }])
      expect(loads).toBe(1)
      now = 600_000
      expect(await select(1)).toEqual([{ id: "pool-2" }])
      expect(loads).toBe(2)
    } finally {
      clock.mockRestore()
    }
  })

  test("coalesces pool loading but independently samples simultaneous requests", async () => {
    let loads = 0
    let reads = 0
    let release!: (ids: string[]) => void
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      () => {
        loads++
        return new Promise<string[]>((resolve) => {
          release = resolve
        })
      },
      async (ids) => {
        reads++
        return loadManga(ids)
      }
    )
    const random = spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
    try {
      const first = select(1)
      const second = select(1)
      await Promise.resolve()
      expect(loads).toBe(1)
      release(["a", "b"])
      expect(await first).toEqual([{ id: "a" }])
      expect(await second).toEqual([{ id: "b" }])
      expect(reads).toBe(2)
    } finally {
      random.mockRestore()
    }
  })

  test("caches an empty pool without loading manga details", async () => {
    let loads = 0
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => {
        loads++
        return []
      },
      async () => {
        throw new Error("Empty pools do not need hydration")
      }
    )
    expect(await select(1)).toEqual([])
    expect(await select(10)).toEqual([])
    expect(loads).toBe(1)
  })

  test("keys the Redis pool by visibility without limit and keeps its original lifetime", async () => {
    let hit: string[] | null = ["shared-id"]
    let loads = 0
    const cache = {
      async get<T>(resource: string, identity: unknown): Promise<T | null> {
        expect(resource).toBe("manga:random-pool")
        expect(identity).toEqual({
          hideR18: true,
          hiddenMangaIds: ["hidden-id"],
        })
        return hit as T | null
      },
      async set(resource: string, _identity: unknown, ids: unknown) {
        expect(resource).toBe("manga:random-pool")
        expect(ids).toEqual(["fresh-id"])
        return true
      },
    }
    const select = createRandomMangaSelector(
      cache,
      { hideR18: true, hiddenMangaIds: ["hidden-id"] },
      async () => {
        loads++
        return ["fresh-id"]
      },
      loadManga
    )
    expect(await select(1)).toEqual([{ id: "shared-id" }])
    expect(await select(6)).toEqual([{ id: "shared-id" }])
    expect(loads).toBe(0)
    hit = null
    expect(await select(1)).toEqual([{ id: "fresh-id" }])
    expect(loads).toBe(1)
  })

  test("refreshes stale IDs and fills a batch while preserving valid results", async () => {
    let loads = 0
    const reads: string[][] = []
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => (++loads === 1 ? ["hidden", "b", "c"] : ["b", "c", "d"]),
      async (ids) => {
        reads.push(ids)
        return loadManga(ids.filter((id) => id !== "hidden"))
      }
    )
    const random = spyOn(Math, "random").mockReturnValue(0)
    try {
      expect(await select(2)).toEqual([{ id: "c" }, { id: "b" }])
      expect(reads).toEqual([["hidden", "c"], ["b"]])
      expect(loads).toBe(2)
      expect(await select(3)).toHaveLength(3)
      expect(loads).toBe(2)
    } finally {
      random.mockRestore()
    }
  })

  test("refreshes once when the whole catalog becomes unavailable", async () => {
    let loads = 0
    let reads = 0
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => (++loads === 1 ? ["hidden"] : []),
      async () => {
        reads++
        return []
      }
    )
    expect(await select(1)).toEqual([])
    expect(loads).toBe(2)
    expect(reads).toBe(1)
    expect(await select(1)).toEqual([])
    expect(loads).toBe(2)
  })

  test("bounds retries if visibility changes again during hydration", async () => {
    let loads = 0
    let reads = 0
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => {
        loads++
        return ["a", "b", "c"]
      },
      async () => {
        reads++
        return []
      }
    )
    expect(await select(1)).toEqual([])
    expect(loads).toBe(2)
    expect(reads).toBe(2)
  })

  test("does not cache failures or leave a pool request stuck", async () => {
    let loads = 0
    let reads = 0
    const select = createRandomMangaSelector(
      disabledCache,
      {},
      async () => {
        if (++loads === 1) throw new Error("Database unavailable")
        return ["recovered-id"]
      },
      async (ids) => {
        if (++reads === 1) throw new Error("Hydration failed")
        return loadManga(ids)
      }
    )
    await expect(select(1)).rejects.toThrow("Database unavailable")
    await expect(select(1)).rejects.toThrow("Hydration failed")
    expect(await select(1)).toEqual([{ id: "recovered-id" }])
    expect(loads).toBe(2)
  })
})
