"use client"

import { differenceInMilliseconds } from "date-fns"
import { useEffect } from "react"

const intervalMs = 30_000
const key = "redive.presence.lastSent.v1"

export function usePresenceHeartbeat(apiBaseUrl: string) {
  useEffect(() => {
    let lastSent = 0
    let pending = false
    let disposed = false
    let timer: number | undefined
    const active = () =>
      !disposed && document.visibilityState === "visible" && document.hasFocus()
    const send = async () => {
      if (!active()) return
      const now = Date.now()
      let previous = lastSent
      try {
        previous = Math.max(previous, Number(localStorage.getItem(key)) || 0)
      } catch {
        /* Browser storage is optional. */
      }
      if (
        previous <= now &&
        differenceInMilliseconds(now, previous) < intervalMs
      )
        return
      const response = await fetch(
        new URL("/v1/presence/heartbeat", apiBaseUrl),
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }
      )
      if (response.ok) {
        lastSent = now
        try {
          localStorage.setItem(key, String(now))
        } catch {
          /* Keep the tab-local throttle. */
        }
      }
    }
    const beat = async () => {
      if (pending || !active()) return
      pending = true
      try {
        if (navigator.locks)
          await navigator.locks.request(key, { ifAvailable: true }, (lock) =>
            lock ? send() : undefined
          )
        else await send()
      } catch {
        /* The next visible tick retries transient network failures. */
      } finally {
        pending = false
      }
    }
    const sync = () => {
      window.clearInterval(timer)
      if (active()) {
        void beat()
        timer = window.setInterval(() => void beat(), 10_000)
      }
    }
    sync()
    window.addEventListener("focus", sync)
    window.addEventListener("blur", sync)
    document.addEventListener("visibilitychange", sync)
    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener("focus", sync)
      window.removeEventListener("blur", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [apiBaseUrl])
}
