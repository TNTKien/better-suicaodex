/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const MIN_IMAGE_SIZE_BYTES = 1024;
const ONE_DAY_IN_SECONDS = 86400;

function createImageCacheHandler({
  cacheName,
  maxEntries,
  maxAgeDays,
}: {
  cacheName: string;
  maxEntries: number;
  maxAgeDays: number;
}) {
  return new CacheFirst({
    cacheName,
    // Force CORS mode để tránh opaque response (status 0) từ no-cors requests
    fetchOptions: {
      mode: "cors",
      credentials: "omit",
    },
    plugins: [
      new ExpirationPlugin({
        maxEntries,
        maxAgeSeconds: ONE_DAY_IN_SECONDS * maxAgeDays,
        purgeOnQuotaError: true,
      }),
      {
        // Không cache ảnh lỗi (< 1KB) hoặc status !== 200
        async cacheWillUpdate({ response }) {
          try {
            if (response.status !== 200) return null;
            const blob = await response.clone().blob();
            if (blob.size < MIN_IMAGE_SIZE_BYTES) return null;
          } catch {
            return null;
          }
          return response;
        },
      },
    ],
  });
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Không cache API calls từ weebdex
    {
      matcher: ({ url }) =>
        url.hostname === "wd.memaydex.online" &&
        !url.pathname.startsWith("/covers/"),
      handler: new NetworkOnly(),
    },
    // Không cache các internal API routes (comments, auth, v.v.)
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // Cache ảnh cover từ weebdex proxy (CacheFirst, 5 ngày, tối đa 500 ảnh)
    {
      matcher: ({ url }) =>
        url.hostname === "wd.memaydex.online" &&
        url.pathname.startsWith("/covers/"),
      handler: createImageCacheHandler({
        cacheName: "weebdex-covers",
        maxEntries: 500,
        maxAgeDays: 5,
      }),
    },
    // {
    //   matcher: ({ url }) =>
    //     url.hostname === "moetruyen.net" &&
    //     url.pathname.startsWith("/uploads/covers/"),
    //   handler: createImageCacheHandler({
    //     cacheName: "moetruyen-covers",
    //     maxEntries: 500,
    //     maxAgeDays: 5,
    //   }),
    // },
    // {
    //   matcher: ({ url }) =>
    //     url.hostname === "i.moetruyen.net" &&
    //     url.pathname.startsWith("/chapters/"),
    //   handler: new NetworkOnly(),
    // },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
