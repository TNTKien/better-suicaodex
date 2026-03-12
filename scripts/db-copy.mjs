import "dotenv/config";
import mariadb from "mariadb";

const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 1;
const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_BATCH_SIZE = 200;

const parsePositiveInteger = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const splitIntoChunks = (items, chunkSize) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const decodeUrlConfig = (value, label) => {
  try {
    const url = new URL(value);

    return {
      host: url.hostname,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      port: parsePositiveInteger(url.port, DEFAULT_MYSQL_PORT),
    };
  } catch {
    throw new Error(
      `${label}_MYSQL_DATABASE_URL is invalid. URL-encode reserved characters in the username or password.`,
    );
  }
};

const resolveConfig = (label, fallbackLabel) => {
  const readEnv = (suffix) =>
    process.env[`${label}_${suffix}`] ??
    (fallbackLabel === ""
      ? process.env[suffix]
      : fallbackLabel
        ? process.env[`${fallbackLabel}_${suffix}`]
        : undefined);

  const host = readEnv("MYSQL_DATABASE_HOST")?.trim();
  const user = readEnv("MYSQL_DATABASE_USER")?.trim();
  const password = readEnv("MYSQL_DATABASE_PASSWORD") ?? "";
  const database = readEnv("MYSQL_DATABASE_NAME")?.trim();
  const connectionUrl = readEnv("MYSQL_DATABASE_URL")?.trim();

  if (host && user && database) {
    return {
      host,
      user,
      password,
      database,
      port: parsePositiveInteger(
        readEnv("MYSQL_DATABASE_PORT"),
        DEFAULT_MYSQL_PORT,
      ),
      connectionLimit: parsePositiveInteger(
        readEnv("MYSQL_DATABASE_CONNECTION_LIMIT"),
        DEFAULT_CONNECTION_LIMIT,
      ),
      connectTimeout: parsePositiveInteger(
        readEnv("MYSQL_DATABASE_CONNECT_TIMEOUT_MS"),
        DEFAULT_CONNECT_TIMEOUT_MS,
      ),
    };
  }

  if (connectionUrl) {
    return {
      ...decodeUrlConfig(connectionUrl, label),
      connectionLimit: parsePositiveInteger(
        readEnv("MYSQL_DATABASE_CONNECTION_LIMIT"),
        DEFAULT_CONNECTION_LIMIT,
      ),
      connectTimeout: parsePositiveInteger(
        readEnv("MYSQL_DATABASE_CONNECT_TIMEOUT_MS"),
        DEFAULT_CONNECT_TIMEOUT_MS,
      ),
    };
  }

  throw new Error(
    `Missing ${label} DB config. Set ${label}_MYSQL_DATABASE_URL or ${label}_MYSQL_DATABASE_HOST/USER/PASSWORD/NAME.`,
  );
};

const describeConfig = (config) => ({
  host: config.host,
  user: config.user,
  database: config.database,
  port: config.port,
  connectionLimit: config.connectionLimit,
  connectTimeout: config.connectTimeout,
  hasPassword: Boolean(config.password),
});

const getTables = async (connection, database) => {
  const rows = await connection.query(
    `
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `,
    [database],
  );

  return rows.map((row) => row.tableName);
};

const getColumns = async (connection, tableName) => {
  const rows = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);

  return rows.map((row) => row.Field);
};

const getRowCount = async (connection, tableName) => {
  const rows = await connection.query(
    `SELECT COUNT(*) AS count FROM \`${tableName}\``,
  );

  return Number(rows[0]?.count ?? 0);
};

const copyTableRows = async (
  sourceConnection,
  targetConnection,
  tableName,
  batchSize,
) => {
  const columns = await getColumns(sourceConnection, tableName);
  const rows = await sourceConnection.query(`SELECT * FROM \`${tableName}\``);

  if (rows.length === 0) {
    return 0;
  }

  const placeholders = columns.map(() => "?").join(", ");
  const columnList = columns.map((column) => `\`${column}\``).join(", ");
  const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;

  for (const chunk of splitIntoChunks(rows, batchSize)) {
    await targetConnection.batch(
      insertSql,
      chunk.map((row) => columns.map((column) => row[column])),
    );
  }

  return rows.length;
};

const ensureSchemasMatch = async (
  sourceConnection,
  targetConnection,
  sourceDatabase,
  targetDatabase,
) => {
  const [sourceTables, targetTables] = await Promise.all([
    getTables(sourceConnection, sourceDatabase),
    getTables(targetConnection, targetDatabase),
  ]);

  const missingOnTarget = sourceTables.filter(
    (tableName) => !targetTables.includes(tableName),
  );

  if (missingOnTarget.length > 0) {
    throw new Error(
      `Target DB is missing tables: ${missingOnTarget.join(", ")}. Create the schema first, then run this script again.`,
    );
  }

  return sourceTables;
};

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--execute");
const batchSize = parsePositiveInteger(
  process.env.DB_COPY_BATCH_SIZE,
  DEFAULT_BATCH_SIZE,
);

const sourceConfig = resolveConfig("SOURCE", "");
const targetConfig = resolveConfig("TARGET");

const sameDatabase =
  sourceConfig.host === targetConfig.host &&
  sourceConfig.port === targetConfig.port &&
  sourceConfig.database === targetConfig.database &&
  sourceConfig.user === targetConfig.user;

if (sameDatabase) {
  throw new Error(
    "Source and target DB configs point to the same database. Refusing to continue.",
  );
}

console.log("[source]", JSON.stringify(describeConfig(sourceConfig)));
console.log("[target]", JSON.stringify(describeConfig(targetConfig)));

const sourcePool = mariadb.createPool(sourceConfig);
const targetPool = mariadb.createPool(targetConfig);

let sourceConnection;
let targetConnection;

try {
  sourceConnection = await sourcePool.getConnection();
  targetConnection = await targetPool.getConnection();

  const tables = await ensureSchemasMatch(
    sourceConnection,
    targetConnection,
    sourceConfig.database,
    targetConfig.database,
  );

  const counts = await Promise.all(
    tables.map(async (tableName) => ({
      tableName,
      count: await getRowCount(sourceConnection, tableName),
    })),
  );

  console.log("\nSource table counts:");
  for (const { tableName, count } of counts) {
    console.log(`- ${tableName}: ${count}`);
  }

  if (!shouldExecute) {
    console.log(
      "\nDry-run only. Run again with --execute after you have created the target schema.",
    );
    process.exit(0);
  }

  console.log("\nExecuting copy...");

  await targetConnection.query("SET FOREIGN_KEY_CHECKS = 0");
  await targetConnection.query("SET UNIQUE_CHECKS = 0");

  try {
    for (const tableName of tables) {
      await targetConnection.query(`DELETE FROM \`${tableName}\``);
    }

    let totalRows = 0;

    for (const tableName of tables) {
      const copiedRows = await copyTableRows(
        sourceConnection,
        targetConnection,
        tableName,
        batchSize,
      );
      totalRows += copiedRows;
      console.log(`- copied ${copiedRows} row(s) into ${tableName}`);
    }

    console.log(`\nDone. Copied ${totalRows} row(s) in total.`);
  } finally {
    await targetConnection.query("SET UNIQUE_CHECKS = 1");
    await targetConnection.query("SET FOREIGN_KEY_CHECKS = 1");
  }
} finally {
  if (sourceConnection) {
    await sourceConnection.release();
  }

  if (targetConnection) {
    await targetConnection.release();
  }

  await sourcePool.end();
  await targetPool.end();
}
