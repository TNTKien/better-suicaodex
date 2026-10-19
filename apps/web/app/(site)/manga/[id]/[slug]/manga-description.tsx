"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronsDownIcon, ChevronsUpIcon } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { Streamdown } from "streamdown"

import { basicMarkdownElements } from "@/lib/markdown"

const collapsedHeight = 160

export function MangaDescription({
  children,
  mobileDetails,
}: {
  children: string
  mobileDetails?: ReactNode
}) {
  const contentId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const canExpand = contentHeight > collapsedHeight

  useEffect(() => {
    const content = contentRef.current

    if (!content) return

    const observer = new ResizeObserver(() => {
      setContentHeight(content.scrollHeight)
    })

    observer.observe(content)

    return () => observer.disconnect()
  }, [])

  const fade =
    canExpand && !expanded
      ? "linear-gradient(black 0%, black 60%, transparent 100%)"
      : "none"

  return (
    <div className="relative flex flex-col">
      <div
        className="overflow-hidden transition-[max-height] duration-300 motion-reduce:transition-none"
        id={contentId}
        style={{
          maxHeight: expanded ? contentHeight : collapsedHeight,
          maskImage: fade,
          WebkitMaskImage: fade,
        }}
      >
        <div ref={contentRef}>
          {children ? (
            <Streamdown
              allowedElements={basicMarkdownElements}
              className="text-sm leading-6 text-pretty [&_p]:whitespace-pre-line sm:text-base sm:leading-7"
              controls={false}
              mode="static"
              skipHtml
            >
              {children}
            </Streamdown>
          ) : null}
          {mobileDetails ? (
            <div className={cn("lg:hidden", children && "mt-7")}>
              {mobileDetails}
            </div>
          ) : null}
        </div>
      </div>

      {canExpand && (
        <div
          className={cn(
            "flex w-full justify-center border-t transition-colors",
            expanded ? "border-transparent" : "border-primary"
          )}
        >
          <Button
            aria-controls={contentId}
            aria-expanded={expanded}
            className="h-4 rounded-t-none border-none px-1 text-xs"
            onClick={() => setExpanded((current) => !current)}
            size="xs"
            variant={expanded ? "secondary" : "default"}
          >
            {expanded ? (
              <>
                <ChevronsUpIcon aria-hidden="true" />
                thu gọn
                <ChevronsUpIcon aria-hidden="true" />
              </>
            ) : (
              <>
                <ChevronsDownIcon aria-hidden="true" />
                xem thêm
                <ChevronsDownIcon aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
