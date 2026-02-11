import { PrismaClient } from "../../prisma/generated";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import envConfig, { ENVIRONMENT_MODES } from "./env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaMariaDb({
  host: envConfig.MYSQL_DATABASE_HOST,
  user: envConfig.MYSQL_DATABASE_USER,
  password: envConfig.MYSQL_DATABASE_PASSWORD,
  database: envConfig.MYSQL_DATABASE_NAME,
  connectionLimit: 5,
  ssl: {
    rejectUnauthorized: true,
  },
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (envConfig.NODE_ENV === ENVIRONMENT_MODES.DEVELOPMENT)
  globalForPrisma.prisma = prisma;
