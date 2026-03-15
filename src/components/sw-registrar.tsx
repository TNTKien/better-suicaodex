"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => {
        Sentry.captureException(error);
      });
  }, []);

  return null;
}
