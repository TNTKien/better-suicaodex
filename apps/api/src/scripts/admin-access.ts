import { z } from "zod"
import { createDatabase } from "../db/client.js"
import { setAdministrator } from "../features/groups/service.js"

const [action, userId, actorUserId] = process.argv.slice(2)
const input = z
  .object({
    action: z.enum(["grant", "revoke"]),
    userId: z.string().trim().min(1),
    actorUserId: z.string().trim().min(1).optional(),
  })
  .parse({ action, userId, actorUserId })
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
const { db, pool } = createDatabase(process.env.DATABASE_URL)
try {
  await setAdministrator(db, input.userId, input.action, input.actorUserId)
  console.info(
    `Administrator ${input.action} completed; audit recorded for changes`
  )
} finally {
  await pool.end()
}
