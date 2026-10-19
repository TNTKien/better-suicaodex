"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui/components/collapsible"
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
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"

import {
  type AdminAvatarFrame,
  type CreateFrameInput,
  type FrameRarity,
  findFrameByCode,
  frameErrorMessage,
  frameNeedsReload,
  frameTopicsOptions,
  saveFrameWithAsset,
  updateFrame,
  validateFrameFile,
} from "./admin-api"
import { AdminFramePreview, SelectedFramePreview } from "./admin-preview"
import { defaultFrameAlignment } from "./avatar-decoration"

const rarityOptions = ["R", "SR", "SSR"].map((value) => ({
  label: value,
  value,
}))
const emptyDraft: CreateFrameInput = {
  ...defaultFrameAlignment,
  code: "",
  name: "",
  description: "",
  topicId: null,
  rarity: "R",
  limited: false,
}
function toDraft(frame: AdminAvatarFrame): CreateFrameInput {
  return {
    code: frame.code,
    name: frame.name,
    description: frame.description,
    topicId: frame.topicId,
    rarity: frame.rarity,
    limited: frame.limited,
    displayScale: frame.displayScale,
    offsetX: frame.offsetX,
    offsetY: frame.offsetY,
  }
}
export function frameSizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} MiB`
}

export function AdminFrameEditor({
  initialFrame,
  apiBaseUrl,
  userId,
  onClose,
  onChanged,
}: {
  initialFrame: AdminAvatarFrame | null
  apiBaseUrl: string
  userId: string
  onClose: () => void
  onChanged: () => void
}) {
  const topics = useQuery(frameTopicsOptions(apiBaseUrl, userId))
  const [frame, setFrame] = useState(initialFrame)
  const [draft, setDraft] = useState(() =>
    initialFrame ? toDraft(initialFrame) : emptyDraft
  )
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const [confirmVisibility, setConfirmVisibility] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [metadataSaved, setMetadataSaved] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clearFile = () => {
    setFile(null)
    setFileError(null)
    setFileInputKey((key) => key + 1)
  }
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (action: "save" | "visibility") => {
      if (action === "visibility" && frame)
        return updateFrame(apiBaseUrl, frame.id, {
          expectedVersion: frame.version,
          active: !frame.active,
        })
      return saveFrameWithAsset(
        apiBaseUrl,
        {
          ...draft,
          code: draft.code.trim(),
          name: draft.name.trim(),
          description: draft.description?.trim() ?? "",
        },
        frame,
        file,
        (saved) => {
          setFrame(saved)
          setDraft(toDraft(saved))
          setUploading(!!file)
          setMetadataSaved(true)
        }
      )
    },
    onMutate: () => {
      setError(null)
      setUploading(false)
      setMetadataSaved(false)
    },
    onSuccess: ({ data }, action) => {
      setFrame(data)
      setDraft(toDraft(data))
      setConfirmVisibility(false)
      if (action === "save") clearFile()
      toast.add({
        type: "success",
        title:
          action === "save"
            ? "Đã lưu khung avatar."
            : data.active
              ? "Đã bật khung."
              : "Đã tắt khung.",
      })
    },
    onError: (cause) => {
      setError(frameErrorMessage(cause))
      setNeedsReload(frameNeedsReload(cause))
      setConfirmVisibility(false)
      void topics.refetch()
    },
    onSettled: () => {
      setUploading(false)
      onChanged()
    },
  })
  const reload = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () =>
      findFrameByCode(apiBaseUrl, frame?.code ?? draft.code.trim()),
    onSuccess: (latest) => {
      if (frame && !latest) {
        setError("Không tìm thấy khung. Hãy đóng dialog và tải lại danh sách.")
        return
      }
      setFrame(latest)
      if (latest) setDraft(toDraft(latest))
      setNeedsReload(false)
      setError(null)
      onChanged()
      toast.add({
        type: "success",
        title: latest
          ? "Đã tải trạng thái mới nhất. Kiểm tra ảnh trước khi lưu tiếp."
          : "Chưa có khung với mã này. Bạn có thể tạo lại.",
      })
    },
    onError: () =>
      setError(
        "Chưa tải được trạng thái mới. Kiểm tra kết nối rồi thử tải lại."
      ),
  })
  const pending = mutation.isPending || reload.isPending
  const disabled = pending || needsReload
  const dirty =
    !frame ||
    draft.name.trim() !== frame.name ||
    (draft.description?.trim() ?? "") !== frame.description ||
    (draft.topicId ?? null) !== frame.topicId ||
    draft.rarity !== frame.rarity ||
    Boolean(draft.limited) !== frame.limited ||
    draft.displayScale !== frame.displayScale ||
    draft.offsetX !== frame.offsetX ||
    draft.offsetY !== frame.offsetY
  const topicItems = [
    { label: "Khác", value: "none" },
    ...(topics.data?.data ?? []).map((topic) => ({
      label: topic.name,
      value: topic.id,
    })),
  ]
  const missingTopic =
    !!draft.topicId && !topicItems.some((item) => item.value === draft.topicId)
  if (missingTopic)
    topicItems.push({
      label: "Chủ đề không khả dụng — chọn lại",
      value: draft.topicId!,
    })
  const canSave =
    !disabled &&
    !fileError &&
    (dirty || !!file) &&
    !!draft.name.trim() &&
    (!!frame || !!draft.code.trim()) &&
    !(topics.isSuccess && missingTopic) &&
    Number.isInteger(draft.displayScale) &&
    draft.displayScale! >= 50 &&
    draft.displayScale! <= 200 &&
    Number.isInteger(draft.offsetX) &&
    Math.abs(draft.offsetX!) <= 50 &&
    Number.isInteger(draft.offsetY) &&
    Math.abs(draft.offsetY!) <= 50

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={!pending}
      >
        <DialogHeader className="p-6 pr-12 pb-4">
          <DialogTitle>
            {frame ? "Quản lý khung avatar" : "Thêm khung avatar"}
          </DialogTitle>
          <DialogDescription>
            Điền thông tin, chọn ảnh và lưu khung. Bạn có thể xem thử trước khi
            bật.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Chưa hoàn tất thao tác</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                {metadataSaved && file && (
                  <p>
                    Thông tin khung đã được lưu. Ảnh đã chọn vẫn được giữ để bạn
                    kiểm tra và thử lại.
                  </p>
                )}
                {needsReload && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => reload.mutate()}
                  >
                    {reload.isPending && <Spinner data-icon="inline-start" />}
                    Tải trạng thái mới (bỏ thông tin chưa lưu)
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <form
              id="avatar-frame-metadata"
              onSubmit={(event) => {
                event.preventDefault()
                if (canSave) mutation.mutate("save")
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="frame-code">Mã khung</FieldLabel>
                  <Input
                    id="frame-code"
                    autoComplete="off"
                    required
                    maxLength={160}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="hoyolab-furina"
                    disabled={disabled || !!frame}
                    value={draft.code}
                    onChange={(event) =>
                      setDraft({ ...draft, code: event.target.value })
                    }
                  />
                  <FieldDescription>
                    Chữ thường, số và dấu gạch ngang. Không đổi được sau khi
                    tạo.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="frame-name">Tên khung</FieldLabel>
                  <Input
                    id="frame-name"
                    required
                    maxLength={160}
                    disabled={disabled}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="frame-description">Mô tả</FieldLabel>
                  <Textarea
                    id="frame-description"
                    rows={4}
                    maxLength={2000}
                    disabled={disabled}
                    value={draft.description ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                  <FieldDescription>Tối đa 2.000 ký tự.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="frame-topic">Chủ đề</FieldLabel>
                  <Select
                    items={topicItems}
                    value={draft.topicId ?? "none"}
                    disabled={disabled || topics.isPending}
                    onValueChange={(value) => {
                      if (value)
                        setDraft({
                          ...draft,
                          topicId: value === "none" ? null : value,
                        })
                    }}
                  >
                    <SelectTrigger id="frame-topic" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {topicItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {topics.isError && (
                    <FieldDescription>
                      Không tải được chủ đề.{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => void topics.refetch()}
                      >
                        Tải lại
                      </Button>
                    </FieldDescription>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="frame-rarity">Độ hiếm</FieldLabel>
                  <Select
                    items={rarityOptions}
                    value={draft.rarity}
                    disabled={disabled}
                    onValueChange={(value) => {
                      if (value)
                        setDraft({ ...draft, rarity: value as FrameRarity })
                    }}
                  >
                    <SelectTrigger id="frame-rarity" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {rarityOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={
                              Boolean(draft.limited) && option.value !== "SSR"
                            }
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor="frame-limited">
                      Khung limited
                    </FieldLabel>
                    <Switch
                      id="frame-limited"
                      checked={Boolean(draft.limited)}
                      disabled={
                        disabled || draft.rarity !== "SSR" || !!frame?.active
                      }
                      onCheckedChange={(limited) =>
                        setDraft({ ...draft, limited })
                      }
                    />
                  </div>
                  <FieldDescription>
                    Chỉ dành cho SSR. Không thể đổi sau khi khung từng được bật
                    hoặc cấp cho người dùng.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
            <div className="flex min-w-0 flex-col gap-4">
              {file ? (
                <SelectedFramePreview file={file} alignment={draft} />
              ) : (
                <AdminFramePreview
                  frame={frame?.frame ?? null}
                  alignment={draft}
                  animate
                />
              )}
              {frame && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant={frame.active ? "default" : "secondary"}>
                    {frame.active
                      ? "Đang bật"
                      : frame.frame
                        ? "Đang tắt"
                        : "Bản nháp"}
                  </Badge>
                  {frame.frame && (
                    <Badge variant="outline">
                      {frame.frame.animated ? "Ảnh động" : "Ảnh tĩnh"}
                    </Badge>
                  )}
                </div>
              )}
              {frame?.frame && !file && (
                <p className="text-xs text-muted-foreground">
                  {frame.frame.width} × {frame.frame.height} px ·{" "}
                  {frame.frameCount} frame ·{" "}
                  {frameSizeLabel(frame.byteSize ?? 0)}
                </p>
              )}
              <Field data-invalid={!!fileError}>
                <FieldLabel htmlFor="frame-file">
                  {frame?.frame ? "Thay ảnh khung" : "Ảnh khung"}
                </FieldLabel>
                <Input
                  key={fileInputKey}
                  id="frame-file"
                  type="file"
                  accept="image/png,image/webp,.png,.webp"
                  disabled={disabled}
                  aria-invalid={!!fileError}
                  aria-describedby="frame-file-help"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null
                    const message = selected
                      ? validateFrameFile(selected)
                      : null
                    setFileError(message)
                    setFile(message ? null : selected)
                  }}
                />
                <FieldDescription id="frame-file-help">
                  PNG tĩnh hoặc WebP tĩnh/động, tối đa 10 MiB, 120 frame. Ảnh
                  được upload khi lưu khung.
                </FieldDescription>
                {fileError && (
                  <p role="alert" className="text-sm text-destructive">
                    {fileError}
                  </p>
                )}
                {file && (
                  <>
                    <p className="text-xs wrap-anywhere text-muted-foreground">
                      {file.name} · {frameSizeLabel(file.size)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={clearFile}
                    >
                      Bỏ ảnh đã chọn
                    </Button>
                  </>
                )}
              </Field>
              <p className="text-xs text-muted-foreground">
                Khung lớn được thu nhỏ vừa 318×318, khung nhỏ giữ nguyên. Ảnh
                động đạt chuẩn giữ nguyên chất lượng. Thay ảnh khung đang bật có
                hiệu lực ngay khi lưu.
              </p>
              <Collapsible>
                <CollapsibleTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                    />
                  }
                >
                  Căn chỉnh hiển thị
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FieldGroup className="pt-4">
                    <FieldDescription>
                      Theo % kích thước avatar. Số dương dịch sang phải/xuống
                      dưới, số âm dịch sang trái/lên trên. Chỉ đổi cách hiển
                      thị, không sửa ảnh nguồn.
                    </FieldDescription>
                    {(
                      [
                        ["displayScale", "Kích thước khung (%)", 50, 200],
                        ["offsetX", "Dịch ngang (%)", -50, 50],
                        ["offsetY", "Dịch dọc (%)", -50, 50],
                      ] as const
                    ).map(([key, label, min, max]) => {
                      const value = draft[key]
                      const invalid =
                        !Number.isInteger(value) || value! < min || value! > max
                      return (
                        <Field
                          key={key}
                          data-invalid={invalid}
                          data-disabled={disabled}
                        >
                          <FieldLabel htmlFor={`frame-${key}`}>
                            {label}
                          </FieldLabel>
                          <Input
                            id={`frame-${key}`}
                            form="avatar-frame-metadata"
                            type="number"
                            required
                            min={min}
                            max={max}
                            step={1}
                            disabled={disabled}
                            aria-invalid={invalid}
                            aria-describedby={`frame-${key}-help`}
                            value={Number.isFinite(value) ? value : ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                [key]: event.target.valueAsNumber,
                              })
                            }
                          />
                          <FieldDescription id={`frame-${key}-help`}>
                            Số nguyên từ {min} đến {max}.
                          </FieldDescription>
                        </Field>
                      )
                    })}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={disabled}
                      onClick={() =>
                        setDraft({ ...draft, ...defaultFrameAlignment })
                      }
                    >
                      Khôi phục mặc định (125% / 0 / 0)
                    </Button>
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>
        <div className="border-t p-6 pt-4">
          {frame && confirmVisibility && (
            <Alert className="mb-4">
              <AlertTitle>
                {frame.active ? "Tắt khung này?" : "Bật khung này?"}
              </AlertTitle>
              <AlertDescription>
                {frame.active
                  ? "Khung sẽ ngừng hiển thị trên avatar người đang dùng. Quyền sở hữu được giữ nguyên."
                  : "Sau khi bật lần đầu, không thể đổi thuộc tính limited của khung."}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Đóng
            </Button>
            {confirmVisibility ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmVisibility(false)}
                >
                  Huỷ
                </Button>
                <Button
                  type="button"
                  disabled={disabled || dirty || !!file}
                  onClick={() => mutation.mutate("visibility")}
                >
                  {mutation.isPending && <Spinner data-icon="inline-start" />}
                  Xác nhận {frame?.active ? "tắt" : "bật"}
                </Button>
              </>
            ) : (
              <>
                {frame && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled || !frame.frame || dirty || !!file}
                    onClick={() => setConfirmVisibility(true)}
                  >
                    {frame.active ? "Tắt khung" : "Bật khung"}
                  </Button>
                )}
                <Button
                  type="submit"
                  form="avatar-frame-metadata"
                  disabled={!canSave}
                >
                  {mutation.isPending && <Spinner data-icon="inline-start" />}
                  {uploading
                    ? "Đang upload và xử lý ảnh…"
                    : frame
                      ? "Lưu thay đổi"
                      : "Tạo khung"}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
