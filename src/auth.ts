import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { betterAuthSchema } from "@/lib/db/schema";
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
      ipAddressHeaders: ["x-real-ip", "x-forwarded-for", "cf-connecting-ip"],
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: betterAuthSchema,
  }),
  socialProviders: {
    discord: {
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
    github: {
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
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
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
      strategy: "jwe",
    },
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

interface GetAuthSessionOptions {
  disableRefresh?: boolean;
}

export async function getAuthSession(options: GetAuthSessionOptions = {}) {
  return auth.api.getSession({
    headers: await headers(),
    query: {
      disableRefresh: options.disableRefresh,
    },
  });
}

export type AuthSession = typeof auth.$Infer.Session;
