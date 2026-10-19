"use client"

import { useRef, useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { MangaFormInput } from "./form-schema"

export function AlternativeTitlesField() {
  const form = useFormContext<MangaFormInput>()
  const titles = useWatch({ control: form.control, name: "alternativeTitles" })
  const initialCount = Math.max(1, form.getValues("alternativeTitles").length)
  const nextId = useRef(initialCount)
  const [rows, setRows] = useState(() =>
    Array.from({ length: initialCount }, (_, index) => index)
  )

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div
          className="flex rounded-md border bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
          key={row}
        >
          <Input
            {...form.register(`alternativeTitles.${index}`)}
            aria-label={`Tên khác ${index + 1}`}
            autoComplete="off"
            className="border-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            id={`alternative-title-${index}`}
            maxLength={255}
            placeholder="Nhập tên khác"
          />
          <Button
            aria-label={`Xóa tên khác ${index + 1}`}
            className="m-1 shrink-0"
            onClick={() => {
              setRows((current) => current.filter((id) => id !== row))
              form.setValue(
                "alternativeTitles",
                titles.filter((_, titleIndex) => titleIndex !== index),
                { shouldDirty: true }
              )
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
      ))}

      <Button
        className="border-dashed text-muted-foreground hover:text-foreground"
        disabled={rows.length >= 50}
        onClick={() => {
          setRows((current) => [...current, nextId.current++])
          form.setValue("alternativeTitles", [...titles, ""], {
            shouldDirty: true,
          })
        }}
        type="button"
        variant="outline"
      >
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        Thêm tên khác
      </Button>
    </div>
  )
}
