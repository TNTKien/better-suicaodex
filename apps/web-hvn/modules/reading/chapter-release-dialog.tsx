"use client"

import Link from "next/link"
import type { RefObject } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { components } from "@/src/lib/generated/api"

export function ChapterReleaseDialog({
  title,
  releases,
  finalFocus,
  onClose,
  onNavigate,
}: {
  title: string
  releases: components["schemas"]["ChapterSummary"][]
  finalFocus: RefObject<HTMLElement | null>
  onClose: () => void
  onNavigate?: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="hvn-reading-dialog sm:max-w-2xl"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle className="hvn-login-heading hvn-login-heading-info pr-12">
            {title}
          </DialogTitle>
          <DialogDescription>Chọn chapter bạn muốn đọc.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[65dvh] divide-y divide-[#444444] overflow-y-auto px-3 pb-3">
          {releases.map((chapter) => (
            <li key={chapter.id}>
              <Link
                href={`/chapter/${chapter.id}`}
                prefetch={false}
                onNavigate={() => {
                  onNavigate?.()
                  onClose()
                }}
                className="group flex flex-col gap-1 px-2 py-3 hover:bg-[#444444] focus-visible:bg-[#444444]"
              >
                <span className="font-bold wrap-break-word text-[#00bfff] group-hover:text-white group-focus-visible:text-white">
                  {chapter.number ? `Chap ${chapter.number}` : "Oneshot"}
                  {chapter.title ? `: ${chapter.title}` : ""}
                </span>
                <span className="text-sm wrap-break-word text-white">
                  {chapter.groups.map((group) => group.name).join(", ") ||
                    "Chưa có nhóm dịch"}
                  {" · "}
                  {chapter.uploader.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
