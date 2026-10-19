"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"

import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { MangaFormInput } from "./form-schema"

const statuses = [
  { value: "ongoing", label: "Đang tiến hành" },
  { value: "completed", label: "Hoàn thành" },
  { value: "hiatus", label: "Tạm ngưng" },
  { value: "cancelled", label: "Đã hủy" },
]

export function MangaStatusFields() {
  const form = useFormContext<MangaFormInput>()
  const status = useWatch({ control: form.control, name: "status" })
  const disableEnding = status === "ongoing" || status === "hiatus"

  return (
    <>
      <Controller
        control={form.control}
        name="status"
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 gap-2"
            data-invalid={fieldState.invalid || undefined}
          >
            <FieldLabel htmlFor="status">
              Trạng thái
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
              <span className="sr-only"> (bắt buộc)</span>
            </FieldLabel>
            <Select
              items={statuses}
              name={field.name}
              onValueChange={(value) => {
                if (!value) return
                field.onChange(value)
                if (value === "ongoing" || value === "hiatus") {
                  form.setValue("lastVolume", "")
                  form.setValue("lastChapter", "")
                }
              }}
              required
              value={field.value}
            >
              <SelectTrigger
                aria-invalid={fieldState.invalid}
                className="w-full"
                id="status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {statuses.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldState.error ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        )}
      />

      <Field
        className="min-w-0 gap-2"
        data-disabled={disableEnding || undefined}
      >
        <FieldLabel htmlFor="last-volume">Tập cuối (Volume)</FieldLabel>
        <Input
          {...form.register("lastVolume")}
          disabled={disableEnding}
          id="last-volume"
          maxLength={32}
          placeholder="Ví dụ: 12"
        />
      </Field>

      <Field
        className="min-w-0 gap-2"
        data-disabled={disableEnding || undefined}
      >
        <FieldLabel htmlFor="last-chapter">Chương cuối (Chapter)</FieldLabel>
        <Input
          {...form.register("lastChapter")}
          disabled={disableEnding}
          id="last-chapter"
          maxLength={32}
          placeholder="Ví dụ: 120"
        />
      </Field>
    </>
  )
}
