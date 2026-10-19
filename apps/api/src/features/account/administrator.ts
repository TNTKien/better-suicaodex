import { z } from "zod"

import type { Database } from "../../db/client.js"
import { setAdministrator } from "../groups/service.js"
import type { Auth } from "./auth.js"

export const CreateAdministratorSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
  actorUserId: z.string().trim().min(1).optional(),
})

export async function createAdministrator(
  database: Database,
  auth: Auth,
  input: z.infer<typeof CreateAdministratorSchema>
) {
  const values = CreateAdministratorSchema.parse(input)
  const result = await auth.api.createUser({
    body: {
      email: values.email,
      name: values.name,
      password: values.password,
      role: "user",
      data: { emailVerified: true },
    },
  })

  try {
    await setAdministrator(
      database,
      result.user.id,
      "grant",
      values.actorUserId
    )
  } catch (error) {
    throw new Error(
      `Credential user ${result.user.id} was created without admin access; retry with admin:access`,
      { cause: error }
    )
  }

  return result.user
}
