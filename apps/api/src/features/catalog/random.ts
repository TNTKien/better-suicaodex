import {
  randomMangaTtlSeconds,
  type BusinessCache,
} from "../../shared/cache.js"
import type { CatalogVisibility } from "./routes.js"

export function createRandomMangaSelector(
  cache: Pick<BusinessCache, "get" | "set">,
  visibility: CatalogVisibility,
  load: (limit: number) => Promise<string[]>
) {
  const selections = new Map<number, { ids: string[]; expiresAt: number }>()
  const pending = new Map<number, Promise<string[]>>()

  return (limit: number): Promise<string[]> => {
    const selection = selections.get(limit)
    if (selection && selection.expiresAt > performance.now())
      return Promise.resolve(selection.ids)
    const inFlight = pending.get(limit)
    if (inFlight) return inFlight

    const request = (async () => {
      const identity = { limit, ...visibility }
      const hit = await cache.get<string[]>("manga:random", identity)
      // Redis hits keep their original TTL; only newly selected IDs enter memory.
      if (hit !== null) return hit
      const ids = await load(limit)
      await cache.set("manga:random", identity, ids)
      selections.set(limit, {
        ids,
        expiresAt: performance.now() + randomMangaTtlSeconds * 1_000,
      })
      return ids
    })().finally(() => pending.delete(limit))
    pending.set(limit, request)
    return request
  }
}
