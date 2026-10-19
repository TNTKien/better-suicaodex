"use client"

import { useState } from "react"

export function HomeRailPeriodTabs({
  label,
  periods,
}: {
  label: string
  periods: ReadonlyArray<readonly [string, string]>
}) {
  const [active, setActive] = useState(periods[0]?.[0] ?? "")

  return (
    <div
      aria-label={label}
      className="grid grid-cols-4 rounded-lg bg-muted p-1"
      role="group"
    >
      {periods.map(([value, periodLabel]) => (
        <button
          key={value}
          aria-label={`${label}: ${periodLabel}`}
          aria-pressed={active === value}
          className="rounded-md px-1.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
          onClick={() => setActive(value)}
          type="button"
        >
          {periodLabel}
        </button>
      ))}
    </div>
  )
}
