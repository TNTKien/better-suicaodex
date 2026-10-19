/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist"
import { ExpirationPlugin, NetworkFirst, Serwist } from "serwist"

import {
  COVER_CACHE_MAX_AGE_SECONDS,
  COVER_CACHE_MAX_ENTRIES,
  COVER_CACHE_NAME,
  createCoverCorsRequest,
  isCacheableCoverRequest,
  isCacheableCoverResponse,
} from "./cover-cache-policy"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const coverPolicyPlugin: SerwistPlugin = {
  requestWillFetch: async ({ request }) => createCoverCorsRequest(request),
  cacheWillUpdate: async ({ response }) =>
    isCacheableCoverResponse(response) ? response : null,
  handlerDidError: async ({ request }) => fetch(request),
}

const coverStrategy = new NetworkFirst({
  cacheName: COVER_CACHE_NAME,
  networkTimeoutSeconds: 3,
  plugins: [
    coverPolicyPlugin,
    new ExpirationPlugin({
      maxAgeSeconds: COVER_CACHE_MAX_AGE_SECONDS,
      maxEntries: COVER_CACHE_MAX_ENTRIES,
      purgeOnQuotaError: true,
    }),
  ],
})

const serwist = new Serwist({
  clientsClaim: true,
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => isCacheableCoverRequest(request, url),
      handler: coverStrategy,
    },
  ],
  skipWaiting: true,
})

serwist.addEventListeners()
