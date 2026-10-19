"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImageUpIcon, Trash2Icon } from "lucide-react"

import type { components } from "@/src/lib/generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

type Group = components["schemas"]["GroupManagement"]
type MediaKind = "avatar" | "banner"
type MediaErrors = Partial<Record<MediaKind, string>>

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"])
const maxBytes = 5 * 1024 * 1024

export function validateGroupMediaFile(
  file: Pick<File, "size" | "type">
): string | null {
  if (!allowedTypes.has(file.type)) return "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP."
  if (file.size > maxBytes) return "Ảnh vượt quá dung lượng tối đa 5 MiB."
  return null
}

async function mutateGroupMedia(
  apiBaseUrl: string,
  groupId: string,
  kind: MediaKind,
  file: File | null
) {
  const body = file ? new FormData() : undefined
  if (file) body!.set("image", file)
  const response = await fetch(
    new URL(`/v1/contribution/groups/${groupId}/${kind}`, apiBaseUrl),
    {
      method: file ? "POST" : "DELETE",
      body,
      cache: "no-store",
      credentials: "include",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(file ? 30_000 : 8_000),
    }
  )
  const result = (await response.json().catch(() => null)) as {
    data?: Group
    error?: { message?: string }
  } | null
  if (!response.ok || !result?.data)
    throw new Error(
      {
        400: "Tệp ảnh không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.",
        401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        403: "Bạn không có quyền cập nhật ảnh của nhóm này.",
        404: "Không tìm thấy nhóm dịch.",
        409: "Nhóm hiện không thể cập nhật ảnh.",
        413: "Ảnh vượt quá dung lượng tối đa 5 MiB.",
        429: "Máy chủ đang xử lý nhiều ảnh. Vui lòng thử lại sau.",
        503: "Chưa thể lưu ảnh. Vui lòng thử lại sau.",
      }[response.status] ??
        result?.error?.message ??
        "Không thể cập nhật ảnh nhóm. Vui lòng thử lại."
    )
  return result.data
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  )
}

export function GroupMediaFields({
  apiBaseUrl,
  disabled,
  group,
  onPendingChange,
}: {
  apiBaseUrl: string
  disabled: boolean
  group: Group
  onPendingChange: (pending: boolean) => void
}) {
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState(group)
  const [errors, setErrors] = useState<MediaErrors>({})
  const media = useMutation({
    retry: false,
    mutationFn: ({ file, kind }: { file: File | null; kind: MediaKind }) =>
      mutateGroupMedia(apiBaseUrl, group.id, kind, file),
    onMutate: ({ kind }) => {
      onPendingChange(true)
      setErrors((value) => ({ ...value, [kind]: undefined }))
    },
    onSuccess: async (updated, { file, kind }) => {
      setCurrent(updated)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", apiBaseUrl] }),
        queryClient.invalidateQueries({
          queryKey: ["public-groups", apiBaseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["groups", "ranking", apiBaseUrl],
        }),
      ])
      toast.add({
        type: "success",
        title: `${file ? "Đã cập nhật" : "Đã xóa"} ${kind === "avatar" ? "avatar" : "banner"} nhóm`,
      })
    },
    onError: (error, { kind }) => {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể cập nhật ảnh nhóm. Vui lòng thử lại."
      setErrors((value) => ({ ...value, [kind]: message }))
      toast.add({ type: "error", title: message })
    },
    onSettled: () => onPendingChange(false),
  })

  function select(kind: MediaKind, file: File) {
    const error = validateGroupMediaFile(file)
    if (error) {
      setErrors((value) => ({ ...value, [kind]: error }))
      return
    }
    media.mutate({ file, kind })
  }

  const pendingKind = media.isPending ? media.variables?.kind : undefined
  const busy = disabled || media.isPending

  return (
    <div className="flex flex-col gap-5 border-t pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
      <Field data-invalid={Boolean(errors.avatar)}>
        <FieldLabel>Avatar nhóm</FieldLabel>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-20 rounded-md after:rounded-md">
            <AvatarImage
              alt=""
              className="rounded-md"
              referrerPolicy="no-referrer"
              src={current.avatarUrl ?? undefined}
            />
            <AvatarFallback className="rounded-md font-semibold">
              {initials(current.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="Chọn avatar nhóm"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) select("avatar", file)
              }}
              ref={avatarInput}
              type="file"
            />
            <Button
              disabled={busy}
              onClick={() => avatarInput.current?.click()}
              type="button"
              variant="outline"
            >
              {pendingKind === "avatar" ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <ImageUpIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {current.avatarUrl ? "Thay ảnh" : "Chọn ảnh"}
            </Button>
            {current.avatarUrl ? (
              <Button
                disabled={busy}
                onClick={() => media.mutate({ file: null, kind: "avatar" })}
                type="button"
                variant="destructive"
              >
                <Trash2Icon aria-hidden="true" data-icon="inline-start" />
                Xóa ảnh
              </Button>
            ) : null}
          </div>
        </div>
        <FieldDescription>
          JPEG, PNG hoặc WebP; tối đa 5 MiB. Ưu tiên tỷ lệ 256x256
        </FieldDescription>
        <FieldError>{errors.avatar}</FieldError>
      </Field>

      <Field data-invalid={Boolean(errors.banner)}>
        <FieldLabel>Banner nhóm</FieldLabel>
        <div className="flex aspect-3/1 w-full items-center justify-center overflow-hidden rounded-md border bg-muted text-sm text-muted-foreground">
          {current.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Public immutable CDN asset can change immediately after upload.
            <img
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              src={current.bannerUrl}
            />
          ) : (
            "Chưa có banner"
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Chọn banner nhóm"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) select("banner", file)
            }}
            ref={bannerInput}
            type="file"
          />
          <Button
            disabled={busy}
            onClick={() => bannerInput.current?.click()}
            type="button"
            variant="outline"
          >
            {pendingKind === "banner" ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : (
              <ImageUpIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {current.bannerUrl ? "Thay ảnh" : "Chọn ảnh"}
          </Button>
          {current.bannerUrl ? (
            <Button
              disabled={busy}
              onClick={() => media.mutate({ file: null, kind: "banner" })}
              type="button"
              variant="destructive"
            >
              <Trash2Icon aria-hidden="true" data-icon="inline-start" />
              Xóa ảnh
            </Button>
          ) : null}
        </div>
        <FieldDescription>
          JPEG, PNG hoặc WebP; tối đa 5 MiB. Ưu tiên tỷ lệ 1500x500
        </FieldDescription>
        <FieldError>{errors.banner}</FieldError>
      </Field>
    </div>
  )
}
