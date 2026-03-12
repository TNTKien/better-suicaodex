# Migrate MySQL to PostgreSQL (Data-Safe Guide)

This branch moves the runtime database from MySQL/MariaDB to PostgreSQL.

The repo now contains a reproducible migration pipeline:

1. Export the source MySQL database to `ndjson`
2. Import that snapshot into PostgreSQL
3. Preserve orphaned child rows by synthesizing placeholder parent rows
4. Reset Prisma migration metadata safely and baseline PostgreSQL migrations

## Required env vars

Runtime:

```bash
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/suicaodex
SHADOW_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/suicaodex_shadow
```

Optional legacy source DB config for export:

```bash
SOURCE_MYSQL_DATABASE_URL=mariadb://user:password@host:3306/database
```

Or the split env vars:

```bash
SOURCE_MYSQL_DATABASE_HOST=host
SOURCE_MYSQL_DATABASE_PORT=3306
SOURCE_MYSQL_DATABASE_USER=user
SOURCE_MYSQL_DATABASE_PASSWORD=password
SOURCE_MYSQL_DATABASE_NAME=database
```

`MYSQL_DATABASE_*` is still accepted as a fallback by the export tooling, but the app runtime no longer uses it.

## Commands

Smoke-test PostgreSQL:

```bash
bun run db:smoke
```

Export MySQL:

```bash
bun run db:export:mysql
```

Import a snapshot into PostgreSQL:

```bash
SOURCE_EXPORT_DIR=./temp/mysql-export-YYYYMMDD-HHMMSS bun run db:import:mysql-export
```

Prepare Prisma migration metadata on an already-imported PostgreSQL DB:

```bash
bun run db:baseline:prepare
bun run db:baseline:resolve
```

Or run both:

```bash
bun run db:baseline
```

## What `db:baseline:prepare` does

- Backs up the current `_prisma_migrations` rows to `temp/prisma-migrations-backup/...json`
- Copies those rows into `_prisma_migrations_mysql_backup`
- Truncates `_prisma_migrations`

This avoids losing migration metadata while preventing Prisma from treating archived MySQL migrations as active PostgreSQL migrations.

## Prisma migrations

Active PostgreSQL migrations now live in:

- `prisma/migrations/20260312000000_postgresql_baseline`

Archived MySQL migrations were moved to:

- `prisma/mysql-migrations-archive`

Do not point `prisma migrate deploy` at the archived MySQL SQL files.

## Data integrity behavior

If the source MySQL data contains orphaned rows, the import script does not drop those child rows.

Instead it creates placeholder parent rows:

- missing `User` → placeholder user with `@orphaned.local` email
- missing `Manga` → placeholder manga titled `[Missing manga <id>]`
- missing `Chapter` → placeholder chapter row

This preserves all imported business rows while making PostgreSQL foreign keys satisfiable.
