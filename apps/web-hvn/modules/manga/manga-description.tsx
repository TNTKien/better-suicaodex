"use client"

import { Streamdown } from "streamdown"
import { basicMarkdownElements } from "@workspace/ui/lib/markdown"

export function MangaDescription({ children }: { children: string }) {
  return (
    <Streamdown
      allowedElements={basicMarkdownElements}
      controls={false}
      mode="static"
      skipHtml
      className="hvn-manga-description text-base leading-snug wrap-break-word [&_p]:whitespace-pre-line"
    >
      {children}
    </Streamdown>
  )
}
