import "dotenv/config";
import { PrismaClient } from "../../prisma/generated/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_DATABASE_HOST as string,
  user: process.env.MYSQL_DATABASE_USER as string,
  password: process.env.MYSQL_DATABASE_PASSWORD as string,
  database: process.env.MYSQL_DATABASE_NAME as string,
  connectionLimit: 5,
  // allowPublicKeyRetrieval: true,
  // ssl: {
  //   rejectUnauthorized: false,
  // },
  //  logger: {
  //   network: (info) => {
  //     console.log('PrismaAdapterNetwork', info);
  //   },
  //   query: (info) => {
  //     console.log('PrismaAdapterQuery', info);
  //   },
  //   error: (error) => {
  //     console.error('PrismaAdapterError', error);
  //   },
  //   warning: (info) => {
  //     console.warn('PrismaAdapterWarning', info);
  //   },
  // }
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
