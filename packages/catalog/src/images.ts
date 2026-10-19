export function cover256(url: string | null) {
  return url?.replace(".512.webp", ".256.webp") ?? null
}

export function coverSrcSet(
  cover: { url: string; width: number | null } | null | undefined
) {
  if (!cover || !/\.(?:256|512)\.webp$/.test(cover.url)) return undefined
  const width = cover.width ?? 512
  if (!Number.isInteger(width) || width <= 0) return undefined
  const baseUrl = cover.url.replace(/\.(?:256|512)\.webp$/, "")
  const small = `${baseUrl}.256.webp ${Math.min(width, 256)}w`
  if (width <= 256) return small
  return `${small}, ${baseUrl}.512.webp ${Math.min(width, 512)}w`
}

export function readerImageSource(page: {
  url: string
  replicaUrl: string | null
  optimizedUrl: string | null
  width: number
  height: number
  optimizedWidth: number | null
  optimizedHeight: number | null
}) {
  if (page.replicaUrl)
    return {
      src: page.replicaUrl,
      fallbackSrc: page.url,
      width: page.width,
      height: page.height,
      fallbackTimeoutMs: 15_000,
    }
  return {
    src: page.optimizedUrl ?? page.url,
    fallbackSrc: page.optimizedUrl ? page.url : null,
    width: page.optimizedWidth ?? page.width,
    height: page.optimizedHeight ?? page.height,
    fallbackTimeoutMs: undefined,
  }
}
