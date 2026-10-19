import { Writable } from "node:stream"
import { createInterface } from "node:readline/promises"

import { createDatabase } from "../db/client.js"
import {
  createAdministrator,
  CreateAdministratorSchema,
} from "../features/account/administrator.js"
import { createAuth } from "../features/account/auth.js"
import { parseRuntimeEnv } from "../shared/env.js"

async function readSecret(label: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("Password prompt requires an interactive terminal")

  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  const prompt = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
  })
  process.stdout.write(label)
  try {
    return await prompt.question("")
  } finally {
    prompt.close()
    process.stdout.write("\n")
  }
}

async function main() {
  const [email, name, actorUserId] = process.argv.slice(2)
  if (!email || !name)
    throw new Error(
      "Usage: bun run admin:create -- <email> <name> [actorUserId]"
    )

  const password = await readSecret("Password: ")
  const confirmation = await readSecret("Confirm password: ")
  if (password !== confirmation) throw new Error("Passwords do not match")

  const env = parseRuntimeEnv(process.env)
  const database = createDatabase(env.DATABASE_URL)
  try {
    const created = await createAdministrator(
      database.db,
      createAuth(env, database.db),
      CreateAdministratorSchema.parse({
        email,
        name,
        password,
        actorUserId,
      })
    )
    console.info(`Administrator created: ${created.id} (${created.email})`)
  } finally {
    await database.pool.end()
  }
}

await main()
