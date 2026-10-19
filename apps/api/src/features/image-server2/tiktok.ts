import {
  addSeconds,
  differenceInMilliseconds,
  formatISO,
  isValid,
  parse,
} from "date-fns"
import { TZDate } from "@date-fns/tz"
import sharp from "sharp"

const endpoint = "https://ads.tiktok.com/instant_page/api/v1/file/upload/"
const directHost = "p21-ad-sg.ibyteimg.com"
export const maxUploadBytes = 12 * 1024 * 1024
const maxSourceBytes = 32 * 1024 * 1024
const maxPixels = 40_000_000
type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>

export class ReplicaError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
    readonly retryAt?: Date
  ) {
    // Only fixed codes reach logs/DB: upstream bodies and credentials never do.
    super(code)
  }
}

export function isTikTokMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      ["ibyteimg.com", "tiktokcdn.com"].some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      )
    )
  } catch {
    return false
  }
}

export function sourceUrl(base: string, key: string) {
  const root = new URL(`${base.replace(/\/+$/, "")}/`)
  const url = new URL(key, root)
  if (
    !key ||
    /^[a-z][a-z0-9+.-]*:/i.test(key) ||
    key.startsWith("/") ||
    key.includes("\\") ||
    url.origin !== root.origin ||
    !url.pathname.startsWith(root.pathname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new ReplicaError("INVALID_SOURCE_KEY")
  }
  return url
}

async function readBody(response: Response, limit: number) {
  const reader = response.body?.getReader()
  if (!reader) throw new ReplicaError("EMPTY_RESPONSE", true)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new ReplicaError("RESPONSE_TOO_LARGE")
      chunks.push(value)
    }
    return Buffer.concat(chunks, size)
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function retryAfter(value: string | null) {
  if (!value) return undefined
  const now = new Date()
  if (/^\d+$/.test(value))
    return addSeconds(now, Math.min(Number(value), 86400))
  const parsed = parse(
    value,
    "EEE, dd MMM yyyy HH:mm:ss 'GMT'",
    new TZDate(now, "UTC")
  )
  // HTTP dates are always GMT, independent of the worker's local timezone.
  const utc =
    /^\w{3}, (\d{2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.test(value)
  if (!utc || !isValid(parsed)) return undefined
  return parsed
}

async function request(
  fetcher: Fetch,
  url: string | URL,
  init: RequestInit,
  limit: number,
  upload = false
) {
  const response = await fetcher(url, { ...init, redirect: "error" })
  if (!response.ok) {
    await response.body?.cancel()
    if (upload && [401, 403].includes(response.status))
      throw new ReplicaError("AUTH_REQUIRED")
    throw new ReplicaError(
      `HTTP_${response.status}`,
      response.status === 429 || response.status >= 500,
      response.status === 429
        ? retryAfter(response.headers.get("retry-after"))
        : undefined
    )
  }
  if (
    upload &&
    /text\/html/i.test(response.headers.get("content-type") ?? "")
  ) {
    await response.body?.cancel()
    throw new ReplicaError("AUTH_REQUIRED")
  }
  return readBody(response, limit)
}

export async function encodeReplica(
  source: Buffer,
  width: number,
  height: number
) {
  if (source.length > maxSourceBytes) throw new ReplicaError("SOURCE_TOO_LARGE")
  try {
    const input = sharp(source, {
      limitInputPixels: maxPixels,
      animated: false,
    })
    const metadata = await input.metadata()
    if (
      metadata.width !== width ||
      metadata.height !== height ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new ReplicaError("SOURCE_DIMENSIONS_MISMATCH")
    }
    const png = await input.clone().png().toBuffer()
    if (png.length <= maxUploadBytes)
      return { bytes: png, format: "png" as const }
    const jpeg = await input
      .clone()
      .flatten({ background: "white" })
      .jpeg({ quality: 90 })
      .toBuffer()
    if (jpeg.length > maxUploadBytes)
      throw new ReplicaError("ENCODED_TOO_LARGE")
    return { bytes: jpeg, format: "jpeg" as const }
  } catch (error) {
    if (error instanceof ReplicaError) throw error
    throw new ReplicaError("INVALID_SOURCE_IMAGE")
  }
}

export async function uploadReplicaPage(
  page: { originalKey: string; width: number; height: number },
  options: {
    assetBaseUrl: string
    cookie: string
    csrfToken: string
    signal: AbortSignal
    fetcher?: Fetch
  }
) {
  const fetcher = options.fetcher ?? fetch
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(60_000)])
  try {
    const source = await request(
      fetcher,
      sourceUrl(options.assetBaseUrl, page.originalKey),
      { signal },
      maxSourceBytes
    )
    const encoded = await encodeReplica(source, page.width, page.height)
    signal.throwIfAborted()
    const form = new FormData()
    const name = `page.${encoded.format === "png" ? "png" : "jpg"}`
    form.set("name", name)
    form.set(
      "file",
      new Blob([new Uint8Array(encoded.bytes)], {
        type: `image/${encoded.format}`,
      }),
      name
    )
    const body = await request(
      fetcher,
      endpoint,
      {
        method: "POST",
        signal,
        body: form,
        headers: {
          accept: "application/json, text/plain, */*",
          cookie: options.cookie,
          "x-csrftoken": options.csrfToken,
          origin: "https://ads.tiktok.com",
          referer: "https://ads.tiktok.com/instant_page/editor/main",
        },
      },
      1024 * 1024,
      true
    )
    if (/^\s*</.test(body.toString("utf8")))
      throw new ReplicaError("AUTH_REQUIRED")
    let result: {
      code?: unknown
      message?: unknown
      data?: { src?: unknown; uri?: unknown; directUrl?: unknown }
    }
    try {
      result = JSON.parse(body.toString("utf8"))
    } catch {
      throw new ReplicaError("INVALID_UPLOAD_RESPONSE")
    }
    if (
      result?.code !== 0 ||
      result.message !== "success" ||
      !isTikTokMediaUrl(result.data?.src)
    ) {
      throw new ReplicaError("UPLOAD_REJECTED")
    }
    const data = result.data!
    let uri: string
    try {
      uri =
        typeof data.uri === "string"
          ? data.uri
          : decodeURIComponent(new URL(data.src as string).pathname)
              .replace(/^\/+/, "")
              .split("~")[0]!
    } catch {
      throw new ReplicaError("INVALID_UPLOAD_RESPONSE")
    }
    if (
      !/^[A-Za-z0-9_./-]+$/.test(uri) ||
      !uri.includes("/") ||
      uri.split("/").includes("..")
    ) {
      throw new ReplicaError("INVALID_UPLOAD_RESPONSE")
    }
    const direct = isTikTokMediaUrl(data.directUrl)
      ? data.directUrl
      : `https://${directHost}/obj/${uri.replace(/^obj\//, "")}`
    // Both paths need anonymous GET/decode; neither a successful upload nor HEAD proves readability.
    let lastError: unknown
    for (const url of [...new Set([direct, data.src as string])]) {
      try {
        const bytes = await request(fetcher, url, { signal }, maxSourceBytes)
        const decoded = sharp(bytes, { limitInputPixels: maxPixels })
        const meta = await decoded.metadata()
        if (
          !["png", "jpeg", "webp"].includes(meta.format ?? "") ||
          meta.width !== page.width ||
          meta.height !== page.height ||
          (meta.pages ?? 1) > 1
        ) {
          throw new ReplicaError("REPLICA_DIMENSIONS_MISMATCH")
        }
        await decoded.stats() // Decode all pixels to reject corrupt/truncated bodies.
        // Live spike: TikTok's src URL can recompress JPEG despite identical dimensions.
        // Compare with our encoded upload, not the canonical WebP (a different format).
        if (!bytes.equals(encoded.bytes))
          throw new ReplicaError("REPLICA_CONTENT_MISMATCH")
        signal.throwIfAborted()
        return {
          uri,
          url,
          format: meta.format!,
          byteSize: bytes.length,
          verifiedAt: formatISO(new Date()),
        }
      } catch (error) {
        signal.throwIfAborted()
        // A transformed src must not make a temporary direct-CDN outage terminal.
        const failure =
          error instanceof ReplicaError
            ? error
            : new ReplicaError("REPLICA_NOT_READABLE", true)
        if (!(lastError instanceof ReplicaError && lastError.retryable))
          lastError = failure
      }
    }
    if (lastError instanceof ReplicaError) throw lastError
    throw new ReplicaError("REPLICA_NOT_READABLE", true)
  } catch (error) {
    if (error instanceof ReplicaError) throw error
    throw new ReplicaError(
      options.signal.aborted ? "CLAIM_ABORTED" : "NETWORK_ERROR",
      true
    )
  }
}

export function retryDelay(
  attempt: number,
  requested?: Date,
  now = new Date()
) {
  const seconds = [30, 120, 600, 1800][Math.min(Math.max(attempt - 1, 0), 3)]!
  const defaultAt = addSeconds(now, seconds)
  return requested && differenceInMilliseconds(requested, defaultAt) > 0
    ? requested
    : defaultAt
}
