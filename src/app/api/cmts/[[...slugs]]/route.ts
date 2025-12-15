import { Elysia, t } from "elysia";

export const app = new Elysia({ prefix: "/api/cmts" })
  .get("/", "Hello Nextjs")
  .post("/", ({ body }) => body, {
    body: t.Object({
      name: t.String(),
    }),
  });

export const GET = (req: Request) => app.handle(req);
export const POST = (req: Request) => app.handle(req);

// Export type for Eden Treaty
export type App = typeof app;
