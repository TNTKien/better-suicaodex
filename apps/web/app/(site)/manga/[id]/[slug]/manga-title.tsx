"use client"

import { useLayoutEffect, useRef } from "react"

export function mangaTitleFitConstraints(width: number) {
  return {
    maxFontSize: Math.min(64, Math.max(32, Math.floor(width / 10))),
    maxLines: width < 320 ? 5 : width < 640 ? 4 : 3,
    minFontSize: Math.min(32, Math.max(20, Math.floor(width / 18))),
  }
}

export function largestFittingFontSize(
  minFontSize: number,
  maxFontSize: number,
  fits: (fontSize: number) => boolean
) {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
    if (fits(fontSize)) return fontSize
  }

  return minFontSize
}

function fitTitle(element: HTMLHeadingElement) {
  const width = element.parentElement?.clientWidth ?? element.clientWidth
  const { maxFontSize, maxLines, minFontSize } = mangaTitleFitConstraints(width)

  const fontSize = largestFittingFontSize(
    minFontSize,
    maxFontSize,
    (candidate) => {
      element.style.fontSize = `${candidate}px`
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
      const lines = Math.ceil((element.scrollHeight - 1) / lineHeight)

      return lines <= maxLines && element.scrollWidth <= element.clientWidth + 1
    }
  )

  element.style.fontSize = `${fontSize}px`
}

export function MangaTitle({ children }: { children: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const title = titleRef.current
    const container = title?.parentElement
    if (!title || !container) return

    let lastWidth = -1
    const refit = (force = false) => {
      if (!force && container.clientWidth === lastWidth) return
      lastWidth = container.clientWidth
      fitTitle(title)
    }

    refit()

    const resizeObserver = new ResizeObserver(() => refit())
    resizeObserver.observe(container)
    void document.fonts.ready.then(() => {
      if (title.isConnected) refit(true)
    })

    return () => resizeObserver.disconnect()
  }, [children])

  return (
    <h1
      ref={titleRef}
      className="font-heading text-2xl leading-[1.1] font-bold tracking-tight text-balance wrap-break-word sm:text-4xl md:text-5xl lg:text-6xl"
    >
      {children}
    </h1>
  )
}
