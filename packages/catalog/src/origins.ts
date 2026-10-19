export function publicOrigin(value: string, name: string) {
  const url = new URL(value)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    /[,*]/.test(url.hostname)
  )
    throw new Error(name + " must be an HTTP(S) origin")
  return url.origin
}
export const primaryWebOrigin = publicOrigin(
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
  "NEXT_PUBLIC_WEB_URL"
)
export const assetOrigin = publicOrigin(
  process.env.NEXT_PUBLIC_ASSET_URL ?? "http://localhost:9000",
  "NEXT_PUBLIC_ASSET_URL"
)
