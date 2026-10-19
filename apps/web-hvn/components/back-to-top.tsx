"use client"

import { ChevronUpIcon } from "lucide-react"
import { useScrollDirection } from "@mantine/hooks"
import { Button } from "@workspace/ui/components/button"

export function BackToTop() {
  const visible = useScrollDirection() === "up"

  return (
    <div className="pointer-events-none fixed right-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 overflow-hidden pr-4">
      <Button
        className="hvn-back-to-top focus-visible:ring-inset"
        size="icon-lg"
        aria-label="Lên đầu trang"
        aria-hidden={!visible}
        inert={!visible}
        data-visible={visible}
        title="Lên đầu trang"
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          })
        }
      >
        <ChevronUpIcon aria-hidden="true" strokeWidth={4} />
      </Button>
    </div>
  )
}
