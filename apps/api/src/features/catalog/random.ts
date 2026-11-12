import {
  randomMangaPoolTtlSeconds,
  type BusinessCache,
} from "../../shared/cache.js"
import type { CatalogVisibility } from "./routes.js"

function sampleIds(ids: string[], limit: number) {
  const selected: string[] = []
  // Partial Fisher-Yates keeps each request from copying the entire pool.
  const swaps = new Map<number, number>()
  for (
    let remaining = ids.length;
    remaining > 0 && selected.length < limit;
    remaining--
  ) {
    const index = Math.floor(Math.random() * remaining)
    selected.push(ids[swaps.get(index) ?? index]!)
    swaps.set(index, swaps.get(remaining - 1) ?? remaining - 1)
  }
  return selected
}

export function createRandomMangaSelector<T extends { id: string }>(
  cache: Pick<BusinessCache, "get" | "set">,
  visibility: CatalogVisibility,
  loadPool: () => Promise<string[]>,
  loadManga: (ids: string[]) => Promise<T[]>
) {
  let pool: { ids: string[]; expiresAt: number } | undefined
  let pending: Promise<string[]> | undefined

  function getPool(refresh = false): Promise<string[]> {
    if (!refresh && pool && pool.expiresAt > performance.now())
      return Promise.resolve(pool.ids)
    if (pending) return pending

    pending = (async () => {
      if (!refresh) {
        const hit = await cache.get<string[]>("manga:random-pool", visibility)
        // Redis hits keep their original TTL; only freshly loaded pools enter memory.
        if (hit !== null) return hit
      }
      const ids = await loadPool()
      await cache.set("manga:random-pool", visibility, ids)
      pool = {
        ids,
        expiresAt: performance.now() + randomMangaPoolTtlSeconds * 1_000,
      }
      return ids
    })().finally(() => {
      pending = undefined
    })
    return pending
  }

  return async (limit: number): Promise<T[]> => {
    const ids = sampleIds(await getPool(), limit)
    if (ids.length === 0) return []
    const selected = await loadManga(ids)
    if (selected.length === ids.length) return selected

    // Refresh once after a visibility change instead of scanning stale IDs in a loop.
    const attempted = new Set(ids)
    const freshPool = await getPool(true)
    const replacements = sampleIds(
      freshPool.filter((id) => !attempted.has(id)),
      limit - selected.length
    )
    return replacements.length > 0
      ? [...selected, ...(await loadManga(replacements))]
      : selected
  }
}
