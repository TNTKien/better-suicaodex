import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  ...authConfig,
});
