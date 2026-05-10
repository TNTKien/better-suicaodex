/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RouteHandlerCallback,
  SerwistGlobalConfig,
} from "serwist";
import {
  CacheExpiration,
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
  "cross-origin",
  "static-image-assets",
] as const;
const coverCacheExpirations = new Map<string, CacheExpiration>();

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

function getCoverCacheExpiration(cacheName: string) {
  let expiration = coverCacheExpirations.get(cacheName);

  if (!expiration) {
    expiration = new CacheExpiration(cacheName, {
      maxEntries: COVER_CACHE_MAX_ENTRIES,
      maxAgeSeconds: COVER_CACHE_MAX_AGE_SECONDS,
    });
    coverCacheExpirations.set(cacheName, expiration);
  }

  return expiration;
}

function createCorsCoverCacheHandler(cacheName: string): RouteHandlerCallback {
  return async ({ request }) => {
    const cache = await caches.open(cacheName);
    const expiration = getCoverCacheExpiration(cacheName);
    const cachedResponse = await cache.match(request.url);

    if (cachedResponse && !(await expiration.isURLExpired(request.url))) {
      await expiration.updateTimestamp(request.url);
      void expiration.expireEntries();
      return cachedResponse;
    }

    if (cachedResponse) {
      await cache.delete(request.url);
    }

    try {
      const corsRequest = new Request(request.url, {
        credentials: "omit",
        mode: "cors",
        redirect: "follow",
      });
      const response = await fetch(corsRequest);

      if (response.status === 200) {
        await cache.put(request.url, response.clone());
        await expiration.updateTimestamp(request.url);
        void expiration.expireEntries();
        return response;
      }
    } catch {
      // Fall back to the original no-cors request so the image can still render.
    }

    return fetch(request);
  };
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) =>
        request.destination === "image" && isSuicaodex512CoverUrl(url),
      handler: createCorsCoverCacheHandler(SUICAODEX_COVER_CACHE_NAME),
    },
    {
      matcher: ({ request, url }) =>
        request.destination === "image" &&
        url.protocol === "https:" &&
        url.hostname === "u.truyen.moe" &&
        url.pathname.startsWith("/uploads/covers/"),
      handler: createCorsCoverCacheHandler(TRUYEN_MOE_COVER_CACHE_NAME),
    },
    // Chặn defaultCache của Serwist cache ảnh cross-origin ngoài các cover
    // cache chủ đích ở trên; vẫn cho phép cache ảnh tối ưu Next cùng origin.
    {
      matcher: ({ request, sameOrigin }) =>
        request.destination === "image" && !sameOrigin,
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
