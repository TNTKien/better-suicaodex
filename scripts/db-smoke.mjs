import "dotenv/config";
import net from "node:net";
import mariadb from "mariadb";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../prisma/generated/client.ts";

const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 1;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;

const parsePositiveInteger = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const config = {
  host: process.env.MYSQL_DATABASE_HOST?.trim(),
  user: process.env.MYSQL_DATABASE_USER?.trim(),
  password: process.env.MYSQL_DATABASE_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE_NAME?.trim(),
  port: parsePositiveInteger(process.env.MYSQL_DATABASE_PORT, DEFAULT_MYSQL_PORT),
  connectionLimit: parsePositiveInteger(
    process.env.MYSQL_DATABASE_CONNECTION_LIMIT,
    DEFAULT_CONNECTION_LIMIT,
  ),
  connectTimeout: parsePositiveInteger(
    process.env.MYSQL_DATABASE_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
  ),
};

config.acquireTimeout = Math.max(
  config.connectTimeout,
  parsePositiveInteger(
    process.env.MYSQL_DATABASE_ACQUIRE_TIMEOUT_MS,
    DEFAULT_ACQUIRE_TIMEOUT_MS,
  ),
);

const printableConfig = {
  host: config.host,
  user: config.user,
  database: config.database,
  port: config.port,
  connectionLimit: config.connectionLimit,
  acquireTimeout: config.acquireTimeout,
  connectTimeout: config.connectTimeout,
  hasPassword: config.password.length > 0,
  hasUrl: Boolean(process.env.MYSQL_DATABASE_URL),
};

const ensureEnv = () => {
  const missing = ["host", "user", "database"].filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars for DB smoke test: ${missing.join(", ")}`);
  }
};

const checkTcp = () =>
  new Promise((resolve, reject) => {
    const socket = new net.Socket();

    socket.setTimeout(config.connectTimeout);

    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });

    socket.once("timeout", () => {
      socket.destroy();
      reject(
        new Error(
          `TCP timeout after ${config.connectTimeout}ms while connecting to ${config.host}:${config.port}`,
        ),
      );
    });

    socket.once("error", (error) => {
      socket.destroy();
      reject(error);
    });

    socket.connect(config.port, config.host);
  });

const logStep = (label, detail) => {
  console.log(`[${label}] ${detail}`);
};

async function main() {
  ensureEnv();
  logStep("config", JSON.stringify(printableConfig));

  await checkTcp();
  logStep("tcp", "ok");

  const pool = mariadb.createPool(config);

  try {
    const conn = await pool.getConnection();
    const rows = await conn.query("SELECT 1 AS ok");
    await conn.release();
    logStep("mariadb", JSON.stringify(rows));
  } finally {
    await pool.end();
  }

  const adapter = new PrismaMariaDb(config, {
    onConnectionError: (error) => {
      console.error(
        "[prisma-connection-error]",
        JSON.stringify({
          code: error.code,
          errno: error.errno,
          sqlState: error.sqlState,
          address: error.address,
          port: error.port,
          fatal: error.fatal,
          message: error.message,
        }),
      );
    },
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    logStep("prisma", JSON.stringify(rows));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[db-smoke-failed]");
  console.error(error);
  process.exitCode = 1;
});
