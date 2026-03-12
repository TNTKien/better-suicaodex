import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mariadb from "mariadb";

const DEFAULT_MYSQL_PORT = 3306;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
      `${label}_DATABASE_URL is invalid. URL-encode reserved characters in the username or password.`,
    );
  }
};

const resolveMysqlConfig = () => {
  const readEnv = (prefix, suffix) =>
    process.env[`${prefix}_${suffix}`] ?? process.env[`MYSQL_${suffix}`];

  const host = readEnv("SOURCE_MYSQL", "DATABASE_HOST")?.trim();
  const user = readEnv("SOURCE_MYSQL", "DATABASE_USER")?.trim();
  const password = readEnv("SOURCE_MYSQL", "DATABASE_PASSWORD") ?? "";
  const database = readEnv("SOURCE_MYSQL", "DATABASE_NAME")?.trim();
  const connectionUrl = process.env.SOURCE_MYSQL_DATABASE_URL?.trim() ?? process.env.MYSQL_DATABASE_URL?.trim();

  if (host && user && database) {
    return {
      host,
      user,
      password,
      database,
      port: parsePositiveInteger(
        readEnv("SOURCE_MYSQL", "DATABASE_PORT"),
        DEFAULT_MYSQL_PORT,
      ),
      connectionLimit: 1,
      connectTimeout: 30000,
    };
  }

  if (connectionUrl) {
    return {
      ...decodeUrlConfig(connectionUrl, "SOURCE_MYSQL"),
      connectionLimit: 1,
      connectTimeout: 30000,
    };
  }

  throw new Error(
    "Missing source MySQL config. Set SOURCE_MYSQL_DATABASE_URL or SOURCE_MYSQL_DATABASE_HOST/USER/PASSWORD/NAME.",
  );
};

const stringify = (value) =>
  JSON.stringify(value, (_, current) => {
    if (typeof current === "bigint") {
      return current.toString();
    }

    if (Buffer.isBuffer(current)) {
      return { type: "Buffer", base64: current.toString("base64") };
    }

    return current;
  });

const main = async () => {
  const config = resolveMysqlConfig();
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const baseDir =
    process.env.MYSQL_EXPORT_DIR?.trim() ??
    path.join(process.cwd(), "temp", `mysql-export-${stamp}`);
  const dataDir = path.join(baseDir, "data");

  const pool = mariadb.createPool(config);
  let connection;

  try {
    await fs.mkdir(dataDir, { recursive: true });
    connection = await pool.getConnection();

    const tables = await connection.query(
      `
        SELECT TABLE_NAME AS tableName
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `,
      [config.database],
    );

    const manifest = {
      exportedAt: now.toISOString(),
      source: {
        engine: "mysql",
        host: config.host,
        port: config.port,
        database: config.database,
      },
      tables: [],
    };

    const schemaChunks = [];

    for (const { tableName } of tables) {
      const createRows = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createSql = createRows[0]["Create Table"];
      schemaChunks.push(`-- ${tableName}\n${createSql};\n`);

      const rows = await connection.query(`SELECT * FROM \`${tableName}\``);
      const outputPath = path.join(dataDir, `${tableName}.ndjson`);
      const ndjson = rows.map((row) => stringify(row)).join("\n");

      await fs.writeFile(outputPath, ndjson.length > 0 ? `${ndjson}\n` : "", "utf8");

      manifest.tables.push({
        tableName,
        rowCount: rows.length,
        file: path.relative(baseDir, outputPath).replace(/\\/g, "/"),
      });

      console.log(`${tableName}\t${rows.length}`);
    }

    await fs.writeFile(path.join(baseDir, "schema.sql"), `${schemaChunks.join("\n")}\n`, "utf8");
    await fs.writeFile(
      path.join(baseDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    console.log(`EXPORT_DIR=${baseDir}`);
  } finally {
    if (connection) {
      await connection.release();
    }

    await pool.end();
  }
};

main().catch((error) => {
  console.error("[mysql-export-failed]");
  console.error(error);
  process.exitCode = 1;
});
