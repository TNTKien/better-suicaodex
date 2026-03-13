import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";
import { dash } from "@better-auth/infra";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.AUTH_URL ??
  "http://localhost:3000";

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is required");
}

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_BASE_URL,
  process.env.AUTH_URL,
].filter((origin): origin is string => Boolean(origin));

const dedupedTrustedOrigins = [baseURL, ...trustedOrigins].filter(
  (origin, index, list) => list.indexOf(origin) === index,
);

export const auth = betterAuth({
  appName: "Suicaodex",
  baseURL,
  secret,
  // experimental: { joins: true },
  plugins: [dash({ apiKey: process.env.BETTER_AUTH_API_KEY })],
  advanced: {
    useSecureCookies: baseURL.startsWith("https://"),
    ipAddress: {
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for', 'cf-connecting-ip'],
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
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
    },
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
  trustedOrigins: dedupedTrustedOrigins,
});

export async function getAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export type AuthSession = typeof auth.$Infer.Session;
