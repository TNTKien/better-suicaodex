"use client"

import { useState } from "react"
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  MessageSquareIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import { useAccount } from "@/modules/account/provider"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import type { components, paths } from "@/src/lib/generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  DropdownMenuGroup,
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

type CommentPage =
  paths["/v1/admin/comments"]["get"]["responses"][200]["content"]["application/json"]
type AdminComment = CommentPage["data"][number]
type VisibilityResponse =
  paths["/v1/admin/comments/{id}/visibility"]["put"]["responses"][200]["content"]["application/json"]
type BulkVisibilityResponse =
  paths["/v1/admin/comments/visibility"]["put"]["responses"][200]["content"]["application/json"]
type ApiError = components["schemas"]["ApiError"]
type StatusFilter = AdminComment["status"] | "all"
type ActionTarget = { comments: AdminComment[]; hidden: boolean }

const limit = 20
const statusOptions = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đang hiển thị", value: "visible" },
  { label: "Đã ẩn", value: "hidden" },
] as const satisfies ReadonlyArray<{ label: string; value: StatusFilter }>
const listParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(["all", "visible", "hidden"]).withDefault("all"),
  mangaId: parseAsString.withDefault(""),
  chapterId: parseAsString.withDefault(""),
  userId: parseAsString.withDefault(""),
}

export class AdminCommentError extends Error {
  constructor(
    readonly status: number,
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
    throw new AdminCommentError(
      response.status,
      apiError?.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
    )
  }
  return body as T
}

export function adminCommentsPath(
  page: number,
  query = "",
  status: StatusFilter = "all",
  context: { mangaId?: string; chapterId?: string; userId?: string } = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (query.trim()) params.set("q", query.trim())
  if (status !== "all") params.set("status", status)
  if (context.mangaId) params.set("mangaId", context.mangaId)
  if (context.chapterId) params.set("chapterId", context.chapterId)
  if (context.userId) params.set("userId", context.userId)
  return `/v1/admin/comments?${params}`
}

export function adminCommentsQueryKey(
  apiBaseUrl: string,
  userId: string | undefined
) {
  return ["account", apiBaseUrl, userId, "admin-comments"] as const
}

export function runAdminCommentAction(
  apiBaseUrl: string,
  comment: AdminComment
) {
  return request<VisibilityResponse>(
    apiBaseUrl,
    `/v1/admin/comments/${encodeURIComponent(comment.id)}/visibility`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hidden: comment.status === "visible",
        expectedVersion: comment.version,
      }),
    }
  )
}

export function runAdminCommentBulkAction(
  apiBaseUrl: string,
  comments: AdminComment[],
  hidden: boolean
) {
  return request<BulkVisibilityResponse>(
    apiBaseUrl,
    "/v1/admin/comments/visibility",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hidden,
        items: comments.map((comment) => ({
          id: comment.id,
          expectedVersion: comment.version,
        })),
      }),
    }
  )
}

export function invalidateAdminCommentQueries(
  queryClient: QueryClient,
  apiBaseUrl: string,
  userId: string | undefined
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminCommentsQueryKey(apiBaseUrl, userId),
    }),
    queryClient.invalidateQueries({ queryKey: ["comments", apiBaseUrl] }),
  ])
}

function chapterLabel(chapter: NonNullable<AdminComment["chapter"]>) {
  const parts = [
    chapter.volume ? `Vol. ${chapter.volume}` : null,
    chapter.number ? `Ch. ${chapter.number}` : null,
  ].filter(Boolean)
  return parts.join(" - ") || chapter.title || "Oneshot"
}

function StatusBadge({ status }: { status: AdminComment["status"] }) {
  return (
    <Badge variant={status === "hidden" ? "destructive" : "outline"}>
      {status === "hidden" ? "Đã ẩn" : "Đang hiển thị"}
    </Badge>
  )
}

function Author({
  comment,
  onFilter,
}: {
  comment: AdminComment
  onFilter: (comment: AdminComment) => void
}) {
  return (
    <Button
      className="h-auto max-w-52 justify-start px-0 py-0 text-left"
      onClick={() => onFilter(comment)}
      variant="link"
    >
      <AvatarDecoration frame={comment.author.avatarFrame ?? null}>
        <Avatar className="size-10 overflow-hidden">
          {comment.author.image ? (
            <AvatarImage alt="" src={comment.author.image} />
          ) : null}
          <AvatarFallback>
            {comment.author.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </AvatarDecoration>
      <span className="truncate">{comment.author.name}</span>
    </Button>
  )
}

function Context({
  comment,
  onChapterFilter,
  onMangaFilter,
}: {
  comment: AdminComment
  onChapterFilter: (comment: AdminComment) => void
  onMangaFilter: (comment: AdminComment) => void
}) {
  return (
    <div className="flex max-w-72 flex-col items-start gap-0.5">
      <Button
        className="h-auto max-w-full justify-start px-0 py-0 text-left"
        onClick={() => onMangaFilter(comment)}
        variant="link"
      >
        <span className="line-clamp-2 wrap-break-word">
          {comment.manga.title}
        </span>
      </Button>
      {comment.chapter ? (
        <Button
          className="h-auto max-w-full justify-start px-0 py-0 text-xs"
          onClick={() => onChapterFilter(comment)}
          variant="link"
        >
          <span className="truncate">{chapterLabel(comment.chapter)}</span>
        </Button>
      ) : null}
    </div>
  )
}

function CommentActions({
  comment,
  onAction,
}: {
  comment: AdminComment
  onAction: (comment: AdminComment) => void
}) {
  const hidden = comment.status === "hidden"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Hành động cho bình luận của ${comment.author.name}`}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => onAction(comment)}
            variant={hidden ? "default" : "destructive"}
          >
            {hidden ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeOffIcon aria-hidden="true" />
            )}
            {hidden ? "Gỡ ẩn" : "Ẩn bình luận"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CommentTableRow({
  comment,
  onAction,
  onChapterFilter,
  onMangaFilter,
  onSelectedChange,
  onUserFilter,
  selected,
}: {
  comment: AdminComment
  onAction: (comment: AdminComment) => void
  onChapterFilter: (comment: AdminComment) => void
  onMangaFilter: (comment: AdminComment) => void
  onSelectedChange: (comment: AdminComment, selected: boolean) => void
  onUserFilter: (comment: AdminComment) => void
  selected: boolean
}) {
  return (
    <TableRow>
      <TableCell>
        <Checkbox
          aria-label={`Chọn bình luận của ${comment.author.name}`}
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(comment, checked)}
        />
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="max-w-144 min-w-72">
          <p
            className="line-clamp-5 text-sm wrap-break-word"
            title={comment.body}
          >
            {comment.body}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {comment.parentId ? (
              <Badge variant="secondary">Phản hồi</Badge>
            ) : null}
            <span className="truncate">{comment.id}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Author comment={comment} onFilter={onUserFilter} />
      </TableCell>
      <TableCell>
        <Context
          comment={comment}
          onChapterFilter={onChapterFilter}
          onMangaFilter={onMangaFilter}
        />
      </TableCell>
      <TableCell>
        <StatusBadge status={comment.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatVietnamDateTimeInline(comment.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <CommentActions comment={comment} onAction={onAction} />
      </TableCell>
    </TableRow>
  )
}

function CommentMobileItem({
  comment,
  onAction,
  onChapterFilter,
  onMangaFilter,
  onSelectedChange,
  onUserFilter,
  selected,
}: Parameters<typeof CommentTableRow>[0]) {
  return (
    <article className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <Checkbox
            aria-label={`Chọn bình luận của ${comment.author.name}`}
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(comment, checked)}
          />
          <Author comment={comment} onFilter={onUserFilter} />
        </div>
        <CommentActions comment={comment} onAction={onAction} />
      </div>
      <p className="line-clamp-4 text-sm wrap-break-word">{comment.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={comment.status} />
        {comment.parentId ? <Badge variant="secondary">Phản hồi</Badge> : null}
        <span className="text-xs text-muted-foreground">
          {formatVietnamDateTimeInline(comment.createdAt)}
        </span>
      </div>
      <Context
        comment={comment}
        onChapterFilter={onChapterFilter}
        onMangaFilter={onMangaFilter}
      />
    </article>
  )
}

function actionErrorMessage(error: unknown) {
  if (error instanceof AdminCommentError && error.status === 409)
    return "Bình luận đã thay đổi. Danh sách đã được làm mới, hãy mở lại thao tác."
  return error instanceof Error
    ? error.message
    : "Không thể cập nhật bình luận. Vui lòng thử lại."
}

export function AdminCommentList() {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminCommentListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminCommentListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<ActionTarget | null>(null)
  const [selection, setSelection] = useState({ key: "", ids: [] as string[] })
  const [filters, setFilters] = useQueryStates(listParams, { history: "push" })
  const page = Math.max(1, filters.page)
  const query = filters.q.trim().replace(/\s+/g, " ")
  const status = filters.status
  const context = {
    mangaId: filters.mangaId,
    chapterId: filters.chapterId,
    userId: filters.userId,
  }
  const queryKey = adminCommentsQueryKey(apiBaseUrl, userId)
  const comments = useQuery({
    queryKey: [
      ...queryKey,
      page,
      query,
      status,
      context.mangaId,
      context.chapterId,
      context.userId,
    ],
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      request<CommentPage>(
        apiBaseUrl,
        adminCommentsPath(page, query, status, context),
        {},
        signal
      ),
  })
  const items = comments.data?.data ?? []
  const selectionKey = [
    page,
    query,
    status,
    context.mangaId,
    context.chapterId,
    context.userId,
  ].join("\0")
  const selectedIds = selection.key === selectionKey ? selection.ids : []
  const selectedComments = items.filter((comment) =>
    selectedIds.includes(comment.id)
  )
  const allSelected =
    items.length > 0 &&
    items.every((comment) => selectedIds.includes(comment.id))
  const allVisible = selectedComments.every(
    (comment) => comment.status === "visible"
  )
  const allHidden = selectedComments.every(
    (comment) => comment.status === "hidden"
  )
  const setCommentSelected = (comment: AdminComment, selected: boolean) =>
    setSelection((current) => {
      const ids = current.key === selectionKey ? current.ids : []
      return {
        key: selectionKey,
        ids: selected
          ? [...new Set([...ids, comment.id])]
          : ids.filter((id) => id !== comment.id),
      }
    })
  const action = useMutation({
    retry: false,
    mutationFn: async (batch: ActionTarget) => {
      if (batch.comments.length === 1) {
        await runAdminCommentAction(apiBaseUrl, batch.comments[0]!)
        return
      }
      await runAdminCommentBulkAction(apiBaseUrl, batch.comments, batch.hidden)
    },
    onSuccess: async (_data, batch) => {
      setTarget(null)
      setSelection({ key: selectionKey, ids: [] })
      toast.add({
        type: "success",
        title:
          batch.comments.length === 1
            ? batch.hidden
              ? "Đã ẩn bình luận"
              : "Đã gỡ ẩn bình luận"
            : batch.hidden
              ? `Đã ẩn ${batch.comments.length} bình luận`
              : `Đã gỡ ẩn ${batch.comments.length} bình luận`,
      })
      await invalidateAdminCommentQueries(queryClient, apiBaseUrl, userId)
    },
    onError: async (error) => {
      if (error instanceof AdminCommentError && error.status === 409) {
        setTarget(null)
        await comments.refetch()
      }
      toast.add({ type: "error", title: actionErrorMessage(error) })
    },
  })
  const openAction = (batch: ActionTarget) => {
    action.reset()
    setTarget(batch)
  }
  const hasFilters = Boolean(
    query ||
    status !== "all" ||
    context.mangaId ||
    context.chapterId ||
    context.userId
  )
  const first = items[0]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(18rem,1fr)_14rem]">
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
              aria-label="Tìm theo nội dung, người bình luận hoặc ID"
              autoComplete="off"
              defaultValue={query}
              key={query}
              maxLength={160}
              name="q"
              placeholder="Tìm nội dung, người bình luận hoặc ID..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {comments.isFetching && !comments.isPending ? (
                <Spinner aria-label="Đang tìm bình luận" />
              ) : null}
              <InputGroupButton aria-label="Tìm kiếm" type="submit">
                Tìm
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Select
          items={statusOptions}
          onValueChange={(value) => {
            if (value)
              void setFilters({ page: 1, status: value as StatusFilter })
          }}
          value={status}
        >
          <SelectTrigger
            aria-label="Lọc trạng thái bình luận"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {context.userId || context.mangaId || context.chapterId ? (
        <div className="flex flex-wrap gap-2" aria-label="Bộ lọc ngữ cảnh">
          {context.userId ? (
            <Button
              onClick={() => void setFilters({ page: 1, userId: "" })}
              size="sm"
              variant="secondary"
            >
              Tác giả: {first?.author.name ?? context.userId}
              <XIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          ) : null}
          {context.mangaId ? (
            <Button
              onClick={() => void setFilters({ mangaId: "", page: 1 })}
              size="sm"
              variant="secondary"
            >
              Truyện: {first?.manga.title ?? context.mangaId}
              <XIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          ) : null}
          {context.chapterId ? (
            <Button
              onClick={() => void setFilters({ chapterId: "", page: 1 })}
              size="sm"
              variant="secondary"
            >
              Chương:{" "}
              {first?.chapter ? chapterLabel(first.chapter) : context.chapterId}
              <XIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {comments.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách bình luận"
          className="self-center"
        />
      ) : comments.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách bình luận</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{comments.error.message}</span>
            <Button onClick={() => void comments.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters
                ? "Không tìm thấy bình luận phù hợp"
                : "Chưa có bình luận"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Hãy thử từ khóa hoặc bộ lọc khác."
                : "Bình luận của người dùng sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {comments.data.meta.total.toLocaleString("vi-VN")} bình luận
          </p>
          {selectedComments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
              <span className="mr-auto text-sm font-medium">
                Đã chọn {selectedComments.length}
              </span>
              {!allVisible && !allHidden ? (
                <span className="text-xs text-muted-foreground">
                  Chỉ xử lý cùng một trạng thái mỗi lần.
                </span>
              ) : null}
              <Button
                disabled={!allVisible || action.isPending}
                onClick={() =>
                  openAction({ comments: selectedComments, hidden: true })
                }
                size="sm"
                variant="destructive"
              >
                <EyeOffIcon aria-hidden="true" data-icon="inline-start" />
                Ẩn đã chọn
              </Button>
              <Button
                disabled={!allHidden || action.isPending}
                onClick={() =>
                  openAction({ comments: selectedComments, hidden: false })
                }
                size="sm"
                variant="outline"
              >
                <EyeIcon aria-hidden="true" data-icon="inline-start" />
                Gỡ ẩn đã chọn
              </Button>
              <Button
                disabled={action.isPending}
                onClick={() => setSelection({ key: selectionKey, ids: [] })}
                size="sm"
                variant="ghost"
              >
                Bỏ chọn
              </Button>
            </div>
          ) : null}
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((comment) => (
              <CommentMobileItem
                comment={comment}
                key={comment.id}
                onAction={(item) =>
                  openAction({
                    comments: [item],
                    hidden: item.status === "visible",
                  })
                }
                onChapterFilter={(item) =>
                  void setFilters({
                    chapterId: item.chapter?.id ?? "",
                    page: 1,
                  })
                }
                onMangaFilter={(item) =>
                  void setFilters({ mangaId: item.manga.id, page: 1 })
                }
                onSelectedChange={setCommentSelected}
                onUserFilter={(item) =>
                  void setFilters({ page: 1, userId: item.author.id })
                }
                selected={selectedIds.includes(comment.id)}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách bình luận dành cho quản trị viên
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label="Chọn tất cả bình luận trong trang"
                      checked={allSelected}
                      onCheckedChange={(checked) =>
                        setSelection({
                          key: selectionKey,
                          ids: checked
                            ? items.map((comment) => comment.id)
                            : [],
                        })
                      }
                    />
                  </TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Người bình luận</TableHead>
                  <TableHead>Truyện</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((comment) => (
                  <CommentTableRow
                    comment={comment}
                    key={comment.id}
                    onAction={(item) =>
                      openAction({
                        comments: [item],
                        hidden: item.status === "visible",
                      })
                    }
                    onChapterFilter={(item) =>
                      void setFilters({
                        chapterId: item.chapter?.id ?? "",
                        page: 1,
                      })
                    }
                    onMangaFilter={(item) =>
                      void setFilters({ mangaId: item.manga.id, page: 1 })
                    }
                    onSelectedChange={setCommentSelected}
                    onUserFilter={(item) =>
                      void setFilters({ page: 1, userId: item.author.id })
                    }
                    selected={selectedIds.includes(comment.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            ariaLabel="Phân trang bình luận"
            currentPage={page}
            disabled={comments.isFetching}
            onPageChange={(nextPage) => setFilters({ page: nextPage })}
            totalPages={comments.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setTarget(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {target?.hidden ? "Ẩn bình luận?" : "Gỡ ẩn bình luận?"}
            </DialogTitle>
            <DialogDescription>
              {target && target.comments.length > 1
                ? `Thao tác sẽ áp dụng đồng thời cho ${target.comments.length} bình luận. Nếu một bình luận đã thay đổi, toàn bộ thao tác sẽ được hủy.`
                : target?.hidden
                  ? "Nội dung sẽ được thay bằng thông báo bình luận đã bị ẩn. Các phản hồi vẫn được giữ."
                  : "Nội dung bình luận sẽ xuất hiện lại trên các trang công khai."}
            </DialogDescription>
          </DialogHeader>
          {target?.comments.length === 1 ? (
            <p className="line-clamp-4 rounded-md bg-muted p-3 text-sm wrap-break-word">
              {target.comments[0]!.body}
            </p>
          ) : null}
          {action.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {actionErrorMessage(action.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={action.isPending}
              onClick={() => setTarget(null)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!target || action.isPending}
              onClick={() => {
                if (target) action.mutate(target)
              }}
              type="button"
              variant={target?.hidden ? "destructive" : "default"}
            >
              {action.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : target?.hidden ? (
                <EyeOffIcon aria-hidden="true" data-icon="inline-start" />
              ) : (
                <EyeIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {action.isPending
                ? "Đang cập nhật…"
                : target?.hidden
                  ? "Ẩn bình luận"
                  : "Gỡ ẩn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
