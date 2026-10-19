import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { parseISO } from "date-fns"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createDatabase } from "../../src/db/client"

setDefaultTimeout(120_000)

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url)
)
let connection: ReturnType<typeof createDatabase>

beforeAll(async () => {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "")
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_test") ||
    url.href === process.env.DATABASE_URL
  )
    throw new Error(
      "A separate local TEST_DATABASE_URL ending in _test is required"
    )
  connection = createDatabase(url.href)
  await migrate(connection.db, { migrationsFolder })
})

afterAll(async () => {
  await connection?.pool.end()
})

test("fresh installation seeds the default taxonomy and migration replay preserves it", async () => {
  const before = await connection.pool.query("SELECT * FROM tag ORDER BY slug")
  expect(before.rows).toHaveLength(76)
  expect(new Set(before.rows.map((row) => row.id)).size).toBe(76)
  expect(before.rows.every((row) => !row.slug.startsWith("web1-"))).toBe(true)
  expect(
    Object.fromEntries(
      (
        await connection.pool.query(
          'SELECT "group", count(*)::int AS count FROM tag GROUP BY "group"'
        )
      ).rows.map((row) => [row.group, row.count])
    )
  ).toEqual({ content: 2, format: 10, genre: 24, theme: 40 })
  expect(before.rows).toContainEqual(
    expect.objectContaining({
      slug: "boys-love",
      name: "Boys' Love",
      group: "genre",
    })
  )
  await migrate(connection.db, { migrationsFolder })
  expect(
    (await connection.pool.query("SELECT * FROM tag ORDER BY slug")).rows
  ).toEqual(before.rows)
})

test("seed SQL preserves existing IDs, moderation state and manga relations on either unique conflict", async () => {
  const seedSql = await readFile(
    new URL("../../drizzle/0002_seed_tags.sql", import.meta.url),
    "utf8"
  )
  const client = await connection.pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("DELETE FROM tag")
    const ids = Array.from({ length: 4 }, () => randomUUID())
    await client.query(
      `INSERT INTO tag (id, slug, "group", name, moderation_hidden_at, version) VALUES
        ($1, 'comedy', 'genre', 'My Comedy', $5, 7),
        ($2, 'my-action', 'genre', ' Action ', $5, 4),
        ($3, 'long-strip', 'theme', 'Reserved Slug', NULL, 3),
        ($4, 'custom-tag', 'theme', 'Custom Tag', NULL, 1)`,
      [...ids, parseISO("2026-10-19T00:00:00Z")]
    )
    const mangaId = randomUUID()
    await client.query(
      `INSERT INTO manga (id, owner_group_id, slug, title, search_title, original_language, status, content_rating)
       SELECT $1, id, 'seed-test', 'Seed test', 'seed test', 'ja', 'ongoing', 'safe'
       FROM organization WHERE slug = 'system'`,
      [mangaId]
    )
    await client.query(
      "INSERT INTO manga_tag (manga_id, tag_id) VALUES ($1, $2)",
      [mangaId, ids[0]]
    )
    const before = (await client.query("SELECT * FROM tag ORDER BY id")).rows

    expect((await client.query(seedSql)).rowCount).toBe(73)
    expect((await client.query(seedSql)).rowCount).toBe(0)
    expect(
      (
        await client.query(
          "SELECT * FROM tag WHERE id = ANY($1::uuid[]) ORDER BY id",
          [ids]
        )
      ).rows
    ).toEqual(before)
    expect(
      (await client.query("SELECT count(*)::int AS count FROM tag")).rows[0]
        .count
    ).toBe(77)
    expect(
      (
        await client.query("SELECT tag_id FROM manga_tag WHERE manga_id = $1", [
          mangaId,
        ])
      ).rows
    ).toEqual([{ tag_id: ids[0] }])
  } finally {
    await client.query("ROLLBACK")
    client.release()
  }
})
