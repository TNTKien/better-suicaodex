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

const COVER_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const coverCachePlugins = [
  new CacheableResponsePlugin({
    statuses: [0, 200],
  }),
  new ExpirationPlugin({
    maxEntries: 500,
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
      matcher: ({ url }) =>
        url.protocol === "https:" &&
        url.hostname === "i.suicaodex.com" &&
        url.pathname.startsWith("/covers/"),
      handler: new CacheFirst({
        cacheName: "suicaodex-cover-images",
        plugins: coverCachePlugins,
      }),
    },
    {
      matcher: ({ url }) =>
        url.protocol === "https:" &&
        url.hostname === "u.truyen.moe" &&
        url.pathname.startsWith("/uploads/covers/"),
      handler: new CacheFirst({
        cacheName: "truyen-moe-cover-images",
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

serwist.addEventListeners();
