"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ArrowRightIcon } from "lucide-react"

import {
  GroupSearchPicker,
  type ContentGroup,
} from "@/components/content-groups-field"
import type { components } from "@/src/lib/generated/api"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

type ApiError = components["schemas"]["ApiError"]
type Manga = components["schemas"]["MangaManagementDetail"]
type Group = components["schemas"]["TranslationGroupSummary"]

export function MangaOwnerTransfer({
  apiBaseUrl,
  disabled,
  manga,
  onTransferred,
}: {
  apiBaseUrl: string
  disabled: boolean
  manga: Manga
  onTransferred: (manga: Manga) => void
}) {
  const [target, setTarget] = useState<Group | null>(null)
  const [addTargetGroupToChapters, setAddTargetGroupToChapters] =
    useState(false)
  const [transferSystemChapterOwnership, setTransferSystemChapterOwnership] =
    useState(false)
  const transfer = useMutation({
    mutationFn: async ({
      group,
      includeExistingChapters,
      transferSystemChapters,
    }: {
      group: ContentGroup
      includeExistingChapters: boolean
      transferSystemChapters: boolean
    }) => {
      const response = await fetch(
        new URL(
          `/v1/admin/manga/${encodeURIComponent(manga.id)}/owner`,
          apiBaseUrl
        ),
        {
          method: "PUT",
          cache: "no-store",
          credentials: "include",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            addTargetGroupToChapters: includeExistingChapters,
            expectedVersion: manga.version,
            ownerGroupId: group.id,
            transferSystemChapterOwnership: transferSystemChapters,
          }),
          signal: AbortSignal.timeout(8_000),
        }
      )
      const body = (await response.json().catch(() => null)) as
        { data: Manga } | ApiError | null
      if (!response.ok) {
        const message =
          body && "error" in body
            ? body.error.message
            : "Không thể chuyển truyện."
        throw new Error(message)
      }
      return (body as { data: Manga }).data
    },
    onSuccess: (saved) => {
      setTarget(null)
      setAddTargetGroupToChapters(false)
      setTransferSystemChapterOwnership(false)
      onTransferred(saved)
      toast.add({ type: "success", title: "Đã chuyển truyện" })
    },
  })

  return (
    <div className="flex flex-col items-start gap-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Chuyển truyện</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chỉ quản trị viên có thể chuyển truyện sang nhóm khác.
        </p>
      </div>
      <GroupSearchPicker
        allowSystem
        apiBaseUrl={apiBaseUrl}
        disabled={disabled || transfer.isPending}
        excludedIds={[manga.ownerGroup.id]}
        label="Tìm nhóm nhận truyện..."
        onSelect={(group) => {
          transfer.reset()
          setAddTargetGroupToChapters(false)
          setTransferSystemChapterOwnership(false)
          setTarget(group)
        }}
      />
      <Dialog
        onOpenChange={(open) => {
          if (!open && !transfer.isPending) {
            setTarget(null)
            setAddTargetGroupToChapters(false)
            setTransferSystemChapterOwnership(false)
          }
        }}
        open={target !== null}
      >
        <DialogContent showCloseButton={!transfer.isPending}>
          <DialogHeader>
            <DialogTitle>Chuyển truyện sang nhóm khác?</DialogTitle>
            <DialogDescription>
              Nhóm mới sẽ có quyền quản lý và xóa truyện.
            </DialogDescription>
          </DialogHeader>
          {target ? (
            <div className="flex items-center justify-center gap-3 rounded-md border p-4 text-sm">
              <span className="font-medium">{manga.ownerGroup.name}</span>
              <ArrowRightIcon aria-hidden="true" className="size-4" />
              <span className="font-medium">{target.name}</span>
            </div>
          ) : null}
          <Alert>
            <AlertDescription>
              Nhóm cũ sẽ được gỡ khỏi truyện nếu trước đó không được gắn riêng.
              Owner và nhóm hiện tại của các chương chỉ thay đổi theo lựa chọn
              bên dưới.
            </AlertDescription>
          </Alert>
          {target && target.slug !== "system" ? (
            <div className="space-y-4">
              <Field orientation="horizontal">
                <Checkbox
                  checked={addTargetGroupToChapters}
                  id="add-target-group-to-chapters"
                  onCheckedChange={(checked) =>
                    setAddTargetGroupToChapters(checked === true)
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor="add-target-group-to-chapters">
                    Cho phép nhóm mới sửa các chương hiện có
                  </FieldLabel>
                  <FieldDescription>
                    Nhóm mới được thêm vào mọi chương, còn owner của chương
                    không thay đổi.
                  </FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  checked={transferSystemChapterOwnership}
                  id="transfer-system-chapter-ownership"
                  onCheckedChange={(checked) =>
                    setTransferSystemChapterOwnership(checked === true)
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor="transfer-system-chapter-ownership">
                    Chuyển luôn các chương đang do System giữ
                  </FieldLabel>
                  <FieldDescription>
                    Nhóm mới trở thành owner và có quyền xóa các chương này.
                    Chương thuộc nhóm thật khác được giữ nguyên.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </div>
          ) : null}
          {transfer.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {transfer.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={transfer.isPending}
              onClick={() => {
                setTarget(null)
                setAddTargetGroupToChapters(false)
                setTransferSystemChapterOwnership(false)
              }}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!target || transfer.isPending}
              onClick={() =>
                target &&
                transfer.mutate({
                  group: target,
                  includeExistingChapters:
                    target.slug !== "system" && addTargetGroupToChapters,
                  transferSystemChapters:
                    target.slug !== "system" && transferSystemChapterOwnership,
                })
              }
              type="button"
            >
              {transfer.isPending ? <Spinner data-icon="inline-start" /> : null}
              Chuyển truyện
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
