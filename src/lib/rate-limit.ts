import { LRUCache } from "lru-cache";

export class RateLimitError extends Error {
  statusCode = 429;

  constructor(message: string, options?: { statusCode?: number }) {
    super(message);

    this.statusCode = options?.statusCode ?? 429;
    this.name = "Limiter";
  }
}

interface Options {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export const rateLimit = (options?: Options) => {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60000,
  });

  return {
    check: (headers: Headers, limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        let tokenCount = (tokenCache.get(token) as number) || 0;
        tokenCache.set(token, ++tokenCount);

        const currentUsage = tokenCount;
        const isRateLimited = currentUsage > limit;

        headers.set("X-RateLimit-Limit", `${limit}`);
        headers.set(
          "X-RateLimit-Remaining",
          `${isRateLimited ? 0 : limit - currentUsage}`,
        );

        return isRateLimited
          ? reject(new RateLimitError("Too many request"))
          : resolve();
      }),
  };
};

export const limiter = rateLimit({
  uniqueTokenPerInterval: 500,
  interval: 1000 * 60,
});
