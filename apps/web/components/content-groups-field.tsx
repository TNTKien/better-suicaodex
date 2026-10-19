"use client"

import { useRef, useState } from "react"
import { useDebouncedValue } from "@mantine/hooks"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon, XIcon } from "lucide-react"

import type { components } from "@/src/lib/generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Popover, PopoverContent } from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"

export type ContentGroup = {
  id: string
  name: string
  slug: string
}

type GroupList = components["schemas"]["TranslationGroupList"]
type GroupSummary = components["schemas"]["TranslationGroupSummary"]

async function loadGroups(
  apiBaseUrl: string,
  query: string,
  signal: AbortSignal
) {
  const url = new URL("/v1/groups", apiBaseUrl)
  url.searchParams.set("limit", "20")
  if (query) url.searchParams.set("q", query)
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  })
  if (!response.ok) throw new Error("Không thể tải danh sách nhóm dịch.")
  return (await response.json()) as GroupList
}

export function GroupSearchPicker({
  allowSystem = false,
  apiBaseUrl,
  disabled = false,
  excludedIds,
  label = "Tìm theo tên nhóm...",
  onSelect,
}: {
  allowSystem?: boolean
  apiBaseUrl: string
  disabled?: boolean
  excludedIds: string[]
  label?: string
  onSelect: (group: GroupSummary) => void
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery] = useDebouncedValue(query.trim(), 300)
  const groups = useQuery({
    queryKey: ["public-groups", apiBaseUrl, "content-picker", debouncedQuery],
    enabled: open && !disabled && debouncedQuery.length > 0,
    queryFn: ({ signal }) => loadGroups(apiBaseUrl, debouncedQuery, signal),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const excluded = new Set(excludedIds)
  const term = query.trim()
  const waiting = term.length > 0 && term !== debouncedQuery
  const results =
    groups.data?.data.filter(
      (group) =>
        !group.inactive &&
        (allowSystem || group.slug !== "system") &&
        !excluded.has(group.id)
    ) ?? []

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div className="w-full sm:max-w-md">
        <InputGroup ref={anchorRef}>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-controls="group-search-results"
            aria-expanded={open}
            aria-label="Tìm nhóm dịch"
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value
              setQuery(value)
              setOpen(value.trim().length > 0)
            }}
            onFocus={() => setOpen(term.length > 0)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
            }}
            placeholder={label}
            type="search"
            value={query}
          />
        </InputGroup>
      </div>
      {open && term ? (
        <PopoverContent
          align="start"
          anchor={anchorRef}
          className="max-h-[min(18rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) gap-0 overflow-y-auto p-2"
          id="group-search-results"
          initialFocus={false}
        >
          {waiting || groups.isPending || groups.isFetching ? (
            <div className="flex min-h-16 items-center justify-center">
              <Spinner aria-label="Đang tìm nhóm dịch" />
            </div>
          ) : groups.isError ? (
            <p className="p-3 text-center text-sm text-destructive">
              Không thể tải danh sách nhóm.
            </p>
          ) : results.length ? (
            results.map((group) => (
              <button
                className="flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                key={group.id}
                onClick={() => {
                  onSelect(group)
                  setOpen(false)
                  setQuery("")
                }}
                type="button"
              >
                <span className="font-medium">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  /{group.slug}
                </span>
              </button>
            ))
          ) : (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Không tìm thấy nhóm phù hợp.
            </p>
          )}
        </PopoverContent>
      ) : null}
    </Popover>
  )
}

export function ContentGroupsField({
  apiBaseUrl,
  description,
  disabled = false,
  editable,
  groups,
  onChange,
  onRemove,
  ownerGroup,
  removingId,
  selectedIds,
}: {
  apiBaseUrl: string
  description: string
  disabled?: boolean
  editable: boolean
  groups: ContentGroup[]
  onChange: (ids: string[]) => void
  onRemove?: (group: ContentGroup) => void
  ownerGroup: ContentGroup
  removingId?: string | null
  selectedIds: string[]
}) {
  const [knownGroups, setKnownGroups] = useState(
    () => new Map(groups.map((group) => [group.id, group]))
  )
  const selected = selectedIds.flatMap((id) => knownGroups.get(id) ?? [])
  const collaborators = editable
    ? selected
    : groups.filter((group) => group.id !== ownerGroup.id)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Nhóm dịch</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="gap-1.5 py-1" variant="default">
          <span className="max-w-64 truncate">{ownerGroup.name}</span>
        </Badge>
        {collaborators.map((group) => (
          <Badge className="gap-1.5 py-1" key={group.id} variant="secondary">
            <span className="max-w-64 truncate">{group.name}</span>
            {editable || onRemove ? (
              <button
                aria-label={`Gỡ nhóm ${group.name}`}
                className="rounded-sm outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                disabled={disabled || removingId === group.id}
                onClick={() => {
                  if (editable)
                    onChange(selectedIds.filter((id) => id !== group.id))
                  else onRemove?.(group)
                }}
                type="button"
              >
                {removingId === group.id ? (
                  <Spinner aria-label="Đang gỡ nhóm" className="size-3.5" />
                ) : (
                  <XIcon aria-hidden="true" className="size-3.5" />
                )}
              </button>
            ) : null}
          </Badge>
        ))}
      </div>
      {editable ? (
        <GroupSearchPicker
          apiBaseUrl={apiBaseUrl}
          disabled={disabled || selectedIds.length >= 20}
          excludedIds={[ownerGroup.id, ...selectedIds]}
          onSelect={(group) => {
            setKnownGroups((current) => new Map(current).set(group.id, group))
            onChange([...selectedIds, group.id])
          }}
        />
      ) : collaborators.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có nhóm khác.</p>
      ) : null}
    </div>
  )
}
