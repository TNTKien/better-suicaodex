"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  BellIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useState } from "react"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { useAccount } from "@/modules/account/provider"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import { adminAccountRequest } from "@/modules/moderation/account-moderation"
import type { SystemNotice } from "@/modules/system-notices/api"
import type { paths } from "@/src/lib/generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

type AdminSystemNoticePage =
  paths["/v1/admin/system-notices"]["get"]["responses"][200]["content"]["application/json"]
type NoticeDraft = { content: string; title: string }

const limitValues = ["10", "20", "50"] as const
const limitOptions = limitValues.map((value) => ({
  label: `${value} / trang`,
  value,
}))
const listParams = {
  limit: parseAsStringLiteral(limitValues).withDefault("20"),
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
}
const emptyDraft: NoticeDraft = { content: "", title: "" }

export function adminSystemNoticesPath(page: number, query = "", limit = 20) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (query.trim()) params.set("q", query.trim())
  return `/v1/admin/system-notices?${params}`
}

export function adminSystemNoticesQueryKey(apiBaseUrl: string, userId: string) {
  return ["account", apiBaseUrl, userId, "admin-system-notices"] as const
}

export function runSaveSystemNotice(
  apiBaseUrl: string,
  draft: NoticeDraft,
  notice: SystemNotice | null
) {
  return adminAccountRequest<{ data: SystemNotice }>(
    apiBaseUrl,
    notice
      ? `/v1/admin/system-notices/${encodeURIComponent(notice.id)}`
      : "/v1/admin/system-notices",
    {
      method: notice ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title.trim(),
        content: draft.content.trim(),
      }),
    }
  )
}

export function runDeleteSystemNotice(apiBaseUrl: string, noticeId: string) {
  return adminAccountRequest<{ data: { id: string } }>(
    apiBaseUrl,
    `/v1/admin/system-notices/${encodeURIComponent(noticeId)}`,
    { method: "DELETE" }
  )
}

function actionErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Không thể cập nhật thông báo. Vui lòng thử lại."
}

function NoticeActions({
  notice,
  onDelete,
  onEdit,
}: {
  notice: SystemNotice
  onDelete: (notice: SystemNotice) => void
  onEdit: (notice: SystemNotice) => void
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        aria-label={`Sửa thông báo ${notice.title}`}
        onClick={() => onEdit(notice)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <PencilIcon aria-hidden="true" />
      </Button>
      <Button
        aria-label={`Xóa thông báo ${notice.title}`}
        onClick={() => onDelete(notice)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </div>
  )
}

export function AdminSystemNoticeList() {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminSystemNoticeListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminSystemNoticeListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useQueryStates(listParams, { history: "push" })
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SystemNotice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SystemNotice | null>(null)
  const [draft, setDraft] = useState<NoticeDraft>(emptyDraft)
  const page = Math.max(1, filters.page)
  const query = filters.q.trim().replace(/\s+/g, " ")
  const limit = Number(filters.limit)
  const queryKey = adminSystemNoticesQueryKey(apiBaseUrl, userId)
  const notices = useQuery({
    queryKey: [...queryKey, page, query, limit],
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      adminAccountRequest<AdminSystemNoticePage>(
        apiBaseUrl,
        adminSystemNoticesPath(page, query, limit),
        {},
        signal
      ),
  })
  const items = notices.data?.data ?? []
  const invalidateNotices = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: ["system-notices", apiBaseUrl],
      }),
      queryClient.invalidateQueries({
        queryKey: ["notifications", apiBaseUrl],
      }),
    ])
  const save = useMutation({
    retry: false,
    mutationFn: () => runSaveSystemNotice(apiBaseUrl, draft, editTarget),
    onSuccess: async () => {
      setFormOpen(false)
      toast.add({
        type: "success",
        title: editTarget ? "Đã cập nhật thông báo" : "Đã đăng thông báo",
      })
      setEditTarget(null)
      setDraft(emptyDraft)
      await invalidateNotices()
    },
    onError: (error) =>
      toast.add({ type: "error", title: actionErrorMessage(error) }),
  })
  const remove = useMutation({
    retry: false,
    mutationFn: (notice: SystemNotice) =>
      runDeleteSystemNotice(apiBaseUrl, notice.id),
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.add({ type: "success", title: "Đã xóa thông báo" })
      if (items.length === 1 && page > 1) await setFilters({ page: page - 1 })
      await invalidateNotices()
    },
    onError: (error) =>
      toast.add({ type: "error", title: actionErrorMessage(error) }),
  })
  const openCreate = () => {
    save.reset()
    setEditTarget(null)
    setDraft(emptyDraft)
    setFormOpen(true)
  }
  const openEdit = (notice: SystemNotice) => {
    save.reset()
    setEditTarget(notice)
    setDraft({ content: notice.content, title: notice.title })
    setFormOpen(true)
  }
  const validDraft = Boolean(draft.title.trim() && draft.content.trim())

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_10rem_auto]">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const value = String(
              new FormData(event.currentTarget).get("q") ?? ""
            )
              .trim()
              .replace(/\s+/g, " ")
            void setFilters({ page: 1, q: value })
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Tìm thông báo theo tiêu đề"
              autoComplete="off"
              defaultValue={query}
              key={query}
              maxLength={160}
              name="q"
              placeholder="Tìm theo tiêu đề..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {notices.isFetching && !notices.isPending ? (
                <Spinner aria-label="Đang tìm thông báo" />
              ) : null}
              <InputGroupButton aria-label="Tìm kiếm" type="submit">
                Tìm
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Select
          items={limitOptions}
          onValueChange={(value) => {
            if (value)
              void setFilters({
                limit: value as (typeof limitValues)[number],
                page: 1,
              })
          }}
          value={filters.limit}
        >
          <SelectTrigger aria-label="Số thông báo mỗi trang" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {limitOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} type="button">
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          Thêm thông báo
        </Button>
      </div>

      {query ? (
        <Button
          className="self-start"
          onClick={() => void setFilters({ page: 1, q: "" })}
          size="sm"
          variant="ghost"
        >
          Xóa tìm kiếm
        </Button>
      ) : null}

      {notices.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách thông báo"
          className="self-center"
        />
      ) : notices.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách thông báo</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{notices.error.message}</span>
            <Button onClick={() => void notices.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {query
                ? "Không tìm thấy thông báo phù hợp"
                : "Chưa có thông báo hệ thống"}
            </EmptyTitle>
            <EmptyDescription>
              {query
                ? "Hãy thử từ khóa khác."
                : "Thêm thông báo để hiển thị trên bảng tin hệ thống."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {notices.data.meta.total.toLocaleString("vi-VN")} thông báo
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((notice) => (
              <article className="space-y-3 p-3" key={notice.id}>
                <p className="font-medium wrap-break-word">{notice.title}</p>
                <div className="text-xs text-muted-foreground">
                  <p>Đăng: {formatVietnamDateTimeInline(notice.createdAt)}</p>
                  <p>Sửa: {formatVietnamDateTimeInline(notice.updatedAt)}</p>
                </div>
                <NoticeActions
                  notice={notice}
                  onDelete={setDeleteTarget}
                  onEdit={openEdit}
                />
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách thông báo hệ thống dành cho quản trị viên
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Thời gian đăng</TableHead>
                  <TableHead>Cập nhật lần cuối</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((notice) => (
                  <TableRow key={notice.id}>
                    <TableCell
                      className="max-w-120 whitespace-normal"
                      title={notice.title}
                    >
                      <span className="line-clamp-2 font-medium">
                        {notice.title}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatVietnamDateTimeInline(notice.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatVietnamDateTimeInline(notice.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <NoticeActions
                        notice={notice}
                        onDelete={setDeleteTarget}
                        onEdit={openEdit}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            ariaLabel="Phân trang thông báo hệ thống"
            currentPage={page}
            disabled={notices.isFetching}
            onPageChange={(nextPage) => setFilters({ page: nextPage })}
            totalPages={notices.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setFormOpen(false)
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>
              {editTarget ? "Sửa thông báo" : "Thêm thông báo"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Cập nhật nội dung đã đăng. Thông báo sẽ không được gửi lại."
                : "Thông báo mới sẽ xuất hiện trên bảng tin và chuông của người dùng hiện có."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              if (validDraft) save.mutate()
            }}
          >
            <div className="min-h-0 overflow-y-auto p-6 pt-2">
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="admin-system-notice-title">
                    Tiêu đề
                  </FieldLabel>
                  <Input
                    autoComplete="off"
                    disabled={save.isPending}
                    id="admin-system-notice-title"
                    maxLength={160}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                    value={draft.title}
                  />
                  <FieldDescription>Tối đa 160 ký tự.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-system-notice-content">
                    Nội dung
                  </FieldLabel>
                  <Textarea
                    className="min-h-64 resize-y"
                    disabled={save.isPending}
                    id="admin-system-notice-content"
                    maxLength={10_000}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    required
                    value={draft.content}
                  />
                  <FieldDescription>
                    Hỗ trợ Markdown cơ bản. Tối đa 10.000 ký tự.
                  </FieldDescription>
                </Field>
                {save.isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Không thể lưu thông báo</AlertTitle>
                    <AlertDescription>
                      {actionErrorMessage(save.error)}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>
            </div>
            <DialogFooter className="shrink-0 border-t p-6 pt-4">
              <Button
                disabled={save.isPending}
                onClick={() => setFormOpen(false)}
                type="button"
                variant="outline"
              >
                Hủy
              </Button>
              <Button disabled={!validDraft || save.isPending} type="submit">
                {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                {save.isPending
                  ? "Đang lưu…"
                  : editTarget
                    ? "Lưu thay đổi"
                    : "Đăng thông báo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTarget(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Xóa thông báo?</DialogTitle>
            <DialogDescription>
              Thông báo sẽ biến mất khỏi trang công khai và chuông của mọi người
              dùng. Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted p-3 font-medium wrap-break-word">
            {deleteTarget?.title}
          </p>
          <DialogFooter>
            <Button
              disabled={remove.isPending}
              onClick={() => setDeleteTarget(null)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!deleteTarget || remove.isPending}
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget)
              }}
              type="button"
              variant="destructive"
            >
              {remove.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <Trash2Icon aria-hidden="true" data-icon="inline-start" />
              )}
              {remove.isPending ? "Đang xóa…" : "Xóa thông báo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
