"use client"

import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

export function RestartUploadButton({
  disabled = false,
  onRestart,
}: {
  disabled?: boolean
  onRestart: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  async function confirm() {
    if (inFlight.current || disabled) return
    inFlight.current = true
    setPending(true)
    try {
      await onRestart()
      setOpen(false)
      toast.add({ type: "success", title: "Đã bắt đầu phiên tải ảnh mới." })
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : "Không thể bắt đầu phiên tải ảnh mới.",
      })
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  return (
    <>
      <Button
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Huỷ phiên và bắt đầu mới
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Huỷ phiên tải ảnh và bắt đầu mới?</DialogTitle>
            <DialogDescription>
              Các ảnh đã chọn hoặc tải lên trong phiên cũ sẽ bị bỏ. Bạn cần chọn
              lại ảnh cho phiên mới. Thông tin chương và bộ ảnh đã xuất bản
              không bị thay đổi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Giữ phiên hiện tại
            </Button>
            <Button
              disabled={pending || disabled}
              onClick={() => void confirm()}
              type="button"
              variant="destructive"
            >
              {pending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {pending ? "Đang tạo phiên mới…" : "Huỷ phiên và bắt đầu mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
