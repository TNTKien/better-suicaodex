export function getApiBaseUrl() {
  const url = new URL(
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
  )
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_API_URL must use http or https")
  }
  return url.origin
}
