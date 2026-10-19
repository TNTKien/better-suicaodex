import type { components } from "@/src/lib/generated/api"

type ApiError = components["schemas"]["ApiError"]
type UploadPage = components["schemas"]["ChapterUploadPage"]
type ChapterSession = components["schemas"]["ChapterUploadSession"]
type Diagnostic = components["schemas"]["ChapterUploadDiagnostic"]

export class ChapterApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly details: ApiError["error"]["details"],
    message: string
  ) {
    super(message)
  }
}

function responseError(status: number, body: unknown) {
  const error =
    body && typeof body === "object" && "error" in body
      ? (body as ApiError).error
      : null
  return new ChapterApiError(
    status,
    error?.code,
    error?.details,
    error?.message ?? "Không thể kết nối tới máy chủ."
  )
}

export async function chapterRequest<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
  timeout = 8_000
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout),
  })
  const body = (await response.json().catch(() => null)) as T | ApiError | null
  if (!response.ok) throw responseError(response.status, body)
  return body as T
}

export function isClosedChapterUploadError(error: unknown) {
  return (
    error instanceof ChapterApiError &&
    ((error.status === 409 && error.code === "UPLOAD_SESSION_STATE") ||
      (error.status === 404 && error.code === "NOT_FOUND"))
  )
}

export async function restartChapterUpload({
  apiBaseUrl,
  path,
  sessionId,
  input,
  onCancelled,
}: {
  apiBaseUrl: string
  path: string
  sessionId: string
  input?: { mode: "initial" | "replacement"; expectedVersion: number }
  onCancelled: () => void
}) {
  try {
    await chapterRequest<void>(
      apiBaseUrl,
      path + "/" + encodeURIComponent(sessionId),
      { method: "DELETE" }
    )
  } catch (error) {
    // Cleanup may already have removed the old session. Other failures must not
    // create a second session or discard local files (especially finalizing).
    if (!(error instanceof ChapterApiError && error.status === 404)) throw error
  }
  onCancelled()
  return (
    await chapterRequest<{ data: ChapterSession }>(apiBaseUrl, path, {
      method: "POST",
      ...(input
        ? {
            body: JSON.stringify(input),
            headers: { "Content-Type": "application/json" },
          }
        : {}),
    })
  ).data
}

export function uploadChapterPage(
  apiBaseUrl: string,
  path: string,
  page: { id: string; file: File },
  onProgress: (progress: number) => void
) {
  return new Promise<UploadPage>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const uploadRequestId = crypto.randomUUID()
    // Stopwatch timing must not change if the user's wall clock is adjusted.
    const startedAt = performance.now()
    let transferredBytes = 0
    let totalBytes = 0
    let transferComplete = false
    const fail = (outcome: Diagnostic["outcome"], error: Error) => {
      const diagnostic: Diagnostic = {
        uploadRequestId,
        pageId: page.id,
        outcome,
        status: xhr.status,
        elapsedMs: Math.min(
          600_000,
          Math.max(0, Math.round(performance.now() - startedAt))
        ),
        sourceBytes: page.file.size,
        transferredBytes,
        totalBytes,
        transferComplete,
      }
      console.warn("chapter.upload_client_failed", diagnostic)
      // Failure-only, best effort; never hold up retry or send image/filename,
      // credentials, URLs or raw exception text as diagnostic payload.
      void fetch(
        new URL(path.replace(/\/pages$/, "/diagnostics"), apiBaseUrl),
        {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(diagnostic),
          signal: AbortSignal.timeout(8_000),
          keepalive: true,
        }
      ).catch(() => undefined)
      reject(error)
    }
    xhr.open("POST", new URL(path, apiBaseUrl))
    xhr.responseType = "json"
    xhr.timeout = 90_000
    xhr.withCredentials = true
    xhr.setRequestHeader("Accept", "application/json")
    xhr.setRequestHeader("X-Request-ID", uploadRequestId)
    xhr.upload.addEventListener("progress", (event) => {
      transferredBytes = Math.min(
        13 * 1024 * 1024,
        Math.max(0, Math.round(event.loaded))
      )
      totalBytes = Math.min(
        13 * 1024 * 1024,
        Math.max(0, Math.round(event.total))
      )
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.round((event.loaded / event.total) * 100))
    })
    xhr.upload.addEventListener("load", () => {
      transferComplete = true
    })
    xhr.addEventListener("load", () => {
      const body = xhr.response as { data?: UploadPage } | ApiError | null
      if (xhr.status >= 200 && xhr.status < 300 && body && "data" in body)
        resolve(body.data!)
      else fail("http_error", responseError(xhr.status, body))
    })
    xhr.addEventListener("error", () =>
      fail("network_error", new Error("Mất kết nối khi tải ảnh lên."))
    )
    xhr.addEventListener("timeout", () =>
      fail("timeout", new Error("Tải ảnh quá thời gian cho phép."))
    )
    xhr.addEventListener("abort", () =>
      fail("aborted", new Error("Đã dừng tải ảnh lên."))
    )
    const data = new FormData()
    data.set("page", page.file)
    data.set("pageId", page.id)
    xhr.send(data)
  })
}
