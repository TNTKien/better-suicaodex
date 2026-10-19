import { readFile, writeFile } from "node:fs/promises"

import { createApp } from "../app.js"
import type { ProfileDependencies } from "../features/account/routes.js"
import type { CatalogDependencies } from "../features/catalog/routes.js"

const noop = () => undefined
const root = new URL("../../", import.meta.url)
const output = new URL("openapi.json", root)

async function generate() {
  const catalog = {
    assetBaseUrl: "https://assets.example.com/",
    cache: undefined,
    database: undefined,
  } as unknown as CatalogDependencies
  const account = {
    database: undefined,
  } as unknown as Pick<ProfileDependencies, "database">
  const app = createApp({ account, catalog, logger: noop })
  const document = await (await app.request("/openapi.json")).json()
  const specification = `${JSON.stringify(document, null, 2)}\n`
  return specification
}

async function main() {
  const generated = await generate()
  if (process.argv.includes("--check")) {
    const current = await readFile(output, "utf8").catch(() => "")
    if (current !== generated) {
      throw new Error(`Generated API contract is stale: ${output.pathname}`)
    }
    return
  }

  await writeFile(output, generated)
}

await main()
