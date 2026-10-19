"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ImageOffIcon, UserRoundIcon } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import { useAccount } from "@/modules/account/provider"
import type { AdminAvatarFrame } from "./admin-api"
import {
  defaultFrameAlignment,
  frameOverlayStyle,
  type FrameAlignment,
} from "./avatar-decoration"

function PreviewAvatar() {
  const { account } = useAccount()
  return (
    <Avatar className="size-32">
      <AvatarImage
        src={account?.user.image ?? undefined}
        alt={account?.user.name || "Avatar admin"}
      />
      <AvatarFallback>
        <UserRoundIcon aria-hidden="true" className="size-14" />
      </AvatarFallback>
    </Avatar>
  )
}

export function SelectedFramePreview({
  file,
  alignment = defaultFrameAlignment,
}: {
  file: File
  alignment?: Partial<FrameAlignment>
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    if (imageRef.current) imageRef.current.src = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return (
    <div className="flex flex-col items-center gap-2 rounded-md bg-muted/50 p-2">
      <div className="relative flex size-40 items-center justify-center">
        <div className="relative size-32">
          <PreviewAvatar />
          <picture
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 motion-reduce:hidden"
            style={frameOverlayStyle(alignment)}
          >
            <img
              ref={imageRef}
              alt="Ảnh khung đã chọn"
              width={318}
              height={318}
              className="size-full object-contain"
            />
          </picture>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Ảnh đã chọn, chưa lưu.</p>
      <p className="hidden text-xs text-muted-foreground motion-reduce:block">
        Xem thử ảnh nguồn được ẩn khi bật giảm chuyển động.
      </p>
    </div>
  )
}

export function AdminFramePreview({
  frame,
  animate = false,
  alignment,
}: {
  frame: AdminAvatarFrame["frame"]
  animate?: boolean
  alignment?: Partial<FrameAlignment>
}) {
  if (!frame)
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-md bg-muted/50 text-sm text-muted-foreground">
        <ImageOffIcon aria-hidden="true" className="size-6" />
        Chưa có ảnh
      </div>
    )
  return (
    <FrameImage
      key={`${frame.assetUrl}:${animate}`}
      frame={frame}
      animate={animate}
      alignment={alignment ?? frame}
    />
  )
}

function FrameImage({
  frame,
  animate,
  alignment,
}: {
  frame: NonNullable<AdminAvatarFrame["frame"]>
  animate: boolean
  alignment: Partial<FrameAlignment>
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-muted/50 p-2">
      <div className="relative flex size-40 items-center justify-center">
        <div className="relative size-32">
          <PreviewAvatar />
          {!failed &&
            (animate && frame.animated ? (
              <picture
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={frameOverlayStyle(alignment)}
              >
                <source
                  media="(prefers-reduced-motion: reduce)"
                  srcSet={frame.previewUrl}
                />
                {/* Native picture keeps animated WebP intact and selects the static
                preview before downloading when reduced motion is requested. */}
                <img
                  src={frame.assetUrl}
                  alt={frame.name}
                  width={frame.width}
                  height={frame.height}
                  className="size-full object-contain"
                  onError={() => setFailed(true)}
                />
              </picture>
            ) : (
              <Image
                unoptimized
                src={frame.previewUrl}
                alt={frame.name}
                width={frame.width}
                height={frame.height}
                className="pointer-events-none absolute max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                style={frameOverlayStyle(alignment)}
                onError={() => setFailed(true)}
              />
            ))}
        </div>
      </div>
      {failed && (
        <p role="status" className="text-xs text-muted-foreground">
          Không tải được ảnh khung.
        </p>
      )}
    </div>
  )
}
