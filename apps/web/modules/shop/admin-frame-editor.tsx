"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  type AdminAvatarFrame,
  findFrameByCode,
} from "@/modules/avatar-frames/admin-api"
import { AdminFramePreview } from "@/modules/avatar-frames/admin-preview"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  type FrameShopDraft,
  shopErrorMessage,
  shopNeedsReload,
  updateFrameShop,
  validateFrameShopDraft,
} from "./admin-api"

export function AdminFrameShopEditor({
  initialFrame,
  apiBaseUrl,
  onClose,
  onChanged,
}: {
  initialFrame: AdminAvatarFrame
  apiBaseUrl: string
  onClose: () => void
  onChanged: () => void
}) {
  const [frame, setFrame] = useState(initialFrame)
  const [draft, setDraft] = useState<FrameShopDraft>({
    price: frame.shop.price ?? "",
    stock: String(frame.shop.stock),
  })
  const [errors, setErrors] = useState<{ price?: string; stock?: string }>({})
  const [needsReload, setNeedsReload] = useState(false)
  const [reloading, setReloading] = useState(false)
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () => updateFrameShop(apiBaseUrl, frame, draft),
    onSuccess: () => {
      toast.add({ type: "success", title: "Đã cập nhật giá và tồn kho" })
      onChanged()
      onClose()
    },
    onError: (error) => {
      setNeedsReload(shopNeedsReload(error))
      toast.add({ type: "error", title: shopErrorMessage(error) })
      onChanged()
    },
  })
  const busy = mutation.isPending || reloading
  const reload = async () => {
    setReloading(true)
    try {
      const latest = await findFrameByCode(apiBaseUrl, frame.code)
      if (!latest) throw new Error("Missing frame")
      setFrame(latest)
      setDraft({
        price: latest.shop.price ?? "",
        stock: String(latest.shop.stock),
      })
      setErrors({})
      setNeedsReload(false)
      onChanged()
    } catch (error) {
      toast.add({ type: "error", title: shopErrorMessage(error) })
    } finally {
      setReloading(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader className="p-6 pr-12 pb-4">
          <DialogTitle>Giá / tồn kho — {frame.name}</DialogTitle>
          <DialogDescription>
            Giá bán trực tiếp và tổng tồn kho hiện tại. Gacha không sử dụng tồn
            kho này.
          </DialogDescription>
        </DialogHeader>
        <form
          id="frame-shop-form"
          className="min-h-0 space-y-4 overflow-y-auto px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (busy || needsReload) return
            const nextErrors = validateFrameShopDraft(draft)
            setErrors(nextErrors)
            if (!Object.keys(nextErrors).length) mutation.mutate()
          }}
        >
          <AdminFramePreview frame={frame.frame} animate />
          {(!frame.active || !frame.frame || frame.limited) && (
            <p className="text-sm text-muted-foreground">
              Khung đang tắt, chưa có ảnh hoặc limited sẽ không được bán trực
              tiếp, dù đã có giá và tồn kho.
            </p>
          )}
          <FieldGroup>
            <Field data-invalid={!!errors.price}>
              <FieldLabel htmlFor="frame-shop-price">Giá (coin)</FieldLabel>
              <Input
                id="frame-shop-price"
                inputMode="numeric"
                maxLength={19}
                value={draft.price}
                disabled={busy || needsReload}
                aria-invalid={!!errors.price}
                aria-describedby={
                  errors.price ? "frame-shop-price-error" : undefined
                }
                onChange={(event) =>
                  setDraft({ ...draft, price: event.target.value })
                }
              />
              <FieldError id="frame-shop-price-error">
                {errors.price}
              </FieldError>
            </Field>
            <Field data-invalid={!!errors.stock}>
              <FieldLabel htmlFor="frame-shop-stock">Tồn kho</FieldLabel>
              <Input
                id="frame-shop-stock"
                inputMode="numeric"
                maxLength={10}
                value={draft.stock}
                disabled={busy || needsReload}
                aria-invalid={!!errors.stock}
                aria-describedby="frame-shop-stock-description frame-shop-stock-error"
                onChange={(event) =>
                  setDraft({ ...draft, stock: event.target.value })
                }
              />
              <FieldDescription id="frame-shop-stock-description">
                Đặt số lượng còn lại, không phải số lượng cộng thêm. Giá trị 0
                nghĩa là hết hàng.
              </FieldDescription>
              <FieldError id="frame-shop-stock-error">
                {errors.stock}
              </FieldError>
            </Field>
          </FieldGroup>
          {needsReload && (
            <p role="alert" className="text-sm text-destructive">
              Kết quả lưu chưa xác định hoặc dữ liệu đã đổi. Tải trạng thái mới
              sẽ thay các giá trị đang nhập.
            </p>
          )}
        </form>
        <DialogFooter className="border-t p-6 pt-4">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
          {needsReload ? (
            <Button disabled={busy} onClick={() => void reload()}>
              {reloading && <Spinner />}Tải trạng thái mới
            </Button>
          ) : (
            <Button type="submit" form="frame-shop-form" disabled={busy}>
              {mutation.isPending && <Spinner />}Lưu
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
