import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

import { defineConfig, devices } from "@playwright/test"

const webDirectory = fileURLToPath(new URL(".", import.meta.url))
const apiDirectory = resolve(webDirectory, "../api")
const apiFileEnv = parseEnv(readFileSync(resolve(apiDirectory, ".env"), "utf8"))
if (!apiFileEnv.TEST_DATABASE_URL)
  throw new Error(
    "apps/api/.env must define TEST_DATABASE_URL for browser tests"
  )

const stringEnv = (values: NodeJS.ProcessEnv) =>
  Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] =>
      Boolean(entry[1])
    )
  )
const apiUrl = "http://localhost:3101"
const webUrl = "http://localhost:3100"
const sharedEnv = stringEnv({ ...process.env, ...apiFileEnv })
const apiEnv = stringEnv({
  ...sharedEnv,
  NODE_ENV: "test",
  PORT: "3101",
  DATABASE_URL: apiFileEnv.TEST_DATABASE_URL,
  REDIS_CACHE_ENABLED: "false",
  WEB_ORIGIN: webUrl,
  BETTER_AUTH_URL: apiUrl,
})
const webEnv = stringEnv({
  ...process.env,
  API_URL: apiUrl,
  NEXT_PUBLIC_API_URL: apiUrl,
  WEB_URL: webUrl,
  INTERNAL_API_KEY: apiFileEnv.INTERNAL_API_KEY,
})

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: apiDirectory,
      env: apiEnv,
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run dev -- --hostname localhost --port 3100",
      cwd: webDirectory,
      env: webEnv,
      url: webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
