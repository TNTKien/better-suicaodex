import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../prisma/generated/client";

const databaseUrl = process.env.DATABASE_URL;
const defaultPoolMax = 5;
const poolMax = Number.parseInt(
  process.env.PG_POOL_MAX ?? `${defaultPoolMax}`,
  10,
);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForPrisma = globalThis as typeof globalThis & {
  pgPool?: Pool;
  prisma?: PrismaClient;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: Number.isNaN(poolMax) ? defaultPoolMax : poolMax,
  });

const adapter = new PrismaPg(pool, {
  onConnectionError: (error) => {
    console.error("[prisma-pg-connection-error]", error);
  },
});

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

globalForPrisma.pgPool = pool;
globalForPrisma.prisma = prisma;

export default prisma;
