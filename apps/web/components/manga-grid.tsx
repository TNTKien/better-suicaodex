import { Children, type CSSProperties, type ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

export function MangaGrid({
  className,
  children,
  hideIncompleteRow = true,
}: {
  className?: string
  children: ReactNode
  hideIncompleteRow?: boolean
}) {
  const items = Children.toArray(children)
  if (items.length === 0) return null

  return (
    <div
      className={cn(
        "manga-grid",
        !hideIncompleteRow && "manga-grid-all",
        className
      )}
      style={{ "--manga-count": items.length } as CSSProperties}
    >
      {items}
    </div>
  )
}
