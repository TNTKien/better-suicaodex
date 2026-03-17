import { createMiddleware } from "hono/factory";
import type { Context, Env } from "hono";
import { limiter, RateLimitError } from "@/lib/rate-limit";

type RateLimitKey<E extends Env> =
  | string
  | ((context: Context<E>) => string | Promise<string>);

interface HonoRateLimitOptions<E extends Env> {
  limit: number;
  key: RateLimitKey<E>;
}

export function honoRateLimit<E extends Env = Env>(
  options: HonoRateLimitOptions<E>,
) {
  return createMiddleware<E>(async (c, next) => {
    const headers = new Headers();
    const identifier =
      typeof options.key === "function" ? await options.key(c) : options.key;

    try {
      await limiter.check(headers, options.limit, identifier);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.statusCode,
          headers,
        });
      }

      throw error;
    }

    await next();

    headers.forEach((value, key) => {
      c.res.headers.set(key, value);
    });
  });
}

export function rateLimitByIp<E extends Env = Env>(limit: number) {
  return honoRateLimit<E>({
    limit,
    key: (c) => c.req.header("x-forwarded-for") ?? "anonymous",
  });
}
