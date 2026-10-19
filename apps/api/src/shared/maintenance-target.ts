import { z } from "zod"
export const MaintenanceTargetSchema = z
  .object({
    host: z.string().min(1),
    port: z.string().regex(/^[0-9]+$/),
    database: z.string().min(1),
  })
  .strict()
export type MaintenanceTarget = z.infer<typeof MaintenanceTargetSchema>
export function maintenanceTarget(connectionString: string): MaintenanceTarget {
  try {
    const url = new URL(connectionString)
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error()
    return MaintenanceTargetSchema.parse({
      host: url.hostname,
      port: url.port || "5432",
      database: decodeURIComponent(url.pathname.slice(1)),
    })
  } catch {
    throw new Error("A valid PostgreSQL DATABASE_URL is required")
  }
}
