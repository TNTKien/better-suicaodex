import "server-only"

import { cacheLife } from "next/cache"
import { getManga as requestManga } from "./server"

export async function getManga<T>(id: string): Promise<T | null> {
  "use cache: private"
  // Visibility-sensitive data must not survive across server requests.
  cacheLife({ stale: 30 })
  return requestManga<T>(id)
}
