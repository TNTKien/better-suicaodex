import { z } from "zod"

const decimal = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^(?:0|[1-9]\d{0,6})(?:\.\d)?$/.test(value),
    "Chỉ nhận số không âm, tối đa 1 chữ số thập phân."
  )
  .transform((value) => {
    if (!value) return null
    return value.includes(".")
      ? value.replace(/0+$/, "").replace(/\.$/, "")
      : value
  })

export const chapterFormSchema = z
  .object({
    groupIds: z.array(z.uuid()).max(20),
    oneShot: z.boolean(),
    volumeNumber: decimal,
    number: decimal,
    title: z
      .string()
      .trim()
      .max(255, "Tiêu đề tối đa 255 ký tự.")
      .transform((value) => value || null),
  })
  .transform(({ oneShot, ...values }) => ({
    ...values,
    number: oneShot ? null : values.number,
    volumeNumber: oneShot ? null : values.volumeNumber,
    language: "vi" as const,
  }))

export type ChapterFormInput = z.input<typeof chapterFormSchema>
export type ChapterFormValues = z.output<typeof chapterFormSchema>
