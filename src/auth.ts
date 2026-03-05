import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { dash } from "@better-auth/infra";

const DEFAULT_USER_AVATAR = "/avatars/default-user-avatar.webp";

export const authInstance = betterAuth({
  appName: "vinext-suicaodex",
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  verification: {
    modelName: "verificationToken",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.image && user.image.trim().length > 0) {
            return;
          }

          return {
            data: {
              ...user,
              image: DEFAULT_USER_AVATAR,
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies(), dash()],
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
