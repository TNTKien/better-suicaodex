import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  SlugSchema,
  TimestampSchema,
} from "../../shared/contract.js"
import { CoverSchema, PersonSummarySchema } from "../catalog/contract.js"

const compactText = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(max))
const language = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
const uniqueIds = (max: number) =>
  z
    .array(IdSchema)
    .max(max)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: "custom",
          message: "Duplicate IDs are not allowed",
        })
    })
const alternativeTitles = z
  .array(compactText(255))
  .max(50)
  .default([])
  .transform((titles) => {
    const normalized: Record<string, string[]> = {}
    const unique = Array.from(new Set(titles))
    if (unique.length) normalized.und = unique
    return normalized
  })
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => value || null)
const optionalMarkdown = optionalText(20_000)
  .refine(
    (value) => !value || !/<(?:!--|\/?[a-z][^>]*>)/i.test(value),
    "HTML is not allowed"
  )
  .refine(
    (value) => !value || !/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/i.test(value),
    "Markdown images are not allowed"
  )
const externalUrl = z
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value)
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    )
  }, "Must be a valid HTTP(S) URL")
const serviceIdentifier = (hosts: readonly string[], pathPrefix: string) =>
  externalUrl.transform((value, context) => {
    const url = new URL(value)
    const identifier = url.pathname.slice(pathPrefix.length).split("/", 1)[0]
    if (
      !hosts.includes(url.hostname.toLowerCase()) ||
      !url.pathname.startsWith(pathPrefix) ||
      !identifier
    ) {
      context.addIssue({ code: "custom", message: "Unsupported service URL" })
      return z.NEVER
    }
    return identifier
  })
const serviceUrl = (hosts: readonly string[]) =>
  externalUrl.refine(
    (value) => hosts.includes(new URL(value).hostname.toLowerCase()),
    "Unsupported service URL"
  )
const links = z
  .object({
    al: serviceIdentifier(
      ["anilist.co", "www.anilist.co"],
      "/manga/"
    ).optional(),
    amz: externalUrl.optional(),
    ap: serviceIdentifier(
      ["anime-planet.com", "www.anime-planet.com"],
      "/manga/"
    ).optional(),
    bw: serviceUrl(["bookwalker.jp", "www.bookwalker.jp"]).optional(),
    cdj: externalUrl.optional(),
    ebj: externalUrl.optional(),
    engtl: externalUrl.optional(),
    kt: serviceIdentifier(["kitsu.io", "www.kitsu.io"], "/manga/").optional(),
    mal: serviceIdentifier(
      ["myanimelist.net", "www.myanimelist.net"],
      "/manga/"
    ).optional(),
    mu: serviceIdentifier(
      ["mangaupdates.com", "www.mangaupdates.com"],
      "/series/"
    ).optional(),
    raw: externalUrl.optional(),
  })
  .strict()
  .default({})

const fields = {
  title: compactText(255),
  alternativeTitles,
  description: optionalMarkdown,
  originalLanguage: language,
  publicationDemographic: z
    .enum(["shounen", "shoujo", "josei", "seinen"])
    .nullable()
    .default(null),
  status: z.enum(["ongoing", "completed", "hiatus", "cancelled"]),
  contentRating: z.enum(["safe", "suggestive", "erotica"]),
  year: z.number().int().min(1).max(9999).nullable().default(null),
  lastVolume: optionalText(32),
  lastChapter: optionalText(32),
  links,
  tagIds: uniqueIds(50).default([]),
  authorIds: uniqueIds(20).default([]),
  artistIds: uniqueIds(20).default([]),
}
export const MangaCreateInputSchema = z
  .object({
    ...fields,
    slug: SlugSchema.optional(),
    coverUploadId: IdSchema.optional(),
    groupIds: uniqueIds(20).default([]),
  })
  .strict()
  .openapi("MangaCreateInput")
export const MangaUpdateInputSchema = z
  .object({
    ...fields,
    slug: SlugSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .openapi("MangaUpdateInput")
export type MangaCreateInput = z.infer<typeof MangaCreateInputSchema>
export type MangaUpdateInput = z.infer<typeof MangaUpdateInputSchema>

export const MangaManagementSummarySchema = z
  .object({
    id: IdSchema,
    numberingMode: z.enum(["global", "volume"]),
    slug: SlugSchema,
    title: z.string(),
    alternativeTitles: z.record(z.string(), z.array(z.string())),
    publicationState: z.enum(["published", "hidden"]),
    moderationHiddenAt: TimestampSchema.nullable(),
    moderationReason: z.string().nullable(),
    originalLanguage: z.string(),
    status: z.enum(["ongoing", "completed", "hiatus", "cancelled"]),
    contentRating: z.enum(["safe", "suggestive", "erotica", "pornographic"]),
    cover: CoverSchema.nullable(),
    updatedAt: TimestampSchema,
    version: z.number().int().positive(),
    ownerGroupId: IdSchema,
    isOwner: z.boolean(),
  })
  .openapi("MangaManagementSummary")
export const MangaManagementDetailSchema = MangaManagementSummarySchema.extend({
  description: z.string().nullable(),
  publicationDemographic: z
    .enum(["shounen", "shoujo", "josei", "seinen"])
    .nullable(),
  year: z.number().int().nullable(),
  lastVolume: z.string().nullable(),
  lastChapter: z.string().nullable(),
  links: z.record(z.string(), z.string()),
  tagIds: z.array(IdSchema),
  authorIds: z.array(IdSchema),
  artistIds: z.array(IdSchema),
  volumes: z.array(z.object({ id: IdSchema, number: z.string() })),
  owners: z.array(
    z.object({ id: IdSchema, name: z.string(), slug: SlugSchema })
  ),
  ownerGroup: z.object({ id: IdSchema, name: z.string(), slug: SlugSchema }),
  groups: z.array(
    z.object({ id: IdSchema, name: z.string(), slug: SlugSchema })
  ),
  createdAt: TimestampSchema,
  publishedAt: TimestampSchema.nullable(),
}).openapi("MangaManagementDetail")
export type MangaManagementDetail = z.infer<typeof MangaManagementDetailSchema>

export const PersonCreateInputSchema = z
  .object({ name: compactText(160) })
  .strict()
  .openapi("PersonCreateInput")

const params = z.object({ groupId: IdSchema })
const mangaParams = params.extend({ mangaId: IdSchema })
const volumeParams = mangaParams.extend({ volumeId: IdSchema })
const expectedVersion = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict()
export const VolumeInputSchema = expectedVersion.extend({
  number: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().regex(/^(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/)),
})

const json = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
})
const ok = <T extends z.ZodType>(schema: T) => ({
  description: "Success",
  content: { "application/json": { schema } },
})
const errors = {
  400: ok(ApiErrorSchema),
  401: ok(ApiErrorSchema),
  403: ok(ApiErrorSchema),
  404: ok(ApiErrorSchema),
  409: ok(ApiErrorSchema),
  413: ok(ApiErrorSchema),
  429: ok(ApiErrorSchema),
}
const detailResponse = {
  200: ok(z.object({ data: MangaManagementDetailSchema })),
  ...errors,
}
const mutationResponse = {
  204: { description: "Mutation committed" },
  ...errors,
}
const tags = ["contribution-manga"]
const root = "/v1/contribution/groups/{groupId}/manga"

export const createPersonRoute = createRoute({
  method: "post",
  path: "/v1/contribution/groups/{groupId}/people",
  tags,
  request: { params, body: json(PersonCreateInputSchema) },
  responses: {
    201: ok(z.object({ data: PersonSummarySchema })),
    ...errors,
  },
})

export const listGroupMangaRoute = createRoute({
  method: "get",
  path: root,
  tags,
  request: {
    params,
    query: PageQuerySchema.extend({
      q: z.string().trim().min(1).max(160).optional(),
      publicationState: z.enum(["published", "hidden"]).optional(),
    }),
  },
  responses: {
    200: ok(
      z.object({
        data: z.array(MangaManagementSummarySchema),
        meta: PageMetaSchema,
      })
    ),
    ...errors,
  },
})
export const createMangaRoute = createRoute({
  method: "post",
  path: root,
  tags,
  request: { params, body: json(MangaCreateInputSchema) },
  responses: {
    201: ok(z.object({ data: MangaManagementDetailSchema })),
    ...errors,
  },
})
export const getGroupMangaRoute = createRoute({
  method: "get",
  path: `${root}/{mangaId}`,
  tags,
  request: { params: mangaParams },
  responses: detailResponse,
})
export const updateMangaRoute = createRoute({
  method: "put",
  path: `${root}/{mangaId}`,
  tags,
  request: { params: mangaParams, body: json(MangaUpdateInputSchema) },
  responses: detailResponse,
})
export const setMangaVisibilityRoute = createRoute({
  method: "post",
  path: `${root}/{mangaId}/visibility`,
  tags,
  request: {
    params: mangaParams,
    body: json(expectedVersion.extend({ hidden: z.boolean() })),
  },
  responses: detailResponse,
})
export const deleteMangaRoute = createRoute({
  method: "delete",
  path: `${root}/{mangaId}`,
  tags,
  request: { params: mangaParams, body: json(expectedVersion) },
  responses: mutationResponse,
})
const volumeResponse = ok(
  z.object({
    data: z.object({ id: IdSchema, number: z.string() }),
    mangaVersion: z.number().int().positive(),
  })
)
export const createVolumeRoute = createRoute({
  method: "post",
  path: `${root}/{mangaId}/volumes`,
  tags,
  request: { params: mangaParams, body: json(VolumeInputSchema) },
  responses: { 201: volumeResponse, ...errors },
})
export const updateVolumeRoute = createRoute({
  method: "put",
  path: `${root}/{mangaId}/volumes/{volumeId}`,
  tags,
  request: { params: volumeParams, body: json(VolumeInputSchema) },
  responses: { 200: volumeResponse, ...errors },
})
export const deleteVolumeRoute = createRoute({
  method: "delete",
  path: `${root}/{mangaId}/volumes/{volumeId}`,
  tags,
  request: { params: volumeParams, body: json(expectedVersion) },
  responses: mutationResponse,
})
