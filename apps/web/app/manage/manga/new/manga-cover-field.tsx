"use client"

import { useRef, useState } from "react"
import { ImageIcon, UploadIcon } from "lucide-react"
import { useFormContext } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import type { MangaFormInput } from "./form-schema"

type CoverUpload = { id: string; previewUrl: string }

export function MangaCoverField({
  cancelUpload,
  initialPreview,
  onUploadingChange,
  upload,
}: {
  cancelUpload: (sessionId: string) => Promise<void>
  initialPreview?: string
  onUploadingChange: (uploading: boolean) => void
  upload: (file: File) => Promise<CoverUpload>
}) {
  const form = useFormContext<MangaFormInput>()
  const fileInput = useRef<HTMLInputElement>(null)
  const objectUrl = useRef<string>(null)
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function selectCover(file: File) {
    form.clearErrors("cover")
    form.setValue("cover", file, { shouldDirty: true, shouldValidate: true })
    if (!(await form.trigger("cover"))) return

    setUploading(true)
    onUploadingChange(true)
    try {
      const previous = form.getValues("coverUploadId")
      if (previous) {
        await cancelUpload(previous)
        form.setValue("coverUploadId", null, { shouldDirty: true })
      }
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = URL.createObjectURL(file)
      setPreview(objectUrl.current)
      setFileName(file.name)

      const staged = await upload(file)
      form.setValue("coverUploadId", staged.id, {
        shouldDirty: true,
        shouldValidate: true,
      })
      URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
      setPreview(staged.previewUrl)
    } catch (error) {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
      setPreview(initialPreview ?? null)
      setFileName(null)
      form.setValue("cover", null, { shouldDirty: true })
      form.setValue("coverUploadId", null, { shouldDirty: true })
      form.setError("cover", {
        type: "server",
        message:
          error instanceof Error
            ? error.message
            : "Không thể tải ảnh bìa lên máy chủ.",
      })
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  return (
    <div className="grid items-start gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <label className="group relative aspect-[7/10] w-44 cursor-pointer overflow-hidden rounded-lg border border-dashed bg-muted/40 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- Preview may be a local object URL or private signed URL.
          <img
            alt="Ảnh bìa đã chọn"
            className="size-full object-cover"
            src={preview}
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <ImageIcon aria-hidden="true" className="size-8" />
            Chọn ảnh bìa
          </span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Spinner aria-label="Đang tải ảnh bìa" className="size-7" />
          </span>
        ) : null}
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label={preview ? "Đổi ảnh bìa" : "Chọn ảnh bìa"}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          disabled={uploading}
          id="cover-file"
          name="cover"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void selectCover(file)
          }}
          ref={fileInput}
          type="file"
        />
      </label>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          className="w-fit"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          type="button"
          variant="outline"
        >
          {uploading ? (
            <Spinner aria-hidden="true" data-icon="inline-start" />
          ) : (
            <UploadIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {uploading ? "Đang tải ảnh…" : "Chọn ảnh"}
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hỗ trợ JPEG, PNG hoặc WebP, dung lượng tối đa 5MB.
        </p>
        {fileName ? (
          <p className="truncate text-xs font-medium">{fileName}</p>
        ) : null}
        {form.formState.errors.cover ? (
          <FieldError errors={[form.formState.errors.cover]} />
        ) : null}
      </div>
    </div>
  )
}
