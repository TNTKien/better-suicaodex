export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

export function parsePageNumber(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function tagPath(id: string, slug: string) {
  return `/tag/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`
}

export const personRoleLabels = { author: "Tác giả", artist: "Họa sĩ" } as const
export type PersonRole = keyof typeof personRoleLabels

export function personPath(role: PersonRole, id: string, slug: string) {
  return `/${role}/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`
}

export function groupPath(id: string, slug: string) {
  return `/group/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`
}
