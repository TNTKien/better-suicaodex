import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const authInstance = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  verification: {
    modelName: "verificationToken",
  },
  plugins: [nextCookies()],
});

export async function auth() {
  const data = await authInstance.api.getSession({
    headers: new Headers(await headers()),
  });

  if (!data) {
    return null;
  }

  return {
    ...data.session,
    user: data.user,
  };
}
