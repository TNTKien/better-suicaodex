import { expect, test } from "bun:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import { addHours, parseISO } from "date-fns"
import sharp from "sharp"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { requestId } from "hono/request-id"

import type { Database } from "../../src/db/client"
import {
  chapter,
  chapterGroup,
  chapterUploadPage,
  chapterUploadSession,
  manga,
  mangaGroup,
  member,
  organization,
  user,
  userProfile,
} from "../../src/db/schema"
import { apiError } from "../../src/shared/contract"
import type { Logger } from "../../src/shared/logger"
import {
  ChapterUploadDiagnosticSchema,
  reportChapterStagingDiagnosticRoute,
  reportChapterUploadDiagnosticRoute,
} from "../../src/features/groups/chapter-contract"
import {
  registerChapterRoutes,
  type Dependencies,
} from "../../src/features/groups/chapter"
import { chapterPageUploadTrace } from "../../src/features/groups/chapter-upload-log"
import { GroupError } from "../../src/features/groups/service"
import { CHAPTER_PAGE_MULTIPART_MAX_BYTES } from "../../src/features/groups/chapter-image"

const groupId = "3654281a-b35c-4e9d-8413-b40e944c9edd"
const mangaId = "ce450cab-5c61-42cb-9367-60f90152849a"
const chapterId = "e7a8b836-0f8a-4665-8258-df5be2f14a79"
const sessionId = "bfc15927-10d4-4d0f-a174-227f142ad8c7"
const actor = "c39ade5e-75a9-4d92-a1e1-e1d6d9cdedcd"
const diagnostic = {
  uploadRequestId: "22e6f0ed-aa76-4a11-a498-14030c7a5fa2",
  pageId: "8f1b2f60-79fa-440b-8e96-d242227ab31f",
  outcome: "timeout",
  status: 0,
  elapsedMs: 90_000,
  sourceBytes: 1_000_000,
  transferredBytes: 300_000,
  totalBytes: 1_000_400,
  transferComplete: false,
}

type Log = {
  level: Parameters<Logger>[0]
  event: string
  fields?: Parameters<Logger>[2]
}
function logCapture() {
  const logs: Log[] = []
  const log: Logger = (level, event, fields) =>
    logs.push({ level, event, fields: { ...fields } })
  return { log, logs }
}

test("upload timing records distinct phases and never serializes raw errors", () => {
  const { log, logs } = logCapture()
  let tick = 10
  const trace = chapterPageUploadTrace(
    log,
    { requestId: diagnostic.uploadRequestId, sessionId },
    () => tick
  )
  tick = 30
  trace.annotate({ pageId: diagnostic.pageId, sourceBytes: 1000 })
  trace.stage("authorize")
  tick = 40
  trace.stage("transform")
  tick = 80
  trace.stage("storage_put")
  tick = 100
  trace.finish(
    503,
    new GroupError(
      503,
      "STORAGE_UNAVAILABLE",
      "SECRET https://private/?token=secret"
    )
  )
  expect(logs).toHaveLength(2)
  expect(logs[0].fields?.pageId).toBeUndefined()
  expect(logs[1]).toMatchObject({
    level: "error",
    fields: {
      requestId: diagnostic.uploadRequestId,
      sessionId,
      pageId: diagnostic.pageId,
      status: 503,
      stage: "storage_put",
      errorCode: "STORAGE_UNAVAILABLE",
      body_validationMs: 20,
      authorizeMs: 10,
      transformMs: 40,
      storage_putMs: 20,
      durationMs: 90,
    },
  })
  expect(JSON.stringify(logs)).not.toContain("SECRET")
  expect(JSON.stringify(logs)).not.toContain("token")
})

test("trace clocks are independent and tolerate identical/rounded elapsed instants", () => {
  const { log, logs } = logCapture()
  const first = chapterPageUploadTrace(log, { sessionId: "first" }, () => 10.1)
  const second = chapterPageUploadTrace(
    log,
    { sessionId: "second" },
    () => 20.4
  )
  first.stage("transform")
  first.finish(200)
  second.finish(400)
  expect(logs[2]).toMatchObject({
    level: "info",
    fields: { sessionId: "first", transformMs: 0, durationMs: 0 },
  })
  expect(logs[3]).toMatchObject({
    level: "warn",
    fields: { sessionId: "second", body_validationMs: 0, durationMs: 0 },
  })
})

test("diagnostic schema accepts only bounded metadata, not filenames, URLs or credentials", () => {
  expect(ChapterUploadDiagnosticSchema.safeParse(diagnostic).success).toBe(true)
  for (const extra of [
    "filename",
    "url",
    "errorMessage",
    "token",
    "actorUserId",
  ])
    expect(
      ChapterUploadDiagnosticSchema.safeParse({
        ...diagnostic,
        [extra]: "SECRET",
      }).success
    ).toBe(false)
  for (const invalid of [
    { status: 600 },
    { elapsedMs: -1 },
    { elapsedMs: 600_001 },
    { sourceBytes: 13 * 1024 * 1024 },
    { transferredBytes: -1 },
    { uploadRequestId: "not-a-uuid" },
    { outcome: "unexpected" },
  ])
    expect(
      ChapterUploadDiagnosticSchema.safeParse({ ...diagnostic, ...invalid })
        .success
    ).toBe(false)
})

function fixture({
  attached = false,
  active = true,
  sessionActor = actor,
  allowAdd = true,
  storage = false,
  sessionState = "cancelled",
  storageFailure = false,
}: {
  attached?: boolean
  active?: boolean
  sessionActor?: string
  allowAdd?: boolean
  storage?: boolean
  sessionState?: "open" | "cancelled"
  storageFailure?: boolean
} = {}) {
  const { log, logs } = logCapture()
  const dialect = new PgDialect()
  const now = parseISO("2026-10-04T00:00:00Z")
  const session = {
    id: sessionId,
    mangaId,
    groupId,
    actorUserId: sessionActor,
    chapterId: attached ? chapterId : null,
    mode: attached ? "replacement" : "initial",
    state: sessionState,
    expectedChapterVersion: attached ? 1 : null,
    expiresAt: addHours(now, 3),
  }
  let pageRow: Record<string, unknown> | null = null
  let storedBytes = 0
  let puts = 0
  const selections: { table: unknown; params: unknown[] }[] = []
  const select = (fields?: Record<string, unknown>) => {
    let table: unknown
    let params: unknown[] = []
    const query = {
      from(value: unknown) {
        table = value
        return query
      },
      innerJoin() {
        return query
      },
      where(condition: SQL) {
        params = dialect.sqlToQuery(condition).params
        return query
      },
      limit() {
        return query
      },
      for() {
        return query
      },
      then(
        resolve: (value: unknown[]) => unknown,
        reject: (error: unknown) => unknown
      ) {
        selections.push({ table, params })
        let rows: unknown[] = []
        if (table === userProfile)
          rows = [{ status: active ? "active" : "restricted" }]
        else if (table === user) rows = [{ role: null }]
        else if (table === organization)
          rows = [
            {
              id: groupId,
              name: "Group",
              slug: "group",
              inactive: false,
              approvalStatus: "approved",
              publicationState: "published",
            },
          ]
        else if (table === manga)
          rows = [
            {
              id: mangaId,
              publicationState: "published",
              moderationHiddenAt: null,
            },
          ]
        else if (table === mangaGroup || table === chapterGroup)
          rows = [{ groupId }]
        else if (table === member)
          rows = [
            { role: "member", canAddChapter: allowAdd, canEditChapter: true },
          ]
        else if (table === chapter)
          rows = [
            {
              id: chapterId,
              mangaId,
              version: 1,
              publicationState: "published",
              moderationHiddenAt: null,
            },
          ]
        else if (table === chapterUploadSession) {
          // Exercise the actual SQL's staging actor and route scope constraints.
          if (
            params.includes(sessionId) &&
            params.includes(groupId) &&
            params.includes(mangaId) &&
            (attached
              ? params.includes(chapterId)
              : params.includes(sessionActor))
          )
            rows = [session]
        } else if (table === chapterUploadPage)
          rows = fields?.pages
            ? [{ pages: 0, bytes: 0 }]
            : pageRow
              ? [pageRow]
              : []
        return Promise.resolve(rows).then(resolve, reject)
      },
    }
    return query
  }
  const tx = {
    select,
    execute: async () => undefined,
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          pageRow = { ...values, state: "uploading" }
          return [pageRow]
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            pageRow = { ...pageRow, ...values }
            return [pageRow]
          },
        }),
      }),
    }),
  }
  const database = {
    transaction: async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
  } as unknown as Database
  const app = new OpenAPIHono()
  app.use("*", requestId())
  app.use("*", async (c, next) => {
    c.set("accountUserId", actor)
    await next()
  })
  app.onError((error, c) =>
    error instanceof GroupError
      ? c.json(
          apiError(error.code, error.message, c.get("requestId")),
          error.status
        )
      : c.json(apiError("INTERNAL", "Internal error", c.get("requestId")), 500)
  )
  registerChapterRoutes(app, {
    database,
    cache: {},
    assetBaseUrl: "https://assets.example.test",
    logger: log,
    now: () => now,
    ...(storage
      ? {
          storage: {
            put: async (_key: string, data: Uint8Array) => {
              puts++
              if (storageFailure)
                throw new Error("STORAGE_SECRET https://private/?token=secret")
              storedBytes = data.byteLength
            },
            head: async () => ({
              contentLength: storedBytes,
              contentType: "image/webp",
            }),
          },
        }
      : {}),
  } as Dependencies)
  const base =
    `/v1/contribution/groups/${groupId}/manga/${mangaId}` +
    (attached
      ? `/chapters/${chapterId}/uploads/${sessionId}`
      : `/chapter-uploads/${sessionId}`)
  return { app, logs, selections, base, puts: () => puts }
}

test("both diagnostic routes authorize the existing session and log client metadata without writing DB", async () => {
  for (const attached of [false, true]) {
    const { app, base, logs } = fixture({ attached })
    const response = await app.request(base + "/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diagnostic),
    })
    expect(response.status).toBe(204)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      level: "warn",
      event: "chapter.upload_client_failed",
      fields: {
        ...diagnostic,
        source: "browser_report",
        sessionId,
        groupId,
        mangaId,
        chapterId: attached ? chapterId : null,
        actorUserId: actor,
      },
    })
  }
})

test("diagnostics reject wrong staging actor, restricted accounts and missing chapter permission", async () => {
  for (const [options, status] of [
    [{ sessionActor: "somebody-else" }, 404],
    [{ active: false }, 403],
    [{ allowAdd: false }, 403],
  ] as const) {
    const { app, base, logs } = fixture(options)
    const response = await app.request(base + "/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diagnostic),
    })
    expect(response.status).toBe(status)
    expect(logs).toHaveLength(0)
  }
})

test("invalid diagnostic bodies are rejected before authorization or logging", async () => {
  const { app, base, selections, logs } = fixture()
  const response = await app.request(base + "/diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...diagnostic, token: "SECRET" }),
  })
  expect(response.status).toBe(400)
  expect(logs).toHaveLength(0)
  expect(selections).toHaveLength(0)
  expect(reportChapterStagingDiagnosticRoute.path).toEndWith("/diagnostics")
  expect(reportChapterUploadDiagnosticRoute.path).toEndWith("/diagnostics")
})

test("upload middleware logs storage and multipart failures before image handler", async () => {
  for (const [storage, status] of [
    [false, 503],
    [true, 413],
  ] as const) {
    const { app, base, logs } = fixture({ storage })
    const response = await app.request(base + "/pages", {
      method: "POST",
      headers: {
        "Content-Length": String(CHAPTER_PAGE_MULTIPART_MAX_BYTES + 1),
        "X-Request-ID": diagnostic.uploadRequestId,
      },
      body: "oversized request",
    })
    expect(response.status).toBe(status)
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({
      event: "chapter.upload_page_started",
      fields: {
        requestId: diagnostic.uploadRequestId,
        sessionId,
        groupId,
        mangaId,
      },
    })
    expect(logs[1]).toMatchObject({
      event: "chapter.upload_page_finished",
      fields: { status, stage: "body_validation" },
    })
  }
})

test("real image handler logs phase timings, replay and storage failure without image or credentials", async () => {
  const bytes = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer()
  for (const storageFailure of [false, true]) {
    const { app, base, logs, puts } = fixture({
      storage: true,
      sessionState: "open",
      storageFailure,
    })
    const body = new FormData()
    body.set(
      "page",
      new File([bytes], "PRIVATE_FILENAME.jpeg", { type: "image/jpeg" })
    )
    body.set("pageId", diagnostic.pageId)
    const response = await app.request(base + "/pages", {
      method: "POST",
      body,
      headers: { "X-Request-ID": diagnostic.uploadRequestId },
    })
    expect(response.status).toBe(storageFailure ? 503 : 200)
    const finished = logs.find(
      ({ event }) => event === "chapter.upload_page_finished"
    )!
    expect(finished.fields).toMatchObject({
      requestId: diagnostic.uploadRequestId,
      pageId: diagnostic.pageId,
      sourceBytes: bytes.length,
      width: 64,
      height: 64,
      replayed: false,
      stage: storageFailure ? "storage_put" : "preview",
      errorCode: storageFailure ? "STORAGE_UNAVAILABLE" : null,
    })
    for (const timing of [
      "body_validationMs",
      "authorizeMs",
      "transformMs",
      "ledgerMs",
      "storage_putMs",
      "durationMs",
    ])
      expect(finished.fields?.[timing]).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(logs)).not.toContain("STORAGE_SECRET")
    expect(JSON.stringify(logs)).not.toContain("PRIVATE_FILENAME")
    if (!storageFailure) {
      expect(finished.fields?.storage_headMs).toBeGreaterThanOrEqual(0)
      expect(finished.fields?.readyMs).toBeGreaterThanOrEqual(0)
      const replay = await app.request(base + "/pages", {
        method: "POST",
        body,
      })
      expect(replay.status).toBe(200)
      expect(puts()).toBe(1)
      expect(logs.at(-1)?.fields?.replayed).toBe(true)
    }
  }
})
