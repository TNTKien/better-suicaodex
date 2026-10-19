import { z } from "zod"

function hasAllowedHost(value: string, domains: readonly string[]) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    )
  } catch {
    return false
  }
}

export const groupFormSchema = z
  .object({
    name: z
      .string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(
        z
          .string()
          .min(1, "Vui lòng nhập tên nhóm.")
          .max(80, "Tên nhóm tối đa 80 ký tự.")
      ),
    description: z
      .string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().max(1_000, "Mô tả tối đa 1.000 ký tự.")),
    facebook: z
      .string()
      .trim()
      .max(220, "Liên kết Facebook tối đa 220 ký tự.")
      .refine(
        (value) => !value || hasAllowedHost(value, ["facebook.com", "fb.com"]),
        "Liên kết Facebook không hợp lệ."
      ),
    discord: z
      .string()
      .trim()
      .max(220, "Liên kết Discord tối đa 220 ký tự.")
      .refine(
        (value) =>
          !value ||
          /^[a-z0-9_-]+$/i.test(value.replace(/^@/, "")) ||
          hasAllowedHost(value, ["discord.gg", "discord.com"]),
        "Liên kết hoặc mã mời Discord không hợp lệ."
      ),
  })
  .strict()

export const adminGroupFormSchema = groupFormSchema.extend({
  leaderUserId: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập ID tài khoản trưởng nhóm.")
    .max(128, "ID tài khoản tối đa 128 ký tự."),
})

export type GroupFormInput = z.input<typeof groupFormSchema>
export type GroupFormValues = z.output<typeof groupFormSchema>
export type AdminGroupFormInput = z.input<typeof adminGroupFormSchema>
export type AdminGroupFormValues = z.output<typeof adminGroupFormSchema>
