"use client"

import Link from "next/link"
import { useState, type ComponentProps } from "react"

export function PrefetchLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false)

  return (
    <Link
      {...props}
      prefetch={intent ? true : "auto"}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        if (!event.defaultPrevented) setIntent(true)
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) setIntent(true)
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event)
        if (!event.defaultPrevented) setIntent(true)
      }}
    />
  )
}
