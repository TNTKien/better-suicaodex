import { mangaSearchOptions as sharedSearchOptions } from "@workspace/catalog/search"
import type { components } from "@/src/lib/generated/api"

export {
  MangaSearchError,
  normalizeSearchQuery,
} from "@workspace/catalog/search"

export function mangaSearchOptions(apiBaseUrl: string, query: string) {
  return sharedSearchOptions<components["schemas"]["MangaList"]>(
    apiBaseUrl,
    query
  )
}
