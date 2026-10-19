"use client"

import { CheckIcon } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import type { components } from "@/src/lib/generated/api"
import { Button } from "@workspace/ui/components/button"
import type { MangaFormInput } from "./form-schema"

type Tag = components["schemas"]["TagSummary"]

const groupLabels: Record<string, string> = {
  content: "Nội dung",
  format: "Định dạng",
  genre: "Thể loại",
  theme: "Chủ đề",
}

export function MangaTagsField({ tags }: { tags: Tag[] }) {
  const form = useFormContext<MangaFormInput>()
  const selected = useWatch({ control: form.control, name: "tagIds" })
  const groups = tags.reduce<Map<string, Tag[]>>((result, tag) => {
    const group = result.get(tag.group)
    if (group) group.push(tag)
    else result.set(tag.group, [tag])
    return result
  }, new Map())

  function toggle(id: string) {
    form.setValue(
      "tagIds",
      selected.includes(id)
        ? selected.filter((tagId) => tagId !== id)
        : selected.length < 50
          ? [...selected, id]
          : selected,
      { shouldDirty: true, shouldValidate: true }
    )
  }

  return (
    <fieldset className="flex flex-col gap-3">
      {/* <legend className="mb-3 text-base font-semibold">
        Thể loại
        {selected.length ? (
          <span className="ml-2 font-medium text-primary">
            Đã chọn {selected.length}
          </span>
        ) : null}
      </legend> */}
      {[...groups].map(([group, groupTags]) => (
        <div className="flex flex-col gap-2" key={group}>
          <h3 className="text-sm font-medium tracking-wide">
            {groupLabels[group] ?? group}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {groupTags.map((tag) => {
              const checked = selected.includes(tag.id)
              return (
                <Button
                  aria-pressed={checked}
                  disabled={selected.length >= 50 && !checked}
                  key={tag.id}
                  onClick={() => toggle(tag.id)}
                  size="sm"
                  type="button"
                  variant={checked ? "default" : "secondary"}
                >
                  {checked ? (
                    <CheckIcon aria-hidden="true" data-icon="inline-start" />
                  ) : null}
                  {tag.name}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </fieldset>
  )
}
