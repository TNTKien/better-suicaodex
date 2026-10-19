"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"

type ViewSession = {
  token: string
  requiredPages: number
  requiredSeconds: number
}
type ViewResult = {
  counted: boolean
  alreadyCounted: boolean
  trackingAvailable: boolean
  retryAfterSeconds: number
}

type ActiveViewSession = ViewSession & { clientStartedAt: number }

export function useChapterView({
  activePage,
  apiBaseUrl,
  chapterId,
  currentPage,
  mode,
  pageCount,
  pagesRef,
  ready,
}: {
  activePage: boolean
  apiBaseUrl: string
  chapterId: string
  currentPage: number
  mode: "classic" | "zen"
  pageCount: number
  pagesRef: RefObject<HTMLDivElement | null>
  ready: boolean
}) {
  const session = useRef<ActiveViewSession | null>(null)
  const seenPages = useRef(new Set<number>())
  const stopped = useRef(false)
  const sending = useRef(false)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const request = useRef<AbortController | null>(null)
  const attemptRef = useRef<() => void>(() => undefined)

  const clearRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current)
    retryTimer.current = null
  }, [])

  const scheduleRetry = useCallback(
    (seconds: number) => {
      clearRetry()
      retryTimer.current = setTimeout(
        () => attemptRef.current(),
        Math.max(1, seconds) * 1_000
      )
    },
    [clearRetry]
  )

  const attempt = useCallback(async () => {
    const active = session.current
    if (!active || stopped.current || sending.current) return
    const elapsed = Math.floor(
      (performance.now() - active.clientStartedAt) / 1_000
    )
    if (
      seenPages.current.size < active.requiredPages &&
      elapsed < active.requiredSeconds
    ) {
      return
    }

    sending.current = true
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    try {
      const response = await fetch(
        new URL(
          `/v1/chapters/${encodeURIComponent(chapterId)}/view`,
          apiBaseUrl
        ),
        {
          body: JSON.stringify({
            seenPages: seenPages.current.size,
            token: active.token,
          }),
          credentials: "include",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        }
      )
      if (!response.ok) {
        if ([400, 403, 404, 410].includes(response.status))
          stopped.current = true
        return
      }
      const result = (await response.json()) as ViewResult
      if (
        result.counted ||
        result.alreadyCounted ||
        !result.trackingAvailable
      ) {
        stopped.current = true
        clearRetry()
      } else if (result.retryAfterSeconds > 0) {
        scheduleRetry(result.retryAfterSeconds)
      }
    } catch {
      // View analytics must never interrupt the reader.
    } finally {
      if (request.current === controller) request.current = null
      sending.current = false
    }
  }, [apiBaseUrl, chapterId, clearRetry, scheduleRetry])
  useEffect(() => {
    attemptRef.current = () => void attempt()
  }, [attempt])

  const markPageSeen = useCallback(
    (index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= pageCount) return
      seenPages.current.add(index)
      const active = session.current
      if (active && seenPages.current.size >= active.requiredPages)
        attemptRef.current()
    },
    [pageCount]
  )

  useEffect(() => {
    if (!ready || pageCount === 0) return
    session.current = null
    seenPages.current.clear()
    stopped.current = false
    sending.current = false
    const controller = new AbortController()
    const kickoff = setTimeout(async () => {
      try {
        const response = await fetch(
          new URL(
            `/v1/chapters/${encodeURIComponent(chapterId)}/view-session`,
            apiBaseUrl
          ),
          {
            credentials: "include",
            headers: { accept: "application/json" },
            method: "POST",
            signal: controller.signal,
          }
        )
        if (!response.ok) return
        const value = (await response.json()) as ViewSession
        session.current = { ...value, clientStartedAt: performance.now() }
        scheduleRetry(value.requiredSeconds)
        if (seenPages.current.size >= value.requiredPages) attemptRef.current()
      } catch {
        // View analytics must never interrupt the reader.
      }
    }, 0)

    return () => {
      clearTimeout(kickoff)
      controller.abort()
      request.current?.abort()
      request.current = null
      clearRetry()
      stopped.current = true
    }
  }, [apiBaseUrl, chapterId, clearRetry, pageCount, ready, scheduleRetry])

  useEffect(() => {
    if (!ready || mode !== "classic") return
    const pages =
      pagesRef.current?.querySelectorAll<HTMLElement>("[data-reader-page]")
    if (!pages?.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue
          markPageSeen(Number(entry.target.getAttribute("data-reader-page")))
        }
      },
      { threshold: [0.5, 0.75] }
    )
    pages.forEach((page) => observer.observe(page))
    return () => observer.disconnect()
  }, [markPageSeen, mode, pagesRef, ready])

  useEffect(() => {
    if (ready && mode === "zen" && activePage) markPageSeen(currentPage)
  }, [activePage, currentPage, markPageSeen, mode, ready])
}
