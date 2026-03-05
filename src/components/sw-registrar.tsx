"use client";

import { useEffect } from "react";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ENABLE_PWA = process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

async function cleanupServiceWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Ignore cleanup errors.
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    if (!IS_PRODUCTION || !ENABLE_PWA) {
      void cleanupServiceWorkers();
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}
