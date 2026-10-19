"use client"

import { type SubmitEvent, useState } from "react"
import { useDebouncedValue } from "@mantine/hooks"
import { useQuery } from "@tanstack/react-query"
import {
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { useQueryStates } from "nuqs"

import { MangaCard } from "@/components/manga-card"
import { MangaGrid } from "@/components/manga-grid"
import { PagePagination } from "@/components/page-pagination"
import {
  advancedSearchHref,
  advancedSearchOptions,
  advancedSearchParams,
  type AdvancedSearchState,
  defaultAdvancedSearchState,
  normalizeAdvancedSearch,
  peopleOptions,
} from "@/modules/manga/advanced-search"
import type { components } from "@/src/lib/generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"

type Tag = components["schemas"]["TagSummary"]
type Person = components["schemas"]["PersonSummary"]

const tagGroupLabels: Record<string, string> = {
  content: "Nội dung",
  format: "Định dạng",
  genre: "Thể loại",
  theme: "Chủ đề",
}

const statusItems = [
  { value: "", label: "Tất cả" },
  { value: "ongoing", label: "Đang phát hành" },
  { value: "completed", label: "Đã hoàn thành" },
  { value: "hiatus", label: "Tạm ngưng" },
  { value: "cancelled", label: "Đã hủy" },
] as const

const chapterItems = [
  { value: "true", label: "Có chương" },
  { value: "false", label: "Chưa có chương" },
] as const

const sortItems = [
  { value: "latestChapter", label: "Chương mới nhất" },
  { value: "publishedAt", label: "Ngày đăng" },
  { value: "title", label: "Tên truyện" },
  { value: "year", label: "Năm phát hành" },
] as const

const directionItems = [
  { value: "desc", label: "Giảm dần" },
  { value: "asc", label: "Tăng dần" },
] as const

function SelectField({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string
  items: ReadonlyArray<{ value: string; label: string }>
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium uppercase">
      {label}
      <Select
        items={items}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onValueChange(nextValue)
        }}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  )
}

function PersonPicker({
  apiBaseUrl,
  label,
  onChange,
  role,
  value,
}: {
  apiBaseUrl: string
  label: string
  onChange: (value: string[]) => void
  role: "author" | "artist"
  value: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery] = useDebouncedValue(query.trim(), 300)
  const selected = useQuery(
    peopleOptions(apiBaseUrl, role, "", value, value.length > 0)
  )
  const results = useQuery(
    peopleOptions(apiBaseUrl, role, debouncedQuery, [], open)
  )
  const peopleById = new Map(
    [...(results.data?.data ?? []), ...(selected.data?.data ?? [])].map(
      (person) => [person.id, person]
    )
  )

  function toggle(person: Person) {
    onChange(
      value.includes(person.id)
        ? value.filter((id) => id !== person.id)
        : [...value, person.id]
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium uppercase">{label}</span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button className="w-full justify-between" variant="outline" />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">
              {value.length > 0
                ? `Đã chọn ${value.length}`
                : `Chọn ${label.toLocaleLowerCase("vi")}`}
            </span>
          </span>
          <ChevronDownIcon aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) gap-2 p-2">
          <Input
            aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
            autoComplete="off"
            maxLength={160}
            placeholder={`Tìm ${label.toLocaleLowerCase("vi")}...`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="max-h-64 overflow-y-auto">
            {results.isPending || results.isFetching ? (
              <div className="flex min-h-20 items-center justify-center">
                <Spinner
                  aria-label={`Đang tìm ${label.toLocaleLowerCase("vi")}`}
                />
              </div>
            ) : results.isError ? (
              <p className="p-3 text-center text-sm text-destructive">
                Không thể tải danh sách.
              </p>
            ) : results.data?.data.length ? (
              <ul className="flex flex-col gap-1">
                {results.data.data.map((person) => {
                  const checked = value.includes(person.id)
                  return (
                    <li key={person.id}>
                      <button
                        className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                        type="button"
                        onClick={() => toggle(person)}
                      >
                        <span className="truncate">{person.name}</span>
                        {checked ? (
                          <CheckIcon
                            aria-hidden="true"
                            className="size-4 shrink-0"
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="p-3 text-center text-sm text-muted-foreground">
                Không tìm thấy kết quả.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge className="h-7 gap-1" key={id} variant="secondary">
              <span className="max-w-40 truncate">
                {peopleById.get(id)?.name ?? "Đang tải…"}
              </span>
              <button
                aria-label={`Bỏ ${peopleById.get(id)?.name ?? "lựa chọn"}`}
                className="rounded-full outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                onClick={() => onChange(value.filter((item) => item !== id))}
              >
                <XIcon aria-hidden="true" className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TagMode({
  label,
  mode,
  onChange,
  tone,
}: {
  label: string
  mode: "and" | "or"
  onChange: (value: "and" | "or") => void
  tone: "include" | "exclude"
}) {
  const options =
    tone === "include"
      ? ([
          { value: "and", label: "Tất cả (AND)" },
          { value: "or", label: "Ít nhất một (OR)" },
        ] as const)
      : ([
          { value: "or", label: "Bất kỳ (OR)" },
          { value: "and", label: "Tất cả (AND)" },
        ] as const)

  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <legend className="float-left mr-1 text-sm font-medium uppercase">
        {label}:
      </legend>
      {options.map((option) => (
        <label
          className="flex cursor-pointer items-center gap-1.5 text-sm"
          key={option.value}
        >
          <input
            checked={mode === option.value}
            className={
              tone === "include" ? "accent-primary" : "accent-destructive"
            }
            name={`${tone}TagMode`}
            type="radio"
            value={option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}

export function AdvancedSearch({
  apiBaseUrl,
  tags,
}: {
  apiBaseUrl: string
  tags: Tag[]
}) {
  const [filters, setFilters] = useQueryStates(advancedSearchParams, {
    history: "push",
  })
  const committedKey = JSON.stringify(filters)
  const [draftState, setDraftState] = useState({
    source: committedKey,
    value: filters as AdvancedSearchState,
  })
  if (draftState.source !== committedKey) {
    setDraftState({
      source: committedKey,
      value: filters as AdvancedSearchState,
    })
  }
  const draft = draftState.value
  const setDraft = (next: AdvancedSearchState) =>
    setDraftState({ source: committedKey, value: next })
  const result = useQuery(
    advancedSearchOptions(apiBaseUrl, filters as AdvancedSearchState)
  )
  const tagGroups = tags.reduce<Map<string, Tag[]>>((groups, tag) => {
    const group = groups.get(tag.group)
    if (group) group.push(tag)
    else groups.set(tag.group, [tag])
    return groups
  }, new Map())

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void setFilters({ ...normalizeAdvancedSearch(draft), page: 1 })
  }

  function reset() {
    setDraft(defaultAdvancedSearchState)
    void setFilters(defaultAdvancedSearchState)
  }

  function toggleTag(id: string) {
    const includeTag = draft.includeTag.filter((tagId) => tagId !== id)
    const excludeTag = draft.excludeTag.filter((tagId) => tagId !== id)
    if (draft.includeTag.includes(id)) excludeTag.push(id)
    else if (!draft.excludeTag.includes(id)) includeTag.push(id)
    setDraft({ ...draft, includeTag, excludeTag })
  }

  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Tìm kiếm nâng cao</h1>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex gap-2">
          <Input
            aria-label="Tên hoặc tên khác của truyện"
            autoComplete="off"
            maxLength={160}
            name="q"
            placeholder="Tìm theo tên hoặc tên khác..."
            type="search"
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
          <Button type="submit">
            <SearchIcon aria-hidden="true" data-icon="inline-start" />
            <span className="hidden sm:inline">Tìm kiếm</span>
          </Button>
        </div>

        <Collapsible defaultOpen>
          <CollapsibleTrigger
            render={<Button type="button" variant="secondary" />}
          >
            <FilterIcon aria-hidden="true" data-icon="inline-start" />
            Bộ lọc
            <ChevronDownIcon
              aria-hidden="true"
              className="transition-transform group-aria-expanded/button:rotate-180"
              data-icon="inline-end"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="flex flex-col gap-6 rounded-lg border bg-card p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SelectField
                  label="Trạng thái"
                  items={statusItems}
                  value={draft.status}
                  onValueChange={(status) =>
                    setDraft({
                      ...draft,
                      status: status as AdvancedSearchState["status"],
                    })
                  }
                />
                <SelectField
                  label="Chương"
                  items={chapterItems}
                  value={draft.hasChapter}
                  onValueChange={(hasChapter) =>
                    setDraft({
                      ...draft,
                      hasChapter:
                        hasChapter as AdvancedSearchState["hasChapter"],
                    })
                  }
                />
                <SelectField
                  label="Sắp xếp theo"
                  items={sortItems}
                  value={draft.sort}
                  onValueChange={(sort) =>
                    setDraft({
                      ...draft,
                      sort: sort as AdvancedSearchState["sort"],
                    })
                  }
                />
                <SelectField
                  label="Thứ tự"
                  items={directionItems}
                  value={draft.direction}
                  onValueChange={(direction) =>
                    setDraft({
                      ...draft,
                      direction: direction as AdvancedSearchState["direction"],
                    })
                  }
                />
                <PersonPicker
                  apiBaseUrl={apiBaseUrl}
                  label="Tác giả"
                  role="author"
                  value={draft.author}
                  onChange={(author) => setDraft({ ...draft, author })}
                />
                <PersonPicker
                  apiBaseUrl={apiBaseUrl}
                  label="Họa sĩ"
                  role="artist"
                  value={draft.artist}
                  onChange={(artist) => setDraft({ ...draft, artist })}
                />
              </div>

              <section
                className="flex flex-col gap-3"
                aria-labelledby="tag-filter-heading"
              >
                <h2
                  className="text-base font-semibold uppercase"
                  id="tag-filter-heading"
                >
                  Thể loại
                  {draft.includeTag.length > 0 && (
                    <span className="ml-2 font-medium text-primary">
                      + {draft.includeTag.length}
                    </span>
                  )}
                  {draft.excludeTag.length > 0 && (
                    <span className="ml-2 font-medium text-destructive">
                      - {draft.excludeTag.length}
                    </span>
                  )}
                </h2>
                {[...tagGroups].map(([group, groupTags]) => (
                  <div className="flex flex-col gap-2" key={group}>
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {tagGroupLabels[group] ?? group}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {groupTags.map((tag) => {
                        const included = draft.includeTag.includes(tag.id)
                        const excluded = draft.excludeTag.includes(tag.id)
                        return (
                          <Button
                            aria-label={`${tag.name}: ${included ? "bao gồm" : excluded ? "loại trừ" : "không lọc"}`}
                            key={tag.id}
                            size="xs"
                            type="button"
                            variant={
                              included
                                ? "default"
                                : excluded
                                  ? "destructive"
                                  : "secondary"
                            }
                            onClick={() => toggleTag(tag.id)}
                          >
                            {included ? "+ " : excluded ? "− " : ""}
                            {tag.name}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </section>

              <div className="flex flex-col gap-3 lg:flex-row lg:gap-8">
                <TagMode
                  label="Bao gồm"
                  mode={draft.includeTagMode}
                  tone="include"
                  onChange={(includeTagMode) =>
                    setDraft({ ...draft, includeTagMode })
                  }
                />
                <TagMode
                  label="Loại trừ"
                  mode={draft.excludeTagMode}
                  tone="exclude"
                  onChange={(excludeTagMode) =>
                    setDraft({ ...draft, excludeTagMode })
                  }
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
                  Đặt lại
                </Button>
                <Button type="submit">
                  <SearchIcon aria-hidden="true" data-icon="inline-start" />
                  Tìm kiếm
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>

      <div className="flex min-h-48 flex-col gap-5" aria-live="polite">
        {result.isPending ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner aria-label="Đang tìm truyện" />
          </div>
        ) : result.isError ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Chưa tải được kết quả</EmptyTitle>
              <EmptyDescription>{result.error.message}</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => void result.refetch()}>
              Thử lại
            </Button>
          </Empty>
        ) : result.data.data.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Không tìm thấy truyện</EmptyTitle>
              <EmptyDescription>
                Thử thay đổi từ khóa hoặc bộ lọc.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {result.data.meta.total.toLocaleString("vi-VN")} kết quả
              {result.isFetching ? " · Đang cập nhật…" : ""}
            </p>
            <MangaGrid
              className="2xl:[--manga-columns:6]"
              hideIncompleteRow={false}
            >
              {result.data.data.map((manga) => (
                <MangaCard key={manga.id} manga={manga} />
              ))}
            </MangaGrid>
            <PagePagination
              ariaLabel="Phân trang tìm kiếm nâng cao"
              currentPage={filters.page}
              getPageHref={(page) =>
                advancedSearchHref(filters as AdvancedSearchState, page)
              }
              totalPages={result.data.meta.totalPages}
            />
          </>
        )}
      </div>
    </section>
  )
}
