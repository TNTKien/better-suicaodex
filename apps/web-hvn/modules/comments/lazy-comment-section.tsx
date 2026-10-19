"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import type { CommentScope } from "@workspace/account/comments-api"
import { Spinner } from "@workspace/ui/components/spinner"

const Comments = dynamic(
  () =>
    import("@/modules/comments/comment-section").then(
      (module) => module.CommentSection
    ),
  {
    ssr: false,
    loading: () => (
      <Spinner aria-label="Đang tải bình luận" className="mx-auto my-6" />
    ),
  }
)

export function LazyCommentSection({
  scope,
  targetId,
}: {
  scope: CommentScope
  targetId: string
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const target = sentinel.current
    if (!target) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={sentinel}
      className="min-h-24"
      aria-label={scope === "chapter" ? "Bình luận chương" : "Bình luận truyện"}
    >
      {visible ? <Comments scope={scope} targetId={targetId} /> : null}
    </div>
  )
}
