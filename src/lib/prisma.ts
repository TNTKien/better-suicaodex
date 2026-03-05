import { PrismaClient } from "../../prisma/generated/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Prisma + Neon");
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
