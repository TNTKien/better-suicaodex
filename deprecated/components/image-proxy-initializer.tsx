"use client";

import { useEffect } from "react";
import { initImageProxy } from "@/lib/axios";

export function ImageProxyInitializer() {
  useEffect(() => {
    initImageProxy().catch((error) => {
      console.error("[Image Init] Failed to initialize:", error);
    });

    // Refresh proxy
    const interval = setInterval(() => {
      initImageProxy().catch((error) => {
        console.error("[Image Refresh] Failed to refresh:", error);
      });
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
