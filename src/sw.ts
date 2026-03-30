/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Không cache API calls từ weebdex (phải luôn fetch mới)
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
    // Cache ảnh cover từ weebdex proxy (CacheFirst, 7 ngày, tối đa 1000 ảnh)
    {
      matcher: ({ url }) =>
        url.hostname === "wd.memaydex.online" &&
        url.pathname.startsWith("/covers/"),
      handler: new CacheFirst({
        cacheName: "weebdex-covers",
        // Force CORS mode để tránh opaque response (status 0) từ no-cors requests
        fetchOptions: {
          mode: "cors",
          credentials: "omit",
        },
        plugins: [
          new ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 60 * 60 * 24 * 7,
            purgeOnQuotaError: true,
          }),
          {
            // Không cache ảnh lỗi (< 1KB) hoặc status !== 200
            async cacheWillUpdate({ response }) {
              try {
                if (response.status !== 200) return null;
                const blob = await response.clone().blob();
                if (blob.size < 1024) return null;
              } catch {
                return null;
              }
              return response;
            },
          },
        ],
      }),
    },
    // Tránh cache/fallback cho ảnh chapter Moetruyen để không trả về opaque response
    // (gây lỗi CORS ngẫu nhiên khi reader tải ảnh bằng XHR mode=cors).
    {
      matcher: ({ url }) =>
        url.hostname === "i.moetruyen.net" &&
        url.pathname.startsWith("/chapters/"),
      method: "GET",
      handler: new NetworkOnly({
        fetchOptions: {
          mode: "cors",
          credentials: "omit",
        },
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
