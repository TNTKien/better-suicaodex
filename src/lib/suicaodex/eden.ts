import { treaty } from "@elysiajs/eden";
import type { App } from "@/app/api/cmts/[[...slugs]]/route";

export const eden = treaty<App>(
  typeof window === "undefined"
    ? `http://localhost:${process.env.PORT ?? 3000}`
    : window.location.origin
);

// Exported for easier access to comment endpoints
export const cmts = eden.api.cmts;
