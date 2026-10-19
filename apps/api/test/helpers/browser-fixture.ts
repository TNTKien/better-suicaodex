import { fileURLToPath } from "node:url"

import { eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import {
  comment,
  moderationAction,
  manga,
  organization as translationGroup,
  person,
  tag,
  translationGroupProfile,
  user,
} from "../../src/db/schema.js"
import { createRuntime } from "../../src/runtime.js"
import {
  catalogGroupSlugs,
  catalogMangaIds,
  catalogPersonIds,
  catalogTagIds,
  seedCatalog,
} from "./catalog-fixture"
import { parseRuntimeEnv } from "../../src/shared/env.js"

const action = process.argv[2]
if (action !== "setup" && action !== "cleanup")
  throw new Error("Usage: e2e-fixture.ts <setup|cleanup>")
if (!process.env.TEST_DATABASE_URL)
  throw new Error("TEST_DATABASE_URL is required for browser tests")
if (process.env.DATABASE_URL === process.env.TEST_DATABASE_URL)
  throw new Error("Browser fixtures require an isolated test database")

const target = new URL(process.env.TEST_DATABASE_URL)
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw new Error(
    "Browser fixtures require a loopback PostgreSQL database ending in _test"
  )

const groupEmails = ["admin", "leader", "member"].map(
  (role) => `phase8a-browser-${role}@example.com`
)

const env = parseRuntimeEnv({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  REDIS_CACHE_ENABLED: "false",
  REDIS_PREFIX: `${process.env.REDIS_PREFIX ?? "redive:test"}:e2e`,
})
const runtime = await createRuntime(env, () => undefined)

async function cleanup() {
  const accounts = await runtime.database
    .select({ id: user.id })
    .from(user)
    .where(
      inArray(user.email, ["phase75e-browser@example.com", ...groupEmails])
    )
  if (accounts.length) {
    const ids = accounts.map((account) => account.id)
    await runtime.database
      .delete(moderationAction)
      .where(inArray(moderationAction.actorUserId, ids))
    const ownedGroups = await runtime.database
      .select({ id: translationGroupProfile.organizationId })
      .from(translationGroupProfile)
      .where(inArray(translationGroupProfile.createdByUserId, ids))
    if (ownedGroups.length)
      await runtime.database.delete(translationGroup).where(
        inArray(
          translationGroup.id,
          ownedGroups.map(({ id }) => id)
        )
      )
  }
  for (const account of accounts) {
    await runtime.database.delete(comment).where(eq(comment.userId, account.id))
    await runtime.database.delete(user).where(eq(user.id, account.id))
  }
  await runtime.database.delete(manga).where(inArray(manga.id, catalogMangaIds))
  await runtime.database
    .delete(person)
    .where(inArray(person.id, catalogPersonIds))
  await runtime.database.delete(tag).where(inArray(tag.id, catalogTagIds))
  await runtime.database
    .delete(translationGroup)
    .where(inArray(translationGroup.slug, catalogGroupSlugs))
  await runtime.cache.invalidateCatalog()
}

try {
  if (action === "setup") {
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await cleanup()
    await seedCatalog(runtime.database)
    for (const role of ["admin", "leader", "member"]) {
      const result = await runtime.auth.api.signUpEmail({
        body: {
          email: `phase8a-browser-${role}@example.com`,
          name: `8A ${role}`,
          password: "phase8a-browser-password",
        },
      })
      if (role === "admin")
        await runtime.database
          .update(user)
          .set({ role: "admin" })
          .where(eq(user.id, result.user.id))
    }
  } else {
    await cleanup()
  }
} finally {
  await runtime.close()
}
