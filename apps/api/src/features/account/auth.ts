import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { betterAuth } from "better-auth/minimal"
import { admin } from "better-auth/plugins/admin"
import { organization } from "better-auth/plugins/organization"

import type { Database } from "../../db/client.js"
import {
  account,
  invitation,
  member,
  organization as organizationTable,
  session,
  user,
  verification,
} from "../../db/auth-schema.js"
import type { RuntimeEnv } from "../../shared/env.js"
import { allowedWebOrigins } from "../../shared/web-origins.js"
import { accountCanMutate } from "./guard.js"
import { ensureUserProfile } from "./routes.js"

export function createAuth(env: RuntimeEnv, database: Database) {
  const discord = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
  }

  return betterAuth({
    appName: "SuicaoDex Re:Dive",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: allowedWebOrigins(env.WEB_ORIGIN, env.WEB_ALLOWED_ORIGINS),
    onAPIError: { errorURL: `${env.WEB_ORIGIN}/login?error=oauth` },
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        account,
        invitation,
        member,
        organization: organizationTable,
        session,
        user,
        verification,
      },
    }),
    socialProviders:
      env.NODE_ENV === "production"
        ? {
            discord,
            google: {
              clientId: env.GOOGLE_CLIENT_ID!,
              clientSecret: env.GOOGLE_CLIENT_SECRET!,
            },
            github: {
              clientId: env.GITHUB_CLIENT_ID!,
              clientSecret: env.GITHUB_CLIENT_SECRET!,
            },
          }
        : { discord },
    emailAndPassword: {
      enabled: true,
      disableSignUp: env.NODE_ENV !== "test",
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
      },
    },
    account: { accountLinking: { enabled: true } },
    disabledPaths: [
      "/admin/set-role",
      "/admin/get-user",
      "/admin/create-user",
      "/admin/update-user",
      "/admin/list-users",
      "/admin/list-user-sessions",
      "/admin/unban-user",
      "/admin/ban-user",
      "/admin/impersonate-user",
      "/admin/stop-impersonating",
      "/admin/revoke-user-session",
      "/admin/revoke-user-sessions",
      "/admin/remove-user",
      "/admin/set-user-password",
      "/admin/has-permission",
      "/organization/create",
      "/organization/update",
      "/organization/delete",
      "/organization/remove-member",
      "/organization/update-member-role",
      "/organization/leave",
      "/organization/invite-member",
      "/organization/accept-invitation",
      "/organization/reject-invitation",
      "/organization/cancel-invitation",
    ],
    plugins: [
      admin(),
      organization({
        allowUserToCreateOrganization: false,
        disableOrganizationDeletion: true,
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await ensureUserProfile(database, createdUser.id)
          },
        },
        update: {
          before: async (updatedUser, context) => {
            if (context?.path !== "/update-user") return
            const userId = context.context.session?.user.id
            if (userId && !(await accountCanMutate(database, userId))) {
              throw new APIError("FORBIDDEN", {
                message: "ACCOUNT_RESTRICTED",
              })
            }
            if (updatedUser.image !== undefined) {
              throw new APIError("BAD_REQUEST", {
                message: "AVATAR_UPLOAD_REQUIRED",
              })
            }
            if (updatedUser.name === undefined) return
            const name = updatedUser.name.replace(/\s+/g, " ").trim()
            if (name.length < 1 || name.length > 80) {
              throw new APIError("BAD_REQUEST", {
                message: "INVALID_DISPLAY_NAME",
              })
            }
            return { data: { ...updatedUser, name } }
          },
        },
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      ipAddress: { trustedProxies: env.TRUSTED_PROXY_IPS ?? [] },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
