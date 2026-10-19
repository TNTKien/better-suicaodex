"use client"

import { useEffect, useRef } from "react"
import { toast } from "@workspace/ui/components/toast"

export function usePermissionToast(message: string | null) {
  const previous = useRef<string | null>(null)
  useEffect(() => {
    if (message && message !== previous.current)
      toast.add({ type: "error", title: message })
    previous.current = message
  }, [message])
}
