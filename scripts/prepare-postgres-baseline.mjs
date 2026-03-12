import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const databaseUrl =
  process.env.TARGET_DATABASE_URL?.trim() ?? process.env.DATABASE_URL?.trim();
const baselineMigration =
  process.env.POSTGRES_BASELINE_MIGRATION?.trim() ??
  "20260312000000_postgresql_baseline";

if (!databaseUrl) {
  throw new Error("Missing TARGET_DATABASE_URL or DATABASE_URL.");
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(process.cwd(), "temp", "prisma-migrations-backup");

const client = new Client({ connectionString: databaseUrl });

const tableExists = async (tableName) => {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );

  return result.rows[0]?.exists === true;
};

const main = async () => {
  await client.connect();

  try {
    const hasMigrationTable = await tableExists("_prisma_migrations");

    if (!hasMigrationTable) {
      console.log('"_prisma_migrations" does not exist. Nothing to prepare.');
      return;
    }

    const existingRows = await client.query(
      `
        SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
        FROM "_prisma_migrations"
        ORDER BY started_at, migration_name
      `,
    );

    if (existingRows.rows.length === 0) {
      console.log('"_prisma_migrations" is already empty.');
      return;
    }

    if (
      existingRows.rows.length === 1 &&
      existingRows.rows[0]?.migration_name === baselineMigration
    ) {
      console.log(`Baseline "${baselineMigration}" is already the only applied migration.`);
      return;
    }

    await fs.mkdir(backupDir, { recursive: true });

    const backupPath = path.join(
      backupDir,
      `${timestamp}-${baselineMigration}.json`,
    );

    await fs.writeFile(
      backupPath,
      `${JSON.stringify(existingRows.rows, null, 2)}\n`,
      "utf8",
    );

    await client.query(`TRUNCATE TABLE "_prisma_migrations"`);

    console.log(`Backed up ${existingRows.rows.length} migration row(s).`);
    console.log(`Backup file: ${backupPath}`);
    console.log('"_prisma_migrations" has been truncated. Run Prisma resolve next.');
  } finally {
    await client.end().catch(() => {});
  }
};

main().catch((error) => {
  console.error("[prepare-postgres-baseline-failed]");
  console.error(error);
  process.exitCode = 1;
});
