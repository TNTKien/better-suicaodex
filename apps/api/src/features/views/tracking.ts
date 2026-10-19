import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const CHAPTER_VIEW_WINDOW_SECONDS = 12 * 60 * 60
export const CHAPTER_VIEW_COOKIE = "sd_view_session"

const noncePattern = /^[a-f0-9]{36}$/
const signaturePattern = /^[a-f0-9]{64}$/

export function chapterViewThreshold(pageCount: number) {
  return Math.max(1, Math.floor(Math.max(0, pageCount) / 2 + 1))
}

function signature(
  chapterId: string,
  startedAt: number,
  nonce: string,
  sessionId: string,
  secret: string
) {
  return createHmac("sha256", secret)
    .update(`${chapterId}.${startedAt}.${nonce}.${sessionId}`)
    .digest("hex")
}

export function createChapterViewToken(
  chapterId: string,
  sessionId: string,
  secret: string,
  now: Date
) {
  const startedAt = now.getTime()
  const nonce = randomBytes(18).toString("hex")
  return `${chapterId}.${startedAt}.${nonce}.${signature(chapterId, startedAt, nonce, sessionId, secret)}`
}

export function verifyChapterViewToken(
  token: string,
  chapterId: string,
  sessionId: string,
  secret: string,
  now: Date
) {
  const [tokenChapterId, startedAtRaw, nonce, received, ...rest] =
    token.split(".")
  const startedAt = Number(startedAtRaw)
  const nowMs = now.getTime()
  if (
    rest.length > 0 ||
    tokenChapterId !== chapterId ||
    !Number.isSafeInteger(startedAt) ||
    startedAt > nowMs + 60_000 ||
    nowMs - startedAt > CHAPTER_VIEW_WINDOW_SECONDS * 1_000 ||
    !noncePattern.test(nonce ?? "") ||
    !signaturePattern.test(received ?? "")
  ) {
    return null
  }

  const expected = signature(chapterId, startedAt, nonce!, sessionId, secret)
  if (
    !timingSafeEqual(
      Buffer.from(received!, "hex"),
      Buffer.from(expected, "hex")
    )
  ) {
    return null
  }

  return { startedAt }
}
