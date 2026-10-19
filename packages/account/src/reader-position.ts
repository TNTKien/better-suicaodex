export function clampReaderPage(page: number, pageCount: number) {
  return Math.min(Math.max(page, 0), Math.max(pageCount - 1, 0))
}

export function readerPageFromHash(hash: string, pageCount: number) {
  const page = Number(hash.match(/^#page-(\d+)$/)?.[1]) - 1
  return clampReaderPage(Number.isInteger(page) ? page : 0, pageCount)
}

export function saveReaderPage(pageCount: number, currentPage: number) {
  if (typeof window === "undefined" || pageCount === 0) return
  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#page-${currentPage + 1}`
    )
  } catch {
    return
  }
}
