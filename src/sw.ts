/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const COVER_CACHE_MAX_ENTRIES = 200;
const COVER_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SUICAODEX_COVER_CACHE_NAME = "suicaodex-cover-images";
const TRUYEN_MOE_COVER_CACHE_NAME = "truyen-moe-cover-images";
const LEGACY_COVER_CACHE_NAMES = ["moetruyen-cover-images"] as const;

function isSuicaodex512CoverUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    url.hostname === "i.suicaodex.com" &&
    url.pathname.startsWith("/covers/") &&
    url.pathname.endsWith(".512.webp")
  );
}

async function deleteLegacyCoverCaches() {
  await Promise.all(
    LEGACY_COVER_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)),
  );
}

async function pruneSuicaodexCoverCache(existingCacheNames: string[]) {
  if (!existingCacheNames.includes(SUICAODEX_COVER_CACHE_NAME)) return;

  const cache = await caches.open(SUICAODEX_COVER_CACHE_NAME);
  const requests = await cache.keys();

  await Promise.all(
    requests.map((request) => {
      const url = new URL(request.url);

      if (isSuicaodex512CoverUrl(url)) {
        return Promise.resolve(false);
      }

      return cache.delete(request);
    }),
  );
}

async function deleteOversizedCoverCache(
  cacheName: string,
  existingCacheNames: string[],
) {
  if (!existingCacheNames.includes(cacheName)) return;

  const cache = await caches.open(cacheName);
  const requests = await cache.keys();

  if (requests.length > COVER_CACHE_MAX_ENTRIES) {
    await caches.delete(cacheName);
  }
}

async function cleanupCoverCaches() {
  await deleteLegacyCoverCaches();

  const existingCacheNames = await caches.keys();

  await pruneSuicaodexCoverCache(existingCacheNames);
  await Promise.all(
    [SUICAODEX_COVER_CACHE_NAME, TRUYEN_MOE_COVER_CACHE_NAME].map(
      (cacheName) => deleteOversizedCoverCache(cacheName, existingCacheNames),
    ),
  );
}

const coverCachePlugins = [
  new CacheableResponsePlugin({
    statuses: [0, 200],
  }),
  new ExpirationPlugin({
    maxEntries: COVER_CACHE_MAX_ENTRIES,
    maxAgeSeconds: COVER_CACHE_MAX_AGE_SECONDS,
    purgeOnQuotaError: true,
  }),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => isSuicaodex512CoverUrl(url),
      handler: new CacheFirst({
        cacheName: SUICAODEX_COVER_CACHE_NAME,
        plugins: coverCachePlugins,
      }),
    },
    {
      matcher: ({ url }) =>
        url.protocol === "https:" &&
        url.hostname === "u.truyen.moe" &&
        url.pathname.startsWith("/uploads/covers/"),
      handler: new CacheFirst({
        cacheName: TRUYEN_MOE_COVER_CACHE_NAME,
        plugins: coverCachePlugins,
      }),
    },
    // Không cache API calls từ weebdex
    {
      matcher: ({ url }) => url.hostname === "wd.suicaodex.com",
      handler: new NetworkOnly(),
    },
    // Không cache các internal API routes (comments, auth, v.v.)
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanupCoverCaches());
});

serwist.addEventListeners();
