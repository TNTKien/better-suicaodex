import { utf16MaxLength } from "@workspace/ui/lib/string-length"
import { z } from "zod"

import type { components } from "@/src/lib/generated/api"

export type TagList = components["schemas"]["TagList"]
export type TagSummary = components["schemas"]["TagSummary"]

export const tagListSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      slug: z
        .string()
        .min(1)
        .check(...utf16MaxLength(160))
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      name: z.string(),
      group: z.string(),
    })
  ),
}) satisfies z.ZodType<TagList>
