import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const defaultPoolMax = 5;
const poolMax = Number.parseInt(
  process.env.PG_POOL_MAX ?? `${defaultPoolMax}`,
  10,
);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDatabase = globalThis as typeof globalThis & {
  pgPool?: Pool;
};

const sharedPool =
  globalForDatabase.pgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: Number.isNaN(poolMax) ? defaultPoolMax : poolMax,
  });

if (!globalForDatabase.pgPool) {
  sharedPool.on("error", (error) => {
    console.error("[pg-pool-error]", error);
  });

  globalForDatabase.pgPool = sharedPool;
}

export const pool = globalForDatabase.pgPool;
export const db = drizzle(pool, { schema });

export type Db = typeof db;

export { schema };
export default db;
