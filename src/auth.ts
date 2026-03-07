import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { toNextJsHandler } from "better-auth/next-js";

const baseURL = process.env.BETTER_AUTH_URL;

export const authServer = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  socialProviders: {
    discord: {
      clientId: process.env.AUTH_DISCORD_ID as string,
      clientSecret: process.env.AUTH_DISCORD_SECRET as string,
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
    },
    github: {
      clientId: process.env.AUTH_GITHUB_ID as string,
      clientSecret: process.env.AUTH_GITHUB_SECRET as string,
    }
  },
  user: {
    modelName: "user",
    fields: {
      name: "displayName",
      emailVerified: "betterEmailVerified",
    },
  },
  session: {
    modelName: "session",
    fields: {
      token: "sessionToken",
      expiresAt: "expires",
    },
  },
  account: {
    modelName: "account",
    fields: {
      providerId: "provider",
      accountId: "providerAccountId",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "accessTokenExpiresAt",
      refreshTokenExpiresAt: "refreshTokenExpiresAt",
      password: "password",
    },
    accountLinking: {
      enabled: true,
      trustedProviders: ["discord", "google", "github"],
    },
  },
  verification: {
    modelName: "verification",
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.AUTH_URL,
  ].filter((origin): origin is string => Boolean(origin)),
});

export const handlers = toNextJsHandler(authServer);

export async function auth() {
  return authServer.api.getSession({
    headers: await headers(),
  });
}

export type AuthSession = typeof authServer.$Infer.Session;
