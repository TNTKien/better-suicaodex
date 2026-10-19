import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema.js"

export function createDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    application_name: "suicaodex-redive-api",
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    options: "-c timezone=UTC",
  })

  return {
    db: drizzle(pool, { schema }),
    pool,
  }
}

export type Database = ReturnType<typeof createDatabase>["db"]

export async function checkDatabase(database: Database) {
  const result = await database.execute(
    sql<{ timezone: string }>`select current_setting('TIMEZONE') as timezone`
  )
  if (result.rows[0]?.timezone !== "UTC") {
    throw new Error("PostgreSQL session timezone must be UTC")
  }
}
