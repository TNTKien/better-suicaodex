"use client"

import { useRef, useState } from "react"
import {
  CaseSensitiveIcon,
  GlobeIcon,
  LanguagesIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useFormContext } from "react-hook-form"

import { generateFaviconUrl } from "@/lib/catalog"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { MangaFormInput } from "./form-schema"

const linkGroups = [
  {
    title: "Tracking Sites",
    addLabel: "Thêm Tracking Site",
    options: [
      { value: "al", label: "AniList", site: "https://anilist.co" },
      {
        value: "ap",
        label: "Anime-Planet",
        site: "https://www.anime-planet.com",
      },
      { value: "kt", label: "Kitsu", site: "https://kitsu.io" },
      {
        value: "mal",
        label: "MyAnimeList",
        site: "https://myanimelist.net",
      },
      {
        value: "mu",
        label: "MangaUpdates",
        site: "https://www.mangaupdates.com",
      },
    ],
  },
  {
    title: "Official Sites",
    addLabel: "Thêm Official Site",
    options: [
      { value: "raw", label: "Raw", site: null, icon: LanguagesIcon },
      {
        value: "engtl",
        label: "Eng",
        site: null,
        icon: CaseSensitiveIcon,
      },
    ],
  },
  {
    title: "Retail Sites",
    addLabel: "Thêm Retail Site",
    options: [
      { value: "amz", label: "Amazon", site: "https://www.amazon.co.jp" },
      { value: "bw", label: "BookWalker", site: "https://bookwalker.jp" },
      { value: "cdj", label: "CDJapan", site: "https://www.cdjapan.co.jp" },
      {
        value: "ebj",
        label: "ebookjapan",
        site: "https://ebookjapan.yahoo.co.jp",
      },
    ],
  },
]

type LinkKey = keyof MangaFormInput["links"]
type LinkRow = { id: number; type: LinkKey | null; url: string }

function Favicon({
  icon: Icon = GlobeIcon,
  site,
}: {
  icon?: typeof GlobeIcon
  site: string | null
}) {
  return site ? (
    // eslint-disable-next-line @next/next/no-img-element -- Tiny remote favicon does not need image optimization.
    <img
      alt=""
      aria-hidden="true"
      className="size-4 rounded-md"
      height={16}
      src={generateFaviconUrl(site, 16)}
      width={16}
    />
  ) : (
    <Icon aria-hidden="true" />
  )
}

function LinkGroup({ addLabel, options, title }: (typeof linkGroups)[number]) {
  const form = useFormContext<MangaFormInput>()
  const initialRows: LinkRow[] = options.flatMap((option, index) => {
    const url = form.getValues(`links.${option.value as LinkKey}`)
    return url ? [{ id: index, type: option.value as LinkKey, url }] : []
  })
  if (!initialRows.length) initialRows.push({ id: 0, type: null, url: "" })
  const nextId = useRef(options.length)
  const [rows, setRows] = useState<LinkRow[]>(initialRows)
  const selectedTypes = new Set(rows.flatMap((row) => row.type ?? []))

  function updateRows(next: LinkRow[]) {
    const groupTypes = new Set(options.map(({ value }) => value))
    const otherLinks = Object.entries(form.getValues("links")).filter(
      ([type]) => !groupTypes.has(type)
    )
    setRows(next)
    form.setValue(
      "links",
      Object.fromEntries(
        otherLinks.concat(
          next.flatMap((row) =>
            row.type && row.url.trim() ? [[row.type, row.url]] : []
          )
        )
      ),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-heading font-semibold">{title}</h3>

      {rows.map((row, index) => (
        <InputGroup className="h-10 bg-muted/20" key={row.id}>
          <InputGroupAddon align="inline-start">
            <Select
              items={options}
              onValueChange={(value) =>
                updateRows(
                  rows.map((item) =>
                    item.id === row.id
                      ? { ...item, type: value as LinkKey }
                      : item
                  )
                )
              }
              value={row.type}
            >
              <SelectTrigger
                aria-label={`Loại liên kết ${title} ${index + 1}`}
                className="h-full rounded-r-none border-0 border-r bg-transparent! shadow-none"
              >
                <SelectValue>
                  {(value: string | null) => {
                    const option = options.find((item) => item.value === value)
                    return option ? (
                      <Favicon
                        icon={"icon" in option ? option.icon : undefined}
                        site={option.site}
                      />
                    ) : (
                      <GlobeIcon aria-hidden="true" />
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="min-w-44"
              >
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem
                      disabled={
                        selectedTypes.has(option.value as LinkKey) &&
                        row.type !== option.value
                      }
                      key={option.value}
                      value={option.value}
                    >
                      <Favicon
                        icon={"icon" in option ? option.icon : undefined}
                        site={option.site}
                      />
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </InputGroupAddon>

          <InputGroupInput
            aria-label={`URL ${title} ${index + 1}`}
            autoComplete="off"
            disabled={!row.type}
            maxLength={500}
            onChange={(event) =>
              updateRows(
                rows.map((item) =>
                  item.id === row.id
                    ? { ...item, url: event.target.value }
                    : item
                )
              )
            }
            placeholder={row.type ? "Dán URL đầy đủ" : "Chọn loại liên kết"}
            required={Boolean(row.type)}
            type="url"
            value={row.url}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={`Xóa liên kết ${title} ${index + 1}`}
              onClick={() =>
                updateRows(rows.filter((item) => item.id !== row.id))
              }
              size="icon-sm"
              type="button"
            >
              <Trash2Icon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ))}

      <Button
        className="border-dashed text-muted-foreground hover:text-foreground"
        disabled={rows.length >= options.length}
        onClick={() =>
          updateRows([...rows, { id: nextId.current++, type: null, url: "" }])
        }
        type="button"
        variant="outline"
      >
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        {addLabel}
      </Button>
    </section>
  )
}

export function MangaLinksField() {
  return (
    <div className="flex flex-col gap-6">
      {linkGroups.map((group) => (
        <LinkGroup key={group.title} {...group} />
      ))}
    </div>
  )
}
