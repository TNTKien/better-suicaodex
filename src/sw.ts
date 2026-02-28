/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

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
    // Cache ảnh cover từ weebdex proxy
    {
      matcher: ({ url }) =>
        url.hostname === "wd.memaydex.online" &&
        url.pathname.startsWith("/covers/"),
      handler: new CacheFirst({
        cacheName: "weebdex-covers",
        plugins: [
          new ExpirationPlugin({
            // Tối đa 1000 ảnh, hết hạn sau 7 ngày
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
    ...defaultCache,
  ],
});

serwist.addEventListeners();
