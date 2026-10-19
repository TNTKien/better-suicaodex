import { tz } from "@date-fns/tz"
import { getYear } from "date-fns"
import { z } from "zod"

export const MAX_PUBLICATION_YEAR = getYear(new Date(), { in: tz("UTC") }) + 1

const compactText = (max: number, required = false) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(
          required ? 1 : 0,
          required ? "Vui lòng nhập tên truyện." : undefined
        )
        .max(max, `Tối đa ${max} ký tự.`)
    )

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự.`)
    .transform((value) => value || null)

const optionalUrl = z
  .string()
  .trim()
  .max(500, "URL tối đa 500 ký tự.")
  .refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password
      )
    } catch {
      return false
    }
  }, "Vui lòng nhập URL HTTP(S) đầy đủ.")
  .transform((value) => value || undefined)

export const mangaFormSchema = z
  .object({
    title: compactText(255, true),
    alternativeTitles: z
      .array(compactText(255))
      .max(50)
      .transform((titles) => [...new Set(titles.filter(Boolean))]),
    description: z
      .string()
      .trim()
      .max(20_000, "Mô tả tối đa 20.000 ký tự.")
      .refine(
        (value) => !/<(?:!--|\/?[a-z][^>]*>)/i.test(value),
        "Mô tả không hỗ trợ HTML."
      )
      .refine(
        (value) => !/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/i.test(value),
        "Mô tả không hỗ trợ ảnh Markdown."
      )
      .transform((value) => value || null),
    originalLanguage: z
      .string()
      .trim()
      .min(2, "Vui lòng chọn ngôn ngữ gốc.")
      .max(35),
    publicationDemographic: z
      .enum(["shounen", "shoujo", "josei", "seinen"])
      .nullable(),
    status: z.enum(["ongoing", "completed", "hiatus", "cancelled"]),
    contentRating: z.enum(["safe", "suggestive", "erotica"]),
    year: z
      .string()
      .trim()
      .refine(
        (value) => !value || /^\d{1,4}$/.test(value),
        "Năm phát hành phải là số nguyên."
      )
      .refine(
        (value) => !value || Number(value) >= 1,
        "Năm phát hành không hợp lệ."
      )
      .refine(
        (value) => !value || Number(value) <= MAX_PUBLICATION_YEAR,
        `Năm phát hành không được lớn hơn ${MAX_PUBLICATION_YEAR}.`
      )
      .transform((value) => (value ? Number(value) : null)),
    lastVolume: optionalText(32),
    lastChapter: optionalText(32),
    links: z.object({
      al: optionalUrl.optional(),
      amz: optionalUrl.optional(),
      ap: optionalUrl.optional(),
      bw: optionalUrl.optional(),
      cdj: optionalUrl.optional(),
      ebj: optionalUrl.optional(),
      engtl: optionalUrl.optional(),
      kt: optionalUrl.optional(),
      mal: optionalUrl.optional(),
      mu: optionalUrl.optional(),
      raw: optionalUrl.optional(),
    }),
    tagIds: z.array(z.uuid()).max(50),
    authorIds: z.array(z.uuid()).max(20),
    artistIds: z.array(z.uuid()).max(20),
    groupIds: z.array(z.uuid()).max(20),
    cover: z
      .instanceof(File)
      .refine(
        (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
        "Ảnh bìa phải là JPEG, PNG hoặc WebP."
      )
      .refine(
        (file) => file.size <= 5 * 1024 * 1024,
        "Ảnh bìa không được vượt quá 5MB."
      )
      .nullable(),
    coverUploadId: z.uuid().nullable(),
  })
  .strict()

export type MangaFormInput = z.input<typeof mangaFormSchema>
export type MangaFormValues = z.output<typeof mangaFormSchema>
