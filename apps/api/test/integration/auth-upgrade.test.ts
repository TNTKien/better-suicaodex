import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { readFile } from "node:fs/promises"
import { Pool, type PoolClient } from "pg"

const migration = await readFile(
  new URL(
    "../../drizzle/0003_better_auth_account_identity.sql",
    import.meta.url
  ),
  "utf8"
)
let pool: Pool
let client: PoolClient

describe.serial("Better Auth account identity upgrade", () => {
  beforeAll(() => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    pool = new Pool({ connectionString: url })
  })

  beforeEach(async () => {
    client = await pool.connect()
    await client.query("BEGIN")
    // Temporary tables shadow public.account so the migration test cannot change real accounts.
    await client.query(`
      CREATE TEMP TABLE account (
        id text PRIMARY KEY,
        issuer text NOT NULL,
        account_id text NOT NULL,
        provider_id text NOT NULL,
        user_id text NOT NULL
      );
      CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON account (issuer, account_id);
    `)
  })

  afterEach(async () => {
    if (!client) return
    await client.query("ROLLBACK")
    client.release()
  })

  afterAll(async () => {
    await pool?.end()
  })

  test("preserves existing identities and accepts new accounts without issuer", async () => {
    await client.query(`
      INSERT INTO account VALUES ('existing-account', 'local:oauth:discord', 'discord-user', 'discord', 'existing-user');
    `)
    await client.query(migration)
    expect(
      (
        await client.query(
          "SELECT * FROM account WHERE id = 'existing-account'"
        )
      ).rows
    ).toEqual([
      {
        id: "existing-account",
        issuer: "local:oauth:discord",
        account_id: "discord-user",
        provider_id: "discord",
        user_id: "existing-user",
      },
    ])
    await client.query(`
      INSERT INTO account (id, account_id, provider_id, user_id)
      VALUES ('new-account', 'discord-user', 'github', 'new-user');
    `)
    expect(
      (
        await client.query(
          "SELECT issuer FROM account WHERE id = 'new-account'"
        )
      ).rows
    ).toEqual([{ issuer: null }])
  })

  test("rejects identities that collide under the provider key", async () => {
    await client.query(`
      INSERT INTO account VALUES
        ('first', 'first-issuer', 'same-subject', 'discord', 'first-user'),
        ('second', 'second-issuer', 'same-subject', 'discord', 'second-user');
    `)
    await expect(client.query(migration)).rejects.toMatchObject({
      code: "23505",
    })
  })
})
