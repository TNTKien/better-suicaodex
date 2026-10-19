"use client"

import { ImageOffIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

export function watchImageFallback(
  image: HTMLImageElement,
  timeoutMs: number,
  fallback: () => void
) {
  let visible = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const update = () => {
    clearTimeout(timer)
    if (
      !visible ||
      document.hidden ||
      (image.complete && image.naturalWidth > 0)
    )
      return
    timer = setTimeout(() => {
      if (!image.complete || image.naturalWidth === 0) fallback()
    }, timeoutMs)
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false
    update()
  })
  observer.observe(image)
  document.addEventListener("visibilitychange", update)
  return () => {
    clearTimeout(timer)
    observer.disconnect()
    document.removeEventListener("visibilitychange", update)
  }
}

export function AssetImage({
  alt,
  className,
  eager = false,
  fadeIn = false,
  fallbackSrc = null,
  fallbackTimeoutMs,
  height,
  loading,
  onActivate,
  priority,
  retry = false,
  showSpinner = false,
  sizes,
  src,
  srcSet,
  width,
}: {
  alt: string
  className?: string
  eager?: boolean
  fadeIn?: boolean
  fallbackSrc?: string | null
  fallbackTimeoutMs?: number
  height: number
  loading?: "eager" | "lazy"
  onActivate?: () => void
  priority?: "high" | "low" | "auto"
  retry?: boolean
  /** Position the overlay inside a relative page container. */
  showSpinner?: boolean
  sizes?: string
  src: string | null
  srcSet?: string
  width: number
}) {
  const [activeSrc, setActiveSrc] = useState(src)
  const [loaded, setLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const failed = !activeSrc
  const attachImage = useCallback((image: HTMLImageElement | null) => {
    imageRef.current = image
    // Cached images can finish before hydration attaches onLoad.
    if (image?.complete && image.naturalWidth > 0) setLoaded(true)
  }, [])

  useEffect(() => {
    const image = imageRef.current
    if (
      !image ||
      !fallbackTimeoutMs ||
      !fallbackSrc ||
      activeSrc !== src ||
      loaded
    )
      return
    // Lazy pages get their timeout only when visible, never at chapter mount.
    return watchImageFallback(image, fallbackTimeoutMs, () => {
      setActiveSrc((current) => (current === src ? fallbackSrc : current))
    })
  }, [activeSrc, fallbackSrc, fallbackTimeoutMs, loaded, src])

  if (failed) {
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground",
          className
        )}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <div
          aria-label={src ? `Không thể tải ${alt}` : `${alt} chưa có ảnh`}
          className="flex flex-col items-center gap-2"
          role="img"
        >
          <ImageOffIcon aria-hidden="true" className="size-6" />
          {/* <span>{src ? "Ảnh không tải được" : "No Cover"}</span> */}
        </div>
        {retry && src ? (
          <button
            className="rounded-md border px-3 py-1.5 font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={(event) => {
              event.stopPropagation()
              setLoaded(false)
              setActiveSrc(src)
            }}
            type="button"
          >
            Thử lại
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {showSpinner && !loaded ? (
        <span className="pointer-events-none absolute inset-0">
          {/* Keep the indicator visible while scrolling a long-strip page. */}
          <span className="sticky top-0 flex h-full max-h-dvh items-center justify-center">
            <Spinner
              aria-label={`Đang tải ${alt}`}
              className="size-7 text-muted-foreground"
            />
          </span>
        </span>
      ) : null}
      <img
        key={activeSrc}
        ref={attachImage}
        alt={alt}
        className={cn(
          className,
          onActivate &&
            "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          fadeIn &&
            "transition-opacity duration-200 motion-reduce:transition-none",
          fadeIn && (loaded ? "opacity-100" : "opacity-0")
        )}
        decoding="async"
        fetchPriority={priority ?? (eager ? "high" : "auto")}
        height={height}
        loading={loading ?? (eager ? "eager" : "lazy")}
        onClick={onActivate}
        onError={() => {
          setLoaded(false)
          setActiveSrc(activeSrc !== fallbackSrc ? fallbackSrc : null)
        }}
        onLoad={() => setLoaded(true)}
        onKeyDown={
          onActivate
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return
                event.preventDefault()
                onActivate()
              }
            : undefined
        }
        role={onActivate ? "button" : undefined}
        src={activeSrc}
        srcSet={activeSrc === src ? srcSet : undefined}
        sizes={activeSrc === src && srcSet ? sizes : undefined}
        tabIndex={onActivate ? 0 : undefined}
        width={width}
      />
    </>
  )
}
