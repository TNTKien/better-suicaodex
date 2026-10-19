export function pageNumber(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) ? page : 1
}

export function pageHref(path: string, page: number) {
  return page === 1 ? path : `${path}?page=${page}`
}
