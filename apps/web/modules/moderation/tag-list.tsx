"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TagsIcon,
} from "lucide-react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"

import { useAccount } from "@/modules/account/provider"
import type { components } from "@/src/lib/generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

export type AdminTag = Omit<
  components["schemas"]["AdminTag"],
  "moderationHiddenAt"
> & { moderationHiddenAt: string | null }
type AdminTagListResponse = { data: AdminTag[] }
type AdminTagResponse = { data: AdminTag }
type ApiError = components["schemas"]["ApiError"]
type TagGroup = AdminTag["group"]
type TagGroupFilter = TagGroup | "all"
type TagDraft = { group: TagGroup; name: string; slug: string }

const tagGroupOptions = [
  { label: "Nội dung", value: "content" },
  { label: "Định dạng", value: "format" },
  { label: "Thể loại", value: "genre" },
  { label: "Chủ đề", value: "theme" },
] as const satisfies ReadonlyArray<{ label: string; value: TagGroup }>
const tagGroupFilters = [
  { label: "Tất cả nhóm", value: "all" },
  ...tagGroupOptions,
] as const satisfies ReadonlyArray<{ label: string; value: TagGroupFilter }>
const tagGroupLabels = Object.fromEntries(
  tagGroupOptions.map(({ label, value }) => [value, label])
) as Record<TagGroup, string>
const listParams = {
  q: parseAsString.withDefault(""),
  group: parseAsStringLiteral([
    "all",
    "content",
    "format",
    "genre",
    "theme",
  ]).withDefault("all"),
}
const emptyDraft: TagDraft = { group: "genre", name: "", slug: "" }

export class AdminTagError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

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
  const body = (await response.json().catch(() => null)) as T | ApiError | null
  if (!response.ok) {
    const apiError =
      body && typeof body === "object" && "error" in body ? body.error : null
    throw new AdminTagError(
      response.status,
      apiError?.code ?? "UPSTREAM_ERROR",
      apiError?.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
    )
  }
  return body as T
}

export function adminTagsPath(query = "", group: TagGroupFilter = "all") {
  const params = new URLSearchParams()
  if (query.trim()) params.set("q", query.trim())
  if (group !== "all") params.set("group", group)
  const suffix = params.toString()
  return `/v1/admin/tags${suffix ? `?${suffix}` : ""}`
}

export function adminTagsQueryKey(
  apiBaseUrl: string,
  userId: string | undefined
) {
  return ["account", apiBaseUrl, userId, "admin-tags"] as const
}

export function runSaveAdminTag(
  apiBaseUrl: string,
  draft: TagDraft,
  tag: AdminTag | null
) {
  const slug = draft.slug.trim()
  return request<AdminTagResponse>(
    apiBaseUrl,
    tag ? `/v1/admin/tags/${encodeURIComponent(tag.id)}` : "/v1/admin/tags",
    {
      method: tag ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group: draft.group,
        name: draft.name.trim().replace(/\s+/g, " "),
        ...(slug ? { slug } : {}),
        ...(tag ? { expectedVersion: tag.version } : {}),
      }),
    }
  )
}

export function runTagVisibility(apiBaseUrl: string, tag: AdminTag) {
  return request<AdminTagResponse>(
    apiBaseUrl,
    `/v1/admin/tags/${encodeURIComponent(tag.id)}/visibility`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: tag.version,
        hidden: !tag.moderationHiddenAt,
      }),
    }
  )
}

function actionErrorMessage(error: unknown) {
  if (error instanceof AdminTagError) {
    if (error.code === "TAG_NAME_CONFLICT") return "Tên thể loại đã tồn tại."
    if (error.code === "TAG_SLUG_CONFLICT") return "Slug thể loại đã tồn tại."
    if (error.status === 409)
      return "Thể loại đã thay đổi. Danh sách đã được làm mới, hãy thử lại."
    return error.message
  }
  return "Không thể cập nhật thể loại. Vui lòng thử lại."
}

function TagActions({
  onEdit,
  onVisibility,
  tag,
}: {
  onEdit: (tag: AdminTag) => void
  onVisibility: (tag: AdminTag) => void
  tag: AdminTag
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Hành động cho thể loại ${tag.name}`}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(tag)}>
          <PencilIcon aria-hidden="true" />
          Sửa
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onVisibility(tag)}
          variant={tag.moderationHiddenAt ? "default" : "destructive"}
        >
          {tag.moderationHiddenAt ? (
            <EyeIcon aria-hidden="true" />
          ) : (
            <EyeOffIcon aria-hidden="true" />
          )}
          {tag.moderationHiddenAt ? "Hiện lại" : "Ẩn"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TagState({ tag }: { tag: AdminTag }) {
  return (
    <Badge variant={tag.moderationHiddenAt ? "destructive" : "outline"}>
      {tag.moderationHiddenAt ? "Đã ẩn" : "Đang hiển thị"}
    </Badge>
  )
}

export function AdminTagList() {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminTagListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminTagListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useQueryStates(listParams, { history: "push" })
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminTag | null>(null)
  const [draft, setDraft] = useState<TagDraft>(emptyDraft)
  const [visibilityTarget, setVisibilityTarget] = useState<AdminTag | null>(
    null
  )
  const query = filters.q.trim().replace(/\s+/g, " ")
  const group = filters.group
  const queryKey = adminTagsQueryKey(apiBaseUrl, userId)
  const tags = useQuery({
    queryKey: [...queryKey, query, group],
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      request<AdminTagListResponse>(
        apiBaseUrl,
        adminTagsPath(query, group),
        {},
        signal
      ),
  })
  const items = tags.data?.data ?? []
  const save = useMutation({
    retry: false,
    mutationFn: () => runSaveAdminTag(apiBaseUrl, draft, editTarget),
    onSuccess: async () => {
      setFormOpen(false)
      toast.add({
        type: "success",
        title: editTarget ? "Đã cập nhật thể loại" : "Đã thêm thể loại",
      })
      setEditTarget(null)
      setDraft(emptyDraft)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: async (error) => {
      toast.add({ type: "error", title: actionErrorMessage(error) })
      if (error instanceof AdminTagError && error.status === 409)
        await queryClient.invalidateQueries({ queryKey })
    },
  })
  const visibility = useMutation({
    retry: false,
    mutationFn: (tag: AdminTag) => runTagVisibility(apiBaseUrl, tag),
    onSuccess: async (_data, tag) => {
      setVisibilityTarget(null)
      toast.add({
        type: "success",
        title: tag.moderationHiddenAt
          ? "Đã hiện lại thể loại"
          : "Đã ẩn thể loại",
      })
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: async (error) => {
      toast.add({ type: "error", title: actionErrorMessage(error) })
      if (error instanceof AdminTagError && error.status === 409)
        await queryClient.invalidateQueries({ queryKey })
    },
  })
  const hasFilters = Boolean(query || group !== "all")
  const openCreate = () => {
    save.reset()
    setEditTarget(null)
    setDraft(emptyDraft)
    setFormOpen(true)
  }
  const openEdit = (tag: AdminTag) => {
    save.reset()
    setEditTarget(tag)
    setDraft({ group: tag.group, name: tag.name, slug: tag.slug })
    setFormOpen(true)
  }
  const openVisibility = (tag: AdminTag) => {
    visibility.reset()
    setVisibilityTarget(tag)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_13rem_auto]">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const value = String(
              new FormData(event.currentTarget).get("q") ?? ""
            )
              .trim()
              .replace(/\s+/g, " ")
            void setFilters({ q: value })
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Tìm thể loại theo tên hoặc slug"
              autoComplete="off"
              defaultValue={query}
              key={query}
              maxLength={160}
              name="q"
              placeholder="Tìm theo tên hoặc slug..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {tags.isFetching && !tags.isPending ? (
                <Spinner aria-label="Đang tìm thể loại" />
              ) : null}
              <InputGroupButton aria-label="Tìm kiếm" type="submit">
                Tìm
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Select
          items={tagGroupFilters}
          onValueChange={(value) => {
            if (value) void setFilters({ group: value as TagGroupFilter })
          }}
          value={group}
        >
          <SelectTrigger aria-label="Lọc nhóm thể loại" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {tagGroupFilters.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} type="button">
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Thêm thể loại
        </Button>
      </div>

      {hasFilters ? (
        <Button
          className="self-start"
          onClick={() => void setFilters({ group: "all", q: "" })}
          size="sm"
          variant="ghost"
        >
          Xóa bộ lọc
        </Button>
      ) : null}

      {tags.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách thể loại"
          className="self-center"
        />
      ) : tags.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách thể loại</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{tags.error.message}</span>
            <Button onClick={() => void tags.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagsIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters
                ? "Không tìm thấy thể loại phù hợp"
                : "Chưa có thể loại"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Hãy thử từ khóa hoặc nhóm khác."
                : "Thêm thể loại để sử dụng cho truyện."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {items.length.toLocaleString("vi-VN")} thể loại
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((tag) => (
              <article
                className="flex items-start justify-between gap-3 p-3"
                key={tag.id}
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium wrap-break-word">{tag.name}</p>
                  <p className="text-sm wrap-break-word text-muted-foreground">
                    {tag.slug} · {tagGroupLabels[tag.group]}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <TagState tag={tag} />
                    <span className="text-xs text-muted-foreground">
                      {tag.mangaCount.toLocaleString("vi-VN")} truyện
                    </span>
                  </div>
                </div>
                <TagActions
                  onEdit={openEdit}
                  onVisibility={openVisibility}
                  tag={tag}
                />
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách thể loại dành cho quản trị viên
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Số truyện</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium whitespace-normal">
                      {tag.name}
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {tag.slug}
                    </TableCell>
                    <TableCell>{tagGroupLabels[tag.group]}</TableCell>
                    <TableCell>
                      {tag.mangaCount.toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <TagState tag={tag} />
                    </TableCell>
                    <TableCell className="text-right">
                      <TagActions
                        onEdit={openEdit}
                        onVisibility={openVisibility}
                        tag={tag}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setFormOpen(false)
        }}
      >
        <DialogContent showCloseButton={false}>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editTarget ? "Sửa thể loại" : "Thêm thể loại"}
              </DialogTitle>
              <DialogDescription>
                {editTarget
                  ? "Cập nhật tên, slug hoặc nhóm của thể loại."
                  : "Slug sẽ được tự tạo nếu để trống."}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="admin-tag-name">Tên</FieldLabel>
                <Input
                  autoComplete="off"
                  id="admin-tag-name"
                  maxLength={100}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={draft.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-tag-group">Nhóm</FieldLabel>
                <Select
                  items={tagGroupOptions}
                  onValueChange={(value) => {
                    if (value)
                      setDraft((current) => ({
                        ...current,
                        group: value as TagGroup,
                      }))
                  }}
                  value={draft.group}
                >
                  <SelectTrigger id="admin-tag-group" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {tagGroupOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-tag-slug">
                  Slug{editTarget ? "" : " (không bắt buộc)"}
                </FieldLabel>
                <Input
                  autoCapitalize="none"
                  autoComplete="off"
                  id="admin-tag-slug"
                  maxLength={160}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required={Boolean(editTarget)}
                  value={draft.slug}
                />
                <FieldDescription>
                  Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.
                </FieldDescription>
              </Field>
            </FieldGroup>
            {save.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {actionErrorMessage(save.error)}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={save.isPending}
                onClick={() => setFormOpen(false)}
                type="button"
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                disabled={
                  save.isPending ||
                  !draft.name.trim() ||
                  (Boolean(editTarget) && !draft.slug.trim())
                }
                type="submit"
              >
                {save.isPending ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                ) : null}
                {save.isPending
                  ? "Đang lưu…"
                  : editTarget
                    ? "Lưu thay đổi"
                    : "Thêm thể loại"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(visibilityTarget)}
        onOpenChange={(open) => {
          if (!open && !visibility.isPending) setVisibilityTarget(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {visibilityTarget?.moderationHiddenAt
                ? "Hiện lại thể loại?"
                : "Ẩn thể loại?"}
            </DialogTitle>
            <DialogDescription>
              {visibilityTarget?.moderationHiddenAt
                ? "Thể loại và các liên kết truyện cũ sẽ xuất hiện trở lại trên trang công khai và biểu mẫu."
                : "Thể loại sẽ biến mất khỏi trang công khai và biểu mẫu, nhưng các liên kết với truyện vẫn được giữ nguyên."}
            </DialogDescription>
          </DialogHeader>
          {visibilityTarget ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md bg-muted p-3 text-sm">
              <dt className="text-muted-foreground">Tên</dt>
              <dd className="font-medium">{visibilityTarget.name}</dd>
              <dt className="text-muted-foreground">Nhóm</dt>
              <dd>{tagGroupLabels[visibilityTarget.group]}</dd>
              <dt className="text-muted-foreground">Đang dùng</dt>
              <dd>
                {visibilityTarget.mangaCount.toLocaleString("vi-VN")} truyện
              </dd>
            </dl>
          ) : null}
          {visibility.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {actionErrorMessage(visibility.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={visibility.isPending}
              onClick={() => setVisibilityTarget(null)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!visibilityTarget || visibility.isPending}
              onClick={() => {
                if (visibilityTarget) visibility.mutate(visibilityTarget)
              }}
              type="button"
              variant={
                visibilityTarget?.moderationHiddenAt ? "default" : "destructive"
              }
            >
              {visibility.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {visibility.isPending
                ? "Đang cập nhật…"
                : visibilityTarget?.moderationHiddenAt
                  ? "Hiện lại"
                  : "Ẩn thể loại"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
