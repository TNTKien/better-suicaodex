export function getSiteUrl() {
  const url = new URL(process.env.WEB_URL ?? "http://localhost:3000")
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("WEB_URL must be an HTTP(S) origin without credentials")
  }
  return url.origin
}
