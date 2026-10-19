"use client"

import { useRef, useState } from "react"
import { useDebouncedValue } from "@mantine/hooks"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import { useFormContext } from "react-hook-form"

import type { components } from "@/src/lib/generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Popover, PopoverContent } from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"
import type { MangaFormInput } from "./form-schema"

type Person = components["schemas"]["PersonSummary"]
type PersonList = components["schemas"]["PersonList"]

async function request<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
  if (!response.ok)
    throw new Error(body?.error?.message ?? "Không thể kết nối tới máy chủ.")
  return body as T
}

function PersonPicker({
  apiBaseUrl,
  disabled,
  groupId,
  initialSelected,
  label,
  role,
}: {
  apiBaseUrl: string
  disabled: boolean
  groupId: string | null
  initialSelected: Person[]
  label: string
  role: "author" | "artist"
}) {
  const form = useFormContext<MangaFormInput>()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [createName, setCreateName] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Person[]>(initialSelected)
  const [debouncedQuery] = useDebouncedValue(query.trim(), 300)
  const results = useQuery({
    queryKey: ["people", apiBaseUrl, "all", debouncedQuery],
    enabled: open && !disabled && debouncedQuery.length > 0,
    queryFn: ({ signal }) => {
      const url = new URL("/v1/people", apiBaseUrl)
      url.searchParams.set("limit", "10")
      if (debouncedQuery) url.searchParams.set("q", debouncedQuery)
      return request<PersonList>(
        apiBaseUrl,
        url.pathname + url.search,
        {},
        signal
      )
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const create = useMutation({
    mutationFn: (name: string) =>
      request<{ data: Person }>(
        apiBaseUrl,
        `/v1/contribution/groups/${groupId}/people`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
          headers: { "Content-Type": "application/json" },
        }
      ),
    onSuccess: ({ data }) => {
      void queryClient.invalidateQueries({ queryKey: ["people", apiBaseUrl] })
      updateSelected(
        selected.some(({ id }) => id === data.id)
          ? selected
          : [...selected, data]
      )
      setCreateName(null)
      setQuery("")
      setOpen(false)
    },
  })
  const term = query.trim().replace(/\s+/g, " ")
  const canCreate =
    term.length > 0 &&
    term === debouncedQuery &&
    !results.isFetching &&
    !results.data?.data.some(
      ({ name }) =>
        name.toLocaleLowerCase("vi") === term.toLocaleLowerCase("vi")
    )
  const waiting = term.length > 0 && term !== debouncedQuery

  function updateSelected(next: Person[]) {
    setSelected(next)
    form.setValue(
      role === "author" ? "authorIds" : "artistIds",
      next.map(({ id }) => id),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  function toggle(person: Person) {
    updateSelected(
      selected.some(({ id }) => id === person.id)
        ? selected.filter(({ id }) => id !== person.id)
        : selected.length < 20
          ? [...selected, person]
          : selected
    )
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Popover onOpenChange={setOpen} open={open}>
        <InputGroup ref={anchorRef}>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-controls={`${role}-results`}
            aria-expanded={open}
            aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
            autoComplete="off"
            disabled={disabled}
            id={`${role}-search`}
            maxLength={160}
            onChange={(event) => {
              const value = event.target.value
              setQuery(value)
              setOpen(value.trim().length > 0)
              create.reset()
            }}
            onFocus={() => setOpen(term.length > 0)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
            }}
            placeholder={`Tìm ${label.toLocaleLowerCase("vi")}...`}
            type="search"
            value={query}
          />
        </InputGroup>

        {open && term ? (
          <PopoverContent
            align="start"
            anchor={anchorRef}
            className="max-h-[min(18rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) gap-0 overflow-y-auto p-2"
            initialFocus={false}
          >
            <div className="flex flex-col" id={`${role}-results`}>
              {waiting || results.isPending || results.isFetching ? (
                <div className="flex min-h-16 items-center justify-center">
                  <Spinner
                    aria-label={`Đang tìm ${label.toLocaleLowerCase("vi")}`}
                  />
                </div>
              ) : results.isError ? (
                <p className="p-3 text-center text-sm text-destructive">
                  Không thể tải danh sách.
                </p>
              ) : results.data.data.length ? (
                results.data.data.map((person) => {
                  const checked = selected.some(({ id }) => id === person.id)
                  return (
                    <button
                      aria-pressed={checked}
                      className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
                      disabled={selected.length >= 20 && !checked}
                      key={person.id}
                      onClick={() => toggle(person)}
                      type="button"
                    >
                      <span className="truncate">{person.name}</span>
                      {checked ? (
                        <CheckIcon aria-hidden="true" className="size-4" />
                      ) : null}
                    </button>
                  )
                })
              ) : (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  Không tìm thấy kết quả.
                </p>
              )}

              {canCreate ? (
                <button
                  className="flex w-full items-center gap-2 border-t px-2 py-2 text-left text-sm font-medium outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
                  disabled={create.isPending || selected.length >= 20}
                  onClick={() => {
                    create.reset()
                    setCreateName(term)
                    setOpen(false)
                  }}
                  type="button"
                >
                  {create.isPending ? (
                    <Spinner />
                  ) : (
                    <PlusIcon aria-hidden="true" className="size-4" />
                  )}
                  Tạo “{term}”
                </button>
              ) : null}
            </div>
          </PopoverContent>
        ) : null}
      </Popover>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !create.isPending) {
            setCreateName(null)
            create.reset()
          }
        }}
        open={createName !== null}
      >
        <DialogContent showCloseButton={false}>
          <div className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>
                Tạo {label.toLocaleLowerCase("vi")} mới?
              </DialogTitle>
              <DialogDescription>
                “{createName}” sẽ được thêm vào danh sách.
              </DialogDescription>
            </DialogHeader>
            {create.isError ? (
              <p className="text-sm text-destructive">{create.error.message}</p>
            ) : null}
            <DialogFooter>
              <DialogClose
                disabled={create.isPending}
                render={<Button type="button" variant="outline" />}
              >
                Hủy
              </DialogClose>
              <Button
                disabled={!createName || create.isPending}
                onClick={() => {
                  if (createName && !create.isPending) create.mutate(createName)
                }}
                type="button"
              >
                {create.isPending ? <Spinner data-icon="inline-start" /> : null}
                {create.isPending ? "Đang tạo…" : "Xác nhận"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <Badge className="h-7 gap-1" key={person.id} variant="secondary">
              <span className="max-w-40 truncate">{person.name}</span>
              <button
                aria-label={`Bỏ ${person.name}`}
                className="rounded-full outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => toggle(person)}
                type="button"
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

export function MetadataPeopleFields({
  apiBaseUrl,
  disabled,
  groupId,
  initialArtists = [],
  initialAuthors = [],
}: {
  apiBaseUrl: string
  disabled: boolean
  groupId: string | null
  initialArtists?: Person[]
  initialAuthors?: Person[]
}) {
  return (
    <>
      <PersonPicker
        apiBaseUrl={apiBaseUrl}
        disabled={disabled || !groupId}
        groupId={groupId}
        initialSelected={initialAuthors}
        label="Tác giả"
        role="author"
      />
      <PersonPicker
        apiBaseUrl={apiBaseUrl}
        disabled={disabled || !groupId}
        groupId={groupId}
        initialSelected={initialArtists}
        label="Họa sĩ"
        role="artist"
      />
    </>
  )
}
