import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  SortDirectionSchema,
  TimestampSchema,
} from "../../shared/contract.js"

const decimal = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/))
  .transform((value) =>
    value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value
  )
const optionalDecimal = decimal.nullable().default(null)
const optionalTitle = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .default(null)
  .transform((value) => value || null)
const language = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  .default("vi")

const metadata = {
  number: optionalDecimal,
  volumeNumber: optionalDecimal,
  title: optionalTitle,
  language,
}
const groupIds = z
  .array(IdSchema)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Duplicate group IDs are not allowed",
  })
  .default([])
export const ChapterCreateInputSchema = z
  .object({ ...metadata, groupIds })
  .strict()
  .openapi("ChapterCreateInput")
export const ChapterUpdateInputSchema = z
  .object({
    ...metadata,
    expectedVersion: z.number().int().positive(),
    uploadSessionId: IdSchema.optional(),
  })
  .strict()
  .openapi("ChapterUpdateInput")
export type ChapterCreateInput = z.infer<typeof ChapterCreateInputSchema>
export type ChapterUpdateInput = z.infer<typeof ChapterUpdateInputSchema>

const ChapterVolumeSchema = z.object({ id: IdSchema, number: z.string() })
const UploadStateSchema = z.enum([
  "open",
  "finalizing",
  "completed",
  "cancelled",
  "cleaning",
  "cleaned",
])
const UploadModeSchema = z.enum(["initial", "replacement"])
const ProcessingStateSchema = z.enum(["idle", "queued", "processing", "failed"])
const UploadPageSchema = z
  .object({
    id: IdSchema,
    state: z.enum(["uploading", "ready", "deleting"]),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    sourceByteSize: z.number().int().positive().nullable(),
    storedByteSize: z.number().int().positive().nullable(),
    previewUrl: z.url().nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("ChapterUploadPage")
const ActiveUploadSessionSchema = z.object({
  id: IdSchema,
  mode: UploadModeSchema,
  state: z.enum(["open", "finalizing"]),
  processingState: ProcessingStateSchema,
  failureReason: z.string().nullable(),
  readyPageCount: z.number().int().min(0),
  expiresAt: TimestampSchema,
})

export const ChapterManagementSummarySchema = z
  .object({
    id: IdSchema,
    isDefault: z.boolean(),
    mangaId: IdSchema,
    volume: ChapterVolumeSchema.nullable(),
    number: z.string().nullable(),
    title: z.string().nullable(),
    language: z.string(),
    publicationState: z.enum(["draft", "published"]),
    moderationHiddenAt: TimestampSchema.nullable(),
    moderationReason: z.string().nullable(),
    processingState: ProcessingStateSchema,
    pageCount: z.number().int().min(0),
    stagedPageCount: z.number().int().min(0),
    availablePageCount: z.number().int().min(0),
    isFull: z.boolean(),
    updatedAt: TimestampSchema,
    version: z.number().int().positive(),
    ownerGroupId: IdSchema,
    isOwner: z.boolean(),
  })
  .openapi("ChapterManagementSummary")
export const ChapterManagementDetailSchema =
  ChapterManagementSummarySchema.extend({
    groups: z.array(
      z.object({ id: z.string(), name: z.string(), slug: z.string() })
    ),
    ownerGroup: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    }),
    activeUploadSession: ActiveUploadSessionSchema.nullable(),
    createdAt: TimestampSchema,
    publishedAt: TimestampSchema.nullable(),
  }).openapi("ChapterManagementDetail")
export type ChapterManagementDetail = z.infer<
  typeof ChapterManagementDetailSchema
>

export const ChapterUploadSessionSchema = z
  .object({
    id: IdSchema,
    chapterId: IdSchema.nullable(),
    mangaId: IdSchema,
    mode: UploadModeSchema,
    state: UploadStateSchema,
    processingState: ProcessingStateSchema,
    failureReason: z.string().nullable(),
    expectedChapterVersion: z.number().int().positive().nullable(),
    orderedPageIds: z.array(IdSchema).max(220),
    pages: z.array(UploadPageSchema).max(220),
    expiresAt: TimestampSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .openapi("ChapterUploadSession")
export type ChapterUploadSession = z.infer<typeof ChapterUploadSessionSchema>

export const ChapterUploadDiagnosticSchema = z
  .object({
    uploadRequestId: IdSchema,
    pageId: IdSchema,
    outcome: z.enum(["timeout", "network_error", "aborted", "http_error"]),
    status: z.number().int().min(0).max(599),
    elapsedMs: z.number().int().min(0).max(600_000),
    sourceBytes: z
      .number()
      .int()
      .positive()
      .max(12 * 1024 * 1024),
    transferredBytes: z
      .number()
      .int()
      .min(0)
      .max(13 * 1024 * 1024),
    totalBytes: z
      .number()
      .int()
      .min(0)
      .max(13 * 1024 * 1024),
    transferComplete: z.boolean(),
  })
  .strict()
  .openapi("ChapterUploadDiagnostic")

const params = z.object({ groupId: IdSchema, mangaId: IdSchema })
const chapterParams = params.extend({ chapterId: IdSchema })
const sessionParams = chapterParams.extend({ sessionId: IdSchema })
const pageParams = sessionParams.extend({ pageId: IdSchema })
const stagingParams = params.extend({ sessionId: IdSchema })
const stagingPageParams = stagingParams.extend({ pageId: IdSchema })
const publicPagePreviewParams = z.object({
  file: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i
    ),
})
const expectedVersion = z.number().int().positive()
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
  503: ok(ApiErrorSchema),
}
const detailResponse = {
  200: ok(z.object({ data: ChapterManagementDetailSchema })),
  ...errors,
}
const sessionResponse = {
  200: ok(z.object({ data: ChapterUploadSessionSchema })),
  ...errors,
}
const pageUploadBody = {
  required: true as const,
  content: {
    "multipart/form-data": {
      schema: z
        .object({
          page: z.file().openapi({ type: "string", format: "binary" }),
          pageId: IdSchema,
        })
        .strict(),
    },
  },
}
const pageOrderInput = z
  .object({ pageIds: z.array(IdSchema).max(220) })
  .strict()
  .superRefine(({ pageIds }, context) => {
    if (new Set(pageIds).size !== pageIds.length)
      context.addIssue({
        code: "custom",
        path: ["pageIds"],
        message: "Duplicate page IDs are not allowed",
      })
  })
export const ChapterFinalizeInputSchema = z
  .object({
    expectedVersion,
    pageIds: z.array(IdSchema).min(1).max(220),
  })
  .strict()
  .superRefine(({ pageIds }, context) => {
    if (new Set(pageIds).size !== pageIds.length)
      context.addIssue({
        code: "custom",
        path: ["pageIds"],
        message: "Duplicate page IDs are not allowed",
      })
  })
  .openapi("ChapterFinalizeInput")
export type ChapterFinalizeInput = z.infer<typeof ChapterFinalizeInputSchema>
const tags = ["contribution-chapters"]
const root = "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters"
const stagingRoot =
  "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads"

export const previewChapterUploadPageRoute = createRoute({
  method: "get",
  path: "/uploads/chapters/tmp/{file}",
  tags,
  request: { params: publicPagePreviewParams },
  responses: {
    200: {
      description: "Public temporary chapter page preview",
      content: {
        "image/webp": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    404: ok(ApiErrorSchema),
    503: ok(ApiErrorSchema),
  },
})

export const listChaptersRoute = createRoute({
  method: "get",
  path: root,
  tags,
  request: {
    params,
    query: PageQuerySchema.extend({
      publicationState: z.enum(["draft", "published"]).optional(),
      sort: z.enum(["volume", "chapter", "updatedAt"]).default("updatedAt"),
      direction: SortDirectionSchema.default("desc"),
    }),
  },
  responses: {
    200: ok(
      z.object({
        data: z.array(ChapterManagementSummarySchema),
        meta: PageMetaSchema,
      })
    ),
    ...errors,
  },
})
export const createChapterRoute = createRoute({
  method: "post",
  path: root,
  tags,
  request: { params, body: json(ChapterCreateInputSchema) },
  responses: {
    201: ok(z.object({ data: ChapterManagementDetailSchema })),
    ...errors,
  },
})
export const getChapterRoute = createRoute({
  method: "get",
  path: `${root}/{chapterId}`,
  tags,
  request: { params: chapterParams },
  responses: detailResponse,
})
export const updateChapterRoute = createRoute({
  method: "put",
  path: `${root}/{chapterId}`,
  tags,
  request: { params: chapterParams, body: json(ChapterUpdateInputSchema) },
  responses: detailResponse,
})
export const deleteChapterRoute = createRoute({
  method: "delete",
  path: `${root}/{chapterId}`,
  tags,
  request: {
    params: chapterParams,
    body: json(z.object({ expectedVersion }).strict()),
  },
  responses: { 204: { description: "Chapter deleted" }, ...errors },
})
export const createChapterUploadRoute = createRoute({
  method: "post",
  path: `${root}/{chapterId}/uploads`,
  tags,
  request: {
    params: chapterParams,
    body: json(z.object({ mode: UploadModeSchema, expectedVersion }).strict()),
  },
  responses: sessionResponse,
})
export const getChapterUploadRoute = createRoute({
  method: "get",
  path: `${root}/{chapterId}/uploads/{sessionId}`,
  tags,
  request: { params: sessionParams },
  responses: sessionResponse,
})
export const uploadChapterPageRoute = createRoute({
  method: "post",
  path: `${root}/{chapterId}/uploads/{sessionId}/pages`,
  tags,
  request: {
    params: sessionParams,
    body: pageUploadBody,
  },
  responses: { 200: ok(z.object({ data: UploadPageSchema })), ...errors },
})
export const reportChapterUploadDiagnosticRoute = createRoute({
  method: "post",
  path: `${root}/{chapterId}/uploads/{sessionId}/diagnostics`,
  tags,
  request: { params: sessionParams, body: json(ChapterUploadDiagnosticSchema) },
  responses: { 204: { description: "Client diagnostic logged" }, ...errors },
})
export const deleteChapterPageRoute = createRoute({
  method: "delete",
  path: `${root}/{chapterId}/uploads/{sessionId}/pages/{pageId}`,
  tags,
  request: { params: pageParams },
  responses: { 204: { description: "Staging page deleted" }, ...errors },
})
export const orderChapterPagesRoute = createRoute({
  method: "put",
  path: `${root}/{chapterId}/uploads/{sessionId}/order`,
  tags,
  request: {
    params: sessionParams,
    body: json(pageOrderInput),
  },
  responses: sessionResponse,
})
export const cancelChapterUploadRoute = createRoute({
  method: "delete",
  path: `${root}/{chapterId}/uploads/{sessionId}`,
  tags,
  request: { params: sessionParams },
  responses: { 204: { description: "Upload session cancelled" }, ...errors },
})
export const finalizeChapterUploadRoute = createRoute({
  method: "post",
  path: `${root}/{chapterId}/uploads/{sessionId}/finalize`,
  tags,
  request: {
    params: sessionParams,
    body: json(ChapterFinalizeInputSchema),
  },
  responses: {
    202: ok(z.object({ data: ChapterManagementDetailSchema })),
    ...errors,
  },
})

export const createChapterStagingRoute = createRoute({
  method: "post",
  path: stagingRoot,
  tags,
  request: { params },
  responses: sessionResponse,
})
export const getChapterStagingRoute = createRoute({
  method: "get",
  path: `${stagingRoot}/{sessionId}`,
  tags,
  request: { params: stagingParams },
  responses: sessionResponse,
})
export const uploadChapterStagingPageRoute = createRoute({
  method: "post",
  path: `${stagingRoot}/{sessionId}/pages`,
  tags,
  request: { params: stagingParams, body: pageUploadBody },
  responses: { 200: ok(z.object({ data: UploadPageSchema })), ...errors },
})
export const reportChapterStagingDiagnosticRoute = createRoute({
  method: "post",
  path: `${stagingRoot}/{sessionId}/diagnostics`,
  tags,
  request: { params: stagingParams, body: json(ChapterUploadDiagnosticSchema) },
  responses: { 204: { description: "Client diagnostic logged" }, ...errors },
})
export const deleteChapterStagingPageRoute = createRoute({
  method: "delete",
  path: `${stagingRoot}/{sessionId}/pages/{pageId}`,
  tags,
  request: { params: stagingPageParams },
  responses: { 204: { description: "Staging page deleted" }, ...errors },
})
export const orderChapterStagingPagesRoute = createRoute({
  method: "put",
  path: `${stagingRoot}/{sessionId}/order`,
  tags,
  request: { params: stagingParams, body: json(pageOrderInput) },
  responses: sessionResponse,
})
export const cancelChapterStagingRoute = createRoute({
  method: "delete",
  path: `${stagingRoot}/{sessionId}`,
  tags,
  request: { params: stagingParams },
  responses: { 204: { description: "Upload session cancelled" }, ...errors },
})
export const commitChapterStagingRoute = createRoute({
  method: "post",
  path: `${stagingRoot}/{sessionId}/commit`,
  tags,
  request: { params: stagingParams, body: json(ChapterCreateInputSchema) },
  responses: {
    201: ok(z.object({ data: ChapterManagementDetailSchema })),
    ...errors,
  },
})
