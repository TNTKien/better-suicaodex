import { imageSize } from "image-size"
import { ResizeFit, Transformer } from "@napi-rs/image"

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type Manga = { title: string; creators: string; coverUrl: string | null }
export type Group = {
  title: string
  description: string
  avatarUrl: string | null
}
export type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Empty upstream body")
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    if (Number(response.headers.get("content-length")) > maxBytes) {
      throw new Error("Upstream body exceeds byte limit")
    }
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new Error("Upstream body exceeds byte limit")
      chunks.push(value)
    }
    return Buffer.concat(chunks, length)
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function getPublicResource(
  resource: "manga" | "groups",
  id: string,
  apiUrl: string,
  fetcher: Fetch
) {
  const response = await fetcher(`${apiUrl}/v1/${resource}/${id}`, {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(3_000),
  })
  if (response.status === 404) {
    await response.body?.cancel()
    return undefined
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`${resource} API returned ${response.status}`)
  }
  return JSON.parse((await readLimited(response, 2 * 1024 * 1024)).toString())
}

export async function getGroup(id: string, apiUrl: string, fetcher: Fetch) {
  const body = await getPublicResource("groups", id, apiUrl, fetcher)
  if (body === undefined) return null
  if (
    !body ||
    body.id !== id ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.length > 10_000 ||
    (body.description !== null &&
      (typeof body.description !== "string" ||
        body.description.length > 10_000)) ||
    (body.avatarUrl !== null &&
      (typeof body.avatarUrl !== "string" || body.avatarUrl.length > 2_000))
  ) {
    throw new Error("Invalid group API response")
  }
  return {
    title: body.name,
    description: (body.description ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240),
    avatarUrl: body.avatarUrl,
  } satisfies Group
}

export async function getManga(id: string, apiUrl: string, fetcher: Fetch) {
  const body = await getPublicResource("manga", id, apiUrl, fetcher)
  if (body === undefined) return null
  if (
    !body ||
    body.id !== id ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 10_000 ||
    !Array.isArray(body.authors) ||
    !Array.isArray(body.artists)
  ) {
    throw new Error("Invalid manga API response")
  }
  const names = [...body.authors, ...body.artists].map((person: unknown) => {
    if (
      !person ||
      typeof person !== "object" ||
      !("name" in person) ||
      typeof person.name !== "string"
    ) {
      throw new Error("Invalid manga creator")
    }
    return person.name
  })
  if (
    body.cover !== null &&
    (!body.cover || typeof body.cover.url !== "string")
  ) {
    throw new Error("Invalid manga cover")
  }
  return {
    title: body.title,
    creators: [...new Set<string>(names)]
      .slice(0, 4)
      .join(", ")
      .slice(0, 1_000),
    coverUrl: body.cover?.url ?? null,
  } satisfies Manga
}

export function cover512(
  source: string,
  assetOrigin = "http://localhost:9000"
) {
  const url = new URL(source)
  if (
    url.origin !== assetOrigin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/covers\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+(?:\.(?:256|512))?\.webp$/.test(
      url.pathname
    )
  ) {
    throw new Error("Cover URL is not allowed")
  }
  url.pathname = url.pathname.replace(/(?:\.(?:256|512))?\.webp$/, ".512.webp")
  return url.href
}

export async function getCover(
  source: string | null,
  fetcher: Fetch,
  assetOrigin = "http://localhost:9000"
) {
  if (!source) return null
  try {
    return await getImage(cover512(source, assetOrigin), fetcher, 450, 630)
  } catch {
    return null
  }
}

export async function getAvatar(
  source: string | null,
  id: string,
  fetcher: Fetch,
  assetOrigin = "http://localhost:9000"
) {
  if (!source) return null
  try {
    const url = new URL(source)
    if (
      url.origin !== assetOrigin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(`/groups/${id}/avatars/`) ||
      !/^[a-zA-Z0-9-]+\.webp$/.test(
        url.pathname.slice(`/groups/${id}/avatars/`.length)
      )
    )
      return null
    return await getImage(url.href, fetcher, 400, 400)
  } catch {
    return null
  }
}

async function getImage(
  source: string,
  fetcher: Fetch,
  width: number,
  height: number
) {
  try {
    const response = await fetcher(source, {
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(3_000),
    })
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    ) {
      await response.body?.cancel()
      return null
    }
    const bytes = await readLimited(response, 2 * 1024 * 1024)
    const dimensions = imageSize(bytes)
    if (
      dimensions.type !== "webp" ||
      !dimensions.width ||
      !dimensions.height ||
      dimensions.width * dimensions.height > 16_000_000
    )
      return null
    const png = await new Transformer(bytes)
      .resize({ width, height, fit: ResizeFit.Cover })
      .png()
    return `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return null
  }
}
