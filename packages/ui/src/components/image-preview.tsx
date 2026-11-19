"use client"

import type { ReactNode } from "react"
import { ExpandIcon } from "lucide-react"

import { AssetImage } from "@workspace/ui/components/asset-image"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"

export function ImagePreview({
  alt,
  children,
  fallbackSrc,
  height,
  src,
  width,
}: {
  alt: string
  children: ReactNode
  fallbackSrc: string | null
  height: number
  src: string | null
  width: number
}) {
  if (!src) return children

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Phóng to ${alt}`}
        className="group/preview relative block w-full cursor-zoom-in rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/50 text-white opacity-0 transition-opacity duration-150 group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100 motion-reduce:transition-none"
        >
          <ExpandIcon className="size-12" />
        </span>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="w-auto max-w-none gap-0 rounded-none bg-transparent p-0 ring-0 sm:max-w-none"
        overlayClassName="bg-black/80 supports-backdrop-filter:backdrop-blur-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div
          className="relative"
          style={{
            aspectRatio: `${width} / ${height}`,
            width: `min(${width}px, calc(100vw - 2rem), calc((100dvh - 4rem) * ${width / height}))`,
          }}
        >
          <AssetImage
            alt={alt}
            className="size-full object-contain"
            eager
            fadeIn
            fallbackSrc={fallbackSrc}
            height={height}
            showSpinner
            src={src}
            width={width}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
