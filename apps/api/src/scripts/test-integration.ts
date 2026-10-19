import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { readdir } from "node:fs/promises"
import { Pool } from "pg"

const target = new URL(process.env.TEST_DATABASE_URL ?? "")
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
  !target.pathname.endsWith("_test") ||
  target.href === process.env.DATABASE_URL
)
  throw new Error(
    "TEST_DATABASE_URL must point to a separate local database ending in _test"
  )

// Financial integrity tests retain immutable rows and deliberately corrupt state.
// Each suite therefore needs a fresh database rather than shared cleanup.
const adminUrl = new URL(target)
adminUrl.pathname = "/postgres"
const admin = new Pool({ connectionString: adminUrl.href, max: 1 })
const requested = process.argv.slice(2)
const suites = (await readdir("test/integration"))
  .filter(
    (file) =>
      file.endsWith(".test.ts") &&
      (!requested.length || requested.includes(file))
  )
  .sort()
if (!suites.length) throw new Error("No integration suites matched")
let failures = 0
try {
  for (const suite of suites) {
    const name = `scd_${randomUUID().replaceAll("-", "")}_test`
    await admin.query(
      `CREATE DATABASE "${name}" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'und'`
    )
    const suiteUrl = new URL(target)
    suiteUrl.pathname = `/${name}`
    try {
      const code = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          "bun",
          ["--no-env-file", "test", `test/integration/${suite}`],
          {
            stdio: "inherit",
            windowsHide: true,
            env: {
              ...process.env,
              TEST_DATABASE_URL: suiteUrl.href,
              NODE_ENV: "test",
            },
          }
        )
        child.on("error", reject)
        child.on("exit", (code) => resolve(code ?? 1))
      })
      if (code !== 0) failures++
    } finally {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
    }
  }
} finally {
  await admin.end()
}
console.log(
  `${suites.length - failures}/${suites.length} integration suites passed`
)
process.exitCode = failures ? 1 : 0
