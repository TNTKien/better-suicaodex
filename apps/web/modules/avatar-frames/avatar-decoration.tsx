"use client"

import { useState, type ReactNode } from "react"
import type { components } from "@/src/lib/generated/api"

export type AvatarDecorationFrame =
  components["schemas"]["AvatarFrameSummary"] | null

export type FrameAlignment = Pick<
  NonNullable<AvatarDecorationFrame>,
  "displayScale" | "offsetX" | "offsetY"
>
export const defaultFrameAlignment: FrameAlignment = {
  displayScale: 125,
  offsetX: 0,
  offsetY: 0,
}

export function frameOverlayStyle(alignment: Partial<FrameAlignment>) {
  const { displayScale, offsetX, offsetY } = alignment
  const scale = Number.isFinite(displayScale) ? displayScale! : 125
  return {
    width: `${scale}%`,
    height: `${scale}%`,
    left: `${50 + (Number.isFinite(offsetX) ? offsetX! : 0)}%`,
    top: `${50 + (Number.isFinite(offsetY) ? offsetY! : 0)}%`,
  }
}

export function AvatarDecoration({
  children,
  frame,
  animate = true,
}: {
  children: ReactNode
  frame: AvatarDecorationFrame
  animate?: boolean
}) {
  if (!frame) return children
  return (
    <span className="relative inline-flex h-fit w-fit shrink-0 align-middle">
      {children}
      <FrameOverlay
        key={`${frame.assetUrl}:${frame.previewUrl}:${animate}`}
        frame={frame}
        animate={animate}
      />
    </span>
  )
}

function FrameOverlay({
  frame,
  animate,
}: {
  frame: NonNullable<AvatarDecorationFrame>
  animate: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <picture
      aria-hidden="true"
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={frameOverlayStyle(frame)}
    >
      {animate && frame.animated && (
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet={frame.previewUrl}
        />
      )}
      {/* Keep animated WebP intact; CSS decoration must not change or mask the
        underlying avatar, including frames with intentionally opaque centers. */}
      <img
        src={animate && frame.animated ? frame.assetUrl : frame.previewUrl}
        alt=""
        width={frame.width}
        height={frame.height}
        loading="lazy"
        decoding="async"
        className="size-full object-contain"
        onError={() => setFailed(true)}
      />
    </picture>
  )
}
