// Route factories accept a single origin for existing callers or an allowlist.
export type WebOrigins = string | readonly string[]

export function allowedWebOrigins(
  primary: string,
  additional: readonly string[] = []
) {
  return [...new Set([primary, ...additional])]
}

export function isTrustedWebOrigin(
  origin: string | undefined,
  allowed: WebOrigins
) {
  if (!origin) return false
  return typeof allowed === "string"
    ? origin === allowed
    : allowed.includes(origin)
}
