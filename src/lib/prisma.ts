import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;





// import "dotenv/config";
// import { PrismaClient } from "../../prisma/generated/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { Pool } from "pg";

// const databaseUrl = process.env.DATABASE_URL;

// if (!databaseUrl) {
//   throw new Error("DATABASE_URL is required");
// }

// const globalForPrisma = globalThis as unknown as {
//   pgPool?: Pool;
//   prisma?: PrismaClient;
// };

// const pool =
//   globalForPrisma.pgPool ??
//   new Pool({
//     connectionString: databaseUrl,
//     max: 5,
//   });

// const adapter = new PrismaPg(pool, {
//   onConnectionError: (error) => {
//     console.error("[prisma-pg-connection-error]", error);
//   },
// });

// export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// if (process.env.NODE_ENV !== "production") {
//   globalForPrisma.pgPool = pool;
//   globalForPrisma.prisma = prisma;
// }


