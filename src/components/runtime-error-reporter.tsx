"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "last-dynamic-import-error";
const RELOAD_ONCE_KEY = "dynamic-import-reload-once";

function toMessage(error: unknown): string {
  if (!error) return "Unknown runtime error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  const withMessage = error as { message?: unknown };
  return typeof withMessage.message === "string"
    ? withMessage.message
    : JSON.stringify(error);
}

function isDynamicImportFailure(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("chunkloaderror") ||
    normalized.includes("loading chunk")
  );
}

function saveErrorDetails(message: string, stack?: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        message,
        stack,
        href: window.location.href,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    return;
  }
}

function handleDynamicImportError(message: string, stack?: string) {
  saveErrorDetails(message, stack);
  console.error("[dynamic-import-error]", { message, stack });

  toast.error("Dynamic import failed", {
    description: "Saved details to localStorage: last-dynamic-import-error",
    duration: 10000,
  });

  if (process.env.NODE_ENV !== "production") return;

  try {
    if (sessionStorage.getItem(RELOAD_ONCE_KEY)) return;
    sessionStorage.setItem(RELOAD_ONCE_KEY, "1");
    window.location.reload();
  } catch {
    return;
  }
}

export function RuntimeErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error = event.error;
      const message = toMessage(error ?? event.message);
      if (!isDynamicImportFailure(message)) return;

      const stack = error instanceof Error ? error.stack : undefined;
      handleDynamicImportError(message, stack);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = toMessage(reason);
      if (!isDynamicImportFailure(message)) return;

      const stack = reason instanceof Error ? reason.stack : undefined;
      handleDynamicImportError(message, stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
