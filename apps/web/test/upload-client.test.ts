import assert from "node:assert/strict"

import {
  ChapterApiError,
  isClosedChapterUploadError,
  restartChapterUpload,
  uploadChapterPage,
} from "../app/manage/manga/[mangaId]/chapters/new/upload-client"

class TestXHR extends EventTarget {
  static instances: TestXHR[] = []
  upload = new EventTarget()
  status = 0
  response: unknown = null
  responseType = ""
  timeout = 0
  withCredentials = false
  headers: Record<string, string> = {}
  body?: FormData
  method?: string
  url?: string
  constructor() {
    super()
    TestXHR.instances.push(this)
  }
  open(method: string, url: URL) {
    this.method = method
    this.url = String(url)
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  send(body: FormData) {
    this.body = body
  }
}

const oldXHR = globalThis.XMLHttpRequest
const oldFetch = globalThis.fetch
const oldWarn = console.warn
const reports: { url: string; init?: RequestInit }[] = []
const warnings: unknown[][] = []
globalThis.XMLHttpRequest = TestXHR as unknown as typeof XMLHttpRequest
globalThis.fetch = (async (url, init) => {
  reports.push({ url: String(url), init })
  return new Response(null, { status: 204 })
}) as typeof fetch
console.warn = (...values) => {
  warnings.push(values)
}

const page = {
  id: "8f1b2f60-79fa-440b-8e96-d242227ab31f",
  file: new File(["PRIVATE_IMAGE_BYTES"], "PRIVATE_FILENAME.png", {
    type: "image/png",
  }),
}
const path =
  "/v1/contribution/groups/3654281a-b35c-4e9d-8413-b40e944c9edd/manga/ce450cab-5c61-42cb-9367-60f90152849a/chapter-uploads/bfc15927-10d4-4d0f-a174-227f142ad8c7/pages"
const apiBaseUrl = "https://api.example.test"
const latest = () => TestXHR.instances.at(-1)!

try {
  for (const [event, outcome, message] of [
    ["timeout", "timeout", "Tải ảnh quá thời gian cho phép."],
    ["error", "network_error", "Mất kết nối khi tải ảnh lên."],
    ["abort", "aborted", "Đã dừng tải ảnh lên."],
    ["load", "http_error", "Storage unavailable"],
  ] as const) {
    const progress: number[] = []
    const promise = uploadChapterPage(apiBaseUrl, path, page, (value) =>
      progress.push(value)
    )
    const xhr = latest()
    assert.equal(xhr.timeout, 90_000, "Diagnostics must not alter timeout")
    assert.equal(xhr.withCredentials, true)
    assert.equal(xhr.body?.get("pageId"), page.id)
    assert.equal(
      await (xhr.body?.get("page") as File).text(),
      await page.file.text()
    )
    assert.ok(xhr.headers["X-Request-ID"])
    xhr.upload.dispatchEvent(
      Object.assign(new Event("progress"), {
        loaded: 20,
        total: 40,
        lengthComputable: true,
      })
    )
    if (event === "load") {
      xhr.status = 503
      xhr.response = {
        error: {
          code: "STORAGE_UNAVAILABLE",
          message,
          requestId: xhr.headers["X-Request-ID"],
        },
      }
      xhr.upload.dispatchEvent(new Event("load"))
    }
    const rejected = assert.rejects(promise, { message })
    xhr.dispatchEvent(new Event(event))
    await rejected
    assert.deepEqual(progress, [50])
    const report = reports.at(-1)!
    const data = JSON.parse(String(report.init?.body))
    assert.equal(
      report.url,
      apiBaseUrl + path.replace(/\/pages$/, "/diagnostics")
    )
    assert.equal(report.init?.credentials, "include")
    assert.equal(data.outcome, outcome)
    assert.equal(data.uploadRequestId, xhr.headers["X-Request-ID"])
    assert.equal(data.pageId, page.id)
    assert.equal(data.status, event === "load" ? 503 : 0)
    assert.equal(data.transferComplete, event === "load")
    assert.equal(data.transferredBytes, 20)
    assert.equal(data.totalBytes, 40)
    assert.equal(data.sourceBytes, page.file.size)
    assert.ok(data.elapsedMs >= 0)
    assert.equal(warnings.at(-1)?.[0], "chapter.upload_client_failed")
    for (const privateValue of [
      "PRIVATE_FILENAME",
      "PRIVATE_IMAGE_BYTES",
      "Storage unavailable",
      "https:",
    ])
      assert.equal(String(report.init?.body).includes(privateValue), false)
  }

  const priorReports = reports.length
  const upload = uploadChapterPage(apiBaseUrl, path, page, () => {})
  latest().status = 200
  latest().response = {
    data: { id: page.id, state: "ready", width: 100, height: 200 },
  }
  latest().dispatchEvent(new Event("load"))
  assert.equal((await upload).id, page.id)
  assert.equal(
    reports.length,
    priorReports,
    "Successful uploads do not send telemetry"
  )
  const firstRequestId = latest().headers["X-Request-ID"]
  globalThis.fetch = (async () => {
    throw new Error("REPORT_FAILURE_SECRET")
  }) as typeof fetch
  const retry = uploadChapterPage(apiBaseUrl, path, page, () => {})
  assert.notEqual(latest().headers["X-Request-ID"], firstRequestId)
  assert.equal(
    latest().body?.get("pageId"),
    page.id,
    "Retry preserves page identity"
  )
  const retryRejected = assert.rejects(retry, {
    message: "Tải ảnh quá thời gian cho phép.",
  })
  latest().dispatchEvent(new Event("timeout"))
  await retryRejected
  await Promise.resolve()
  assert.equal(
    JSON.stringify(warnings).includes("REPORT_FAILURE_SECRET"),
    false
  )

  const sessionId = "bfc15927-10d4-4d0f-a174-227f142ad8c7"
  const newSession = { id: "0c2e2645-1e47-4e01-86a1-d236131f9cb1", pages: [] }
  const base = path.replace(/\/[^/]+\/pages$/, "")
  for (const cancellationStatus of [204, 404]) {
    const steps: string[] = []
    globalThis.fetch = (async (url, init) => {
      steps.push(init!.method!)
      assert.equal(init?.credentials, "include")
      if (init?.method === "DELETE") {
        assert.equal(String(url), apiBaseUrl + base + "/" + sessionId)
        return cancellationStatus === 204
          ? new Response(null, { status: 204 })
          : Response.json(
              { error: { code: "NOT_FOUND", message: "Gone" } },
              { status: 404 }
            )
      }
      assert.equal(String(url), apiBaseUrl + base)
      assert.equal(
        init?.body,
        undefined,
        "Staging creation does not require chapter metadata"
      )
      assert.deepEqual(steps, ["DELETE", "discard", "POST"])
      return Response.json({ data: newSession })
    }) as typeof fetch
    assert.deepEqual(
      await restartChapterUpload({
        apiBaseUrl,
        path: base,
        sessionId,
        onCancelled: () => {
          steps.push("discard")
        },
      }),
      newSession
    )
  }

  for (const failureStatus of [403, 409, 503]) {
    let calls = 0
    let discarded = false
    globalThis.fetch = (async () => {
      calls++
      return Response.json(
        { error: { code: "UPLOAD_SESSION_STATE", message: "Cannot cancel" } },
        { status: failureStatus }
      )
    }) as typeof fetch
    await assert.rejects(
      restartChapterUpload({
        apiBaseUrl,
        path: base,
        sessionId,
        onCancelled: () => {
          discarded = true
        },
      }),
      { message: "Cannot cancel" }
    )
    assert.equal(
      calls,
      1,
      "Never create another session after cancellation failure"
    )
    assert.equal(discarded, false, "Cancellation failure keeps local pages")
  }

  let discarded = false
  const methods: string[] = []
  globalThis.fetch = (async (_url, init) => {
    methods.push(init!.method!)
    if (init?.method === "DELETE") return new Response(null, { status: 204 })
    return Response.json(
      { error: { code: "STORAGE_UNAVAILABLE", message: "Cannot create" } },
      { status: 503 }
    )
  }) as typeof fetch
  await assert.rejects(
    restartChapterUpload({
      apiBaseUrl,
      path: base,
      sessionId,
      onCancelled: () => {
        discarded = true
      },
    }),
    { message: "Cannot create" }
  )
  assert.equal(
    discarded,
    true,
    "Once cancellation succeeds, never reuse the old session"
  )
  assert.deepEqual(methods, ["DELETE", "POST"])

  const createInput = { expectedVersion: 7, mode: "replacement" as const }
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "DELETE") return new Response(null, { status: 204 })
    assert.deepEqual(JSON.parse(String(init?.body)), createInput)
    return Response.json({ data: newSession })
  }) as typeof fetch
  await restartChapterUpload({
    apiBaseUrl,
    path: base,
    sessionId,
    input: createInput,
    onCancelled: () => {},
  })
  assert.equal(
    isClosedChapterUploadError(
      new ChapterApiError(409, "UPLOAD_SESSION_STATE", undefined, "Closed")
    ),
    true
  )
  assert.equal(
    isClosedChapterUploadError(
      new ChapterApiError(404, "NOT_FOUND", undefined, "Gone")
    ),
    true
  )
  for (const [status, code] of [
    [403, "FORBIDDEN"],
    [409, "STALE_CHAPTER"],
    [503, "STORAGE_UNAVAILABLE"],
  ] as const)
    assert.equal(
      isClosedChapterUploadError(
        new ChapterApiError(status, code, undefined, "Other error")
      ),
      false
    )
} finally {
  globalThis.XMLHttpRequest = oldXHR
  globalThis.fetch = oldFetch
  console.warn = oldWarn
}

console.log("Upload diagnostics and restart checks passed")
