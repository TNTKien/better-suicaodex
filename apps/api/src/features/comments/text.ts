// Redive stores Markdown/plain text, :sticker-name: tokens, and rejects HTML.
// Also handle HTML markup defensively; spoiler contents still count.
export function commentRewardWords(body: string) {
  const text = body
    .replace(/<!--[\s\S]*?-->|<[^>]+>/g, " ")
    .replace(/\[\/?spoiler\]/gi, " ")
    .replace(/\[sticker:[a-z0-9_-]+\]|:[a-z0-9_-]+:/gi, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, " ")
    .replace(
      /&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));/gi,
      (token, hex, decimal) => {
        const point = Number.parseInt(hex ?? decimal, hex ? 16 : 10)
        return point > 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : token
      }
    )
    .normalize("NFC")
  return text.match(/[\p{L}\p{N}]{2,}/gu)?.length ?? 0
}

export const normalizedCommentText = (body: string) =>
  body.normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("vi")
