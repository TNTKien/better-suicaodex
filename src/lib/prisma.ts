import "dotenv/config";
import { PrismaClient } from "../../prisma/generated/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_MYSQL_PORT = 3306;

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createAdapter = () => {
  const connectionLimit = parsePositiveInteger(
    process.env.MYSQL_DATABASE_CONNECTION_LIMIT,
    DEFAULT_CONNECTION_LIMIT,
  );
  const connectTimeout = parsePositiveInteger(
    process.env.MYSQL_DATABASE_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
  );
  const host = process.env.MYSQL_DATABASE_HOST?.trim();
  const user = process.env.MYSQL_DATABASE_USER?.trim();
  const database = process.env.MYSQL_DATABASE_NAME?.trim();
  const connectionUrl = process.env.MYSQL_DATABASE_URL?.trim();

  if (host && user && database) {
    return new PrismaMariaDb({
      host,
      user,
      password: process.env.MYSQL_DATABASE_PASSWORD ?? "",
      database,
      port: parsePositiveInteger(
        process.env.MYSQL_DATABASE_PORT,
        DEFAULT_MYSQL_PORT,
      ),
      connectionLimit,
      connectTimeout,
      // allowPublicKeyRetrieval: true,
      // ssl: {
      //   rejectUnauthorized: false,
      // },
      // logger: {
      //   network: (info) => {
      //     console.log("PrismaAdapterNetwork", info);
      //   },
      //   query: (info) => {
      //     console.log("PrismaAdapterQuery", info);
      //   },
      //   error: (error) => {
      //     console.error("PrismaAdapterError", error);
      //   },
      //   warning: (info) => {
      //     console.warn("PrismaAdapterWarning", info);
      //   },
      // },
    });
  }

  if (connectionUrl) {
    let normalizedUrl: URL;

    try {
      normalizedUrl = new URL(connectionUrl);
    } catch {
      throw new Error(
        "MYSQL_DATABASE_URL is invalid. URL-encode special characters in the username or password.",
      );
    }

    if (!normalizedUrl.searchParams.has("connectionLimit")) {
      normalizedUrl.searchParams.set("connectionLimit", String(connectionLimit));
    }

    if (!normalizedUrl.searchParams.has("connectTimeout")) {
      normalizedUrl.searchParams.set("connectTimeout", String(connectTimeout));
    }

    return new PrismaMariaDb(normalizedUrl.toString());
  }

  throw new Error(
    "Missing MariaDB connection settings. Set MYSQL_DATABASE_URL or the MYSQL_DATABASE_HOST/USER/PASSWORD/NAME variables.",
  );
};

const adapter = createAdapter();

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
