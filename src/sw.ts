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
const DEFAULT_IMAGE_CACHE_NAMES = [
  "next-image",
  "cross-origin",
  "static-image-assets",
] as const;

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

async function deleteDefaultImageCaches() {
  await Promise.all(
    DEFAULT_IMAGE_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)),
  );
}

async function pruneCoverCache(
  cacheName: string,
  existingCacheNames: string[],
  isAllowedUrl: (url: URL) => boolean,
) {
  if (!existingCacheNames.includes(cacheName)) return;

  const cache = await caches.open(cacheName);
  const requests = await cache.keys();

  await Promise.all(
    requests.map(async (request) => {
      const url = new URL(request.url);

      if (!isAllowedUrl(url)) {
        return cache.delete(request);
      }

      const response = await cache.match(request);

      if (response?.type === "opaque") {
        return cache.delete(request);
      }

      return false;
    }),
  );
}

async function pruneSuicaodexCoverCache(existingCacheNames: string[]) {
  if (!existingCacheNames.includes(SUICAODEX_COVER_CACHE_NAME)) return;

  await pruneCoverCache(
    SUICAODEX_COVER_CACHE_NAME,
    existingCacheNames,
    isSuicaodex512CoverUrl,
  );
}

async function pruneTruyenMoeCoverCache(existingCacheNames: string[]) {
  await pruneCoverCache(
    TRUYEN_MOE_COVER_CACHE_NAME,
    existingCacheNames,
    (url) =>
      url.protocol === "https:" &&
      url.hostname === "u.truyen.moe" &&
      url.pathname.startsWith("/uploads/covers/"),
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
  await Promise.all([deleteLegacyCoverCaches(), deleteDefaultImageCaches()]);

  const existingCacheNames = await caches.keys();

  await pruneSuicaodexCoverCache(existingCacheNames);
  await pruneTruyenMoeCoverCache(existingCacheNames);
  await Promise.all(
    [SUICAODEX_COVER_CACHE_NAME, TRUYEN_MOE_COVER_CACHE_NAME].map(
      (cacheName) => deleteOversizedCoverCache(cacheName, existingCacheNames),
    ),
  );
}

const coverCachePlugins = [
  new CacheableResponsePlugin({
    statuses: [200],
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
      matcher: ({ request, url }) =>
        request.mode === "cors" && isSuicaodex512CoverUrl(url),
      handler: new CacheFirst({
        cacheName: SUICAODEX_COVER_CACHE_NAME,
        plugins: coverCachePlugins,
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.mode === "cors" &&
        url.protocol === "https:" &&
        url.hostname === "u.truyen.moe" &&
        url.pathname.startsWith("/uploads/covers/"),
      handler: new CacheFirst({
        cacheName: TRUYEN_MOE_COVER_CACHE_NAME,
        plugins: coverCachePlugins,
      }),
    },
    // Chặn defaultCache của Serwist cache ảnh tối ưu Next và ảnh cross-origin
    // ngoài các cover cache chủ đích ở trên; các cache này dễ phình rất lớn.
    {
      matcher: ({ request, sameOrigin, url }) =>
        request.destination === "image" &&
        (url.pathname === "/_next/image" || !sameOrigin),
      handler: new NetworkOnly(),
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
