import { mkdir, readFile, writeFile } from "node:fs/promises"

import openapiTS, { astToString } from "openapi-typescript"

const schema = new URL("../../api/openapi.json", import.meta.url)
const output = new URL("../src/lib/generated/api.ts", import.meta.url)

async function generate() {
  const contents = astToString(
    await openapiTS(schema, { alphabetize: true, silent: true })
  )
  return `// Generated from apps/api/openapi.json. Do not edit.\n${contents}`
}

const generated = await generate()
if (process.argv.includes("--check")) {
  const current = await readFile(output, "utf8").catch(() => "")
  if (current !== generated) {
    throw new Error(`Generated API types are stale: ${output.pathname}`)
  }
} else {
  await mkdir(new URL(".", output), { recursive: true })
  await writeFile(output, generated)
}
