import "dotenv/config";
import net from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../prisma/generated/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const parsedUrl = new URL(databaseUrl);
const connectTimeout = Number.parseInt(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? "10000", 10);

const printableConfig = {
  host: parsedUrl.hostname,
  port: Number.parseInt(parsedUrl.port || "5432", 10),
  database: parsedUrl.pathname.replace(/^\//, ""),
  user: decodeURIComponent(parsedUrl.username),
  connectTimeout,
  hasPassword: parsedUrl.password.length > 0,
};

const checkTcp = () =>
  new Promise((resolve, reject) => {
    const socket = new net.Socket();

    socket.setTimeout(connectTimeout);

    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });

    socket.once("timeout", () => {
      socket.destroy();
      reject(
        new Error(
          `TCP timeout after ${connectTimeout}ms while connecting to ${printableConfig.host}:${printableConfig.port}`,
        ),
      );
    });

    socket.once("error", (error) => {
      socket.destroy();
      reject(error);
    });

    socket.connect(printableConfig.port, printableConfig.host);
  });

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: connectTimeout,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const logStep = (label, detail) => {
  console.log(`[${label}] ${detail}`);
};

async function main() {
  logStep("config", JSON.stringify(printableConfig));

  await checkTcp();
  logStep("tcp", "ok");

  const client = await pool.connect();

  try {
    const rows = await client.query("SELECT 1 AS ok");
    logStep("pg", JSON.stringify(rows.rows));
  } finally {
    client.release();
  }

  try {
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    logStep("prisma", JSON.stringify(rows));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db-smoke-failed]");
  console.error(error);
  process.exitCode = 1;
});
