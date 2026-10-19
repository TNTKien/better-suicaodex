import { and, eq, sql } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"

import type { Auth } from "./auth.js"
import type { Database } from "../../db/client.js"
import { user, userProfile } from "../../db/schema.js"
import { apiError } from "../../shared/contract.js"

declare module "hono" {
  interface ContextVariableMap {
    accountUserId: string
    accountUserName?: string
  }
}

export async function sessionUser(auth: Auth | undefined, headers: Headers) {
  if (!auth) return null
  return (await auth.api.getSession({ headers }))?.user ?? null
}

export async function freshSessionUser(
  auth: Auth | undefined,
  headers: Headers
) {
  if (!auth) return null
  return (
    (
      await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      })
    )?.user ?? null
  )
}

export async function accountCanMutate(database: Database, userId: string) {
  const [profile] = await database
    .select({ status: userProfile.status })
    .from(userProfile)
    .innerJoin(user, eq(user.id, userProfile.userId))
    .where(and(eq(userProfile.userId, userId), sql`${user.banned} is not true`))
    .limit(1)
  return profile?.status === "active"
}

export function privateAccount(dependencies: {
  auth?: Auth
  database: Database
}): MiddlewareHandler {
  return async (c, next) => {
    c.header("Cache-Control", "private, no-store")
    const currentUser = await freshSessionUser(
      dependencies.auth,
      c.req.raw.headers
    )
    if (!currentUser)
      return c.json(
        apiError(
          "UNAUTHORIZED",
          "Authentication is required",
          c.get("requestId")
        ),
        401
      )
    if (
      (c.req.method === "PUT" || c.req.method === "POST") &&
      !(await accountCanMutate(dependencies.database, currentUser.id))
    )
      return c.json(
        apiError(
          "ACCOUNT_RESTRICTED",
          "This account cannot modify private data",
          c.get("requestId")
        ),
        403
      )
    c.set("accountUserId", currentUser.id)
    await next()
  }
}
