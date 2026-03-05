"use client";

import { useEffect } from "react";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const browser = globalThis as {
  window?: unknown;
  navigator?: {
    serviceWorker?: {
      getRegistrations(): Promise<Array<{ unregister(): Promise<boolean> }>>;
      register(
        scriptURL: string,
        options?: { scope?: string },
      ): Promise<unknown>;
    };
  };
  caches?: {
    keys(): Promise<string[]>;
    delete(key: string): Promise<boolean>;
  };
};

async function cleanupServiceWorkers() {
  try {
    const serviceWorker = browser.navigator?.serviceWorker;
    if (!serviceWorker) return;

    const registrations = await serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );

    const cacheStorage = browser.caches;
    if (cacheStorage) {
      const keys = await cacheStorage.keys();
      await Promise.all(keys.map((key) => cacheStorage.delete(key)));
    }
  } catch {
    // Ignore cleanup errors.
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    const serviceWorker = browser.navigator?.serviceWorker;
    if (!browser.window || !serviceWorker) return;

    if (!IS_PRODUCTION) {
      void cleanupServiceWorkers();
      return;
    }

    serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}
