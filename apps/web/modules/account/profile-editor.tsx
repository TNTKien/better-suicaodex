"use client"

import { type SubmitEvent, useRef, useState } from "react"
import { ImageUpIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@workspace/ui/components/textarea"

import {
  AccountApiError,
  removeOwnAvatar,
  replaceOwnAvatar,
  updateOwnProfile,
} from "./api"
import { ProfileAvatar } from "./profile"
import { useAccount } from "./provider"

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"])
const maxAvatarBytes = 5 * 1024 * 1024

type FieldErrors = Partial<Record<"avatar" | "bio" | "name", string>>

class ProfileFieldError extends Error {
  constructor(
    readonly field: "bio" | "name",
    message: string
  ) {
    super(message)
  }
}

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizedBio(value: string) {
  return value.trim() || null
}

export function ProfileEditor() {
  const { account, apiBaseUrl, client, refreshAccount } = useAccount()
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarOverride, setAvatarOverride] = useState<
    string | null | undefined
  >()
  const [errors, setErrors] = useState<FieldErrors>({})

  const save = useMutation({
    networkMode: "always",
    mutationFn: async (input: { bio: string | null; name: string }) => {
      let nameUpdated = false
      if (input.name !== account?.user.name) {
        const result = await client.updateUser({ name: input.name })
        if (result.error)
          throw new ProfileFieldError(
            "name",
            "Không thể cập nhật tên hiển thị. Vui lòng thử lại."
          )
        nameUpdated = true
      }
      if (input.bio !== account?.profile.bio) {
        try {
          await updateOwnProfile(apiBaseUrl, { bio: input.bio })
        } catch {
          throw new ProfileFieldError(
            "bio",
            nameUpdated
              ? "Tên đã được lưu, nhưng chưa thể cập nhật giới thiệu."
              : "Không thể cập nhật giới thiệu. Vui lòng thử lại."
          )
        }
      }
    },
    onSuccess: async () => {
      await refreshAccount()
      toast.add({ type: "success", title: "Đã cập nhật hồ sơ" })
      setOpen(false)
    },
    onError: async (error) => {
      await refreshAccount()
      const field = error instanceof ProfileFieldError ? error.field : "name"
      const message =
        error instanceof Error
          ? error.message
          : "Không thể cập nhật hồ sơ. Vui lòng thử lại."
      setErrors((current) => ({ ...current, [field]: message }))
      toast.add({ type: "error", title: message })
    },
  })

  const avatar = useMutation({
    networkMode: "always",
    mutationFn: (file: File | null) =>
      file ? replaceOwnAvatar(apiBaseUrl, file) : removeOwnAvatar(apiBaseUrl),
    onSuccess: async (updated) => {
      setAvatarOverride(updated.user.image)
      await refreshAccount()
      toast.add({
        type: "success",
        title: updated.user.image ? "Đã cập nhật avatar" : "Đã xóa avatar",
      })
    },
    onError: (error) => {
      const message =
        error instanceof AccountApiError
          ? error.message
          : "Không thể cập nhật avatar. Vui lòng thử lại."
      setErrors((current) => ({ ...current, avatar: message }))
      toast.add({ type: "error", title: message })
    },
  })

  if (!account || account.profile.status !== "active") return null

  const avatarImage =
    avatarOverride === undefined ? account.user.image : avatarOverride

  function changeOpen(next: boolean) {
    if (!next && pending) return
    setOpen(next)
    if (!next) return
    setName(account!.user.name)
    setBio(account!.profile.bio ?? "")
    setAvatarOverride(undefined)
    setErrors({})
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = normalizedName(name)
    const nextBio = normalizedBio(bio)
    const nextErrors: FieldErrors = {}
    if (!nextName || nextName.length > 80)
      nextErrors.name = "Tên hiển thị phải có từ 1 đến 80 ký tự."
    if (bio.length > 2_000)
      nextErrors.bio = "Giới thiệu không được vượt quá 2.000 ký tự."
    setErrors((current) => ({ avatar: current.avatar, ...nextErrors }))
    if (Object.keys(nextErrors).length) return
    if (nextName === account!.user.name && nextBio === account!.profile.bio) {
      setOpen(false)
      return
    }
    save.mutate({ name: nextName, bio: nextBio })
  }

  function selectAvatar(file: File) {
    if (!allowedAvatarTypes.has(file.type)) {
      setErrors((current) => ({
        ...current,
        avatar: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.",
      }))
      return
    }
    if (file.size > maxAvatarBytes) {
      setErrors((current) => ({
        ...current,
        avatar: "Ảnh vượt quá dung lượng tối đa 5 MiB.",
      }))
      return
    }
    setErrors((current) => ({ ...current, avatar: undefined }))
    avatar.mutate(file)
  }

  const pending = save.isPending || avatar.isPending

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PencilIcon aria-hidden="true" data-icon="inline-start" />
        Chỉnh sửa hồ sơ
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin hiển thị trên trang cá nhân và bình luận của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid items-start gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
          <ProfileAvatar
            avatarFrame={account.user.avatarFrame}
            shape="circle"
            className="size-28"
            image={avatarImage}
            name={name || account.user.name}
          />
          <Field data-invalid={Boolean(errors.avatar)}>
            <FieldLabel>Avatar</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Chọn avatar"
                className="hidden"
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) selectAvatar(file)
                }}
                ref={fileInput}
                type="file"
              />
              <Button
                disabled={pending}
                onClick={() => fileInput.current?.click()}
                type="button"
                variant="outline"
              >
                {avatar.isPending ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <ImageUpIcon aria-hidden="true" data-icon="inline-start" />
                )}
                {avatarImage ? "Thay ảnh" : "Chọn ảnh"}
              </Button>
              {avatarImage ? (
                <Button
                  disabled={pending}
                  onClick={() => avatar.mutate(null)}
                  type="button"
                  variant="destructive"
                >
                  <Trash2Icon aria-hidden="true" data-icon="inline-start" />
                  Xóa ảnh
                </Button>
              ) : null}
            </div>
            <FieldDescription>
              JPEG, PNG hoặc WebP; tối đa 5 MiB. Ảnh sẽ được cắt vuông.
            </FieldDescription>
            <FieldError>{errors.avatar}</FieldError>
          </Field>
        </div>

        <form className="flex flex-col gap-6" onSubmit={submit}>
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="profile-display-name">
                Tên hiển thị
              </FieldLabel>
              <Input
                aria-invalid={Boolean(errors.name)}
                autoComplete="name"
                disabled={save.isPending}
                id="profile-display-name"
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value)
                  setErrors((current) => ({ ...current, name: undefined }))
                }}
                required
                value={name}
              />
              <FieldDescription>Tối đa 80 ký tự.</FieldDescription>
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.bio)}>
              <FieldLabel htmlFor="profile-bio">Giới thiệu</FieldLabel>
              <Textarea
                aria-invalid={Boolean(errors.bio)}
                disabled={save.isPending}
                id="profile-bio"
                maxLength={2_000}
                onChange={(event) => {
                  setBio(event.target.value)
                  setErrors((current) => ({ ...current, bio: undefined }))
                }}
                placeholder="Giới thiệu ngắn về bạn"
                rows={5}
                value={bio}
              />
              <FieldDescription>{bio.length}/2.000 ký tự</FieldDescription>
              <FieldError>{errors.bio}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              disabled={pending}
              render={<Button variant="outline" />}
            >
              Hủy
            </DialogClose>
            <Button disabled={pending} type="submit">
              {save.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {save.isPending ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
