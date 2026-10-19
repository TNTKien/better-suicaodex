"use client"

import Link from "next/link"
import { useState } from "react"
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  Trash2Icon,
} from "lucide-react"
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"

import { MangaInformation } from "@/app/manage/manga/[mangaId]/chapters/manga-information"
import { formatVietnamDateTimeInline } from "@/lib/date"
import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import type { components, paths } from "@/src/lib/generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
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
import { Field, FieldLabel } from "@workspace/ui/components/field"
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

type ApiError = components["schemas"]["ApiError"]
type Manga = components["schemas"]["MangaManagementDetail"]
type ChapterPage =
  paths["/v1/admin/manga/{mangaId}/chapters"]["get"]["responses"][200]["content"]["application/json"]
type Chapter = ChapterPage["data"][number]
type SortField = "volume" | "chapter" | "updatedAt"
type SortDirection = "asc" | "desc"
type PublicationFilter = "all" | Chapter["publicationState"]
type ModerationFilter = "all" | "hidden" | "visible"
type ChapterAction = "visibility" | "delete"
type ChapterActionTarget = { chapter: Chapter; action: ChapterAction }
type ChapterActionInput = ChapterActionTarget & { reason: string }

const limit = 20
const filters = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(["volume", "chapter", "updatedAt"]).withDefault(
    "updatedAt"
  ),
  direction: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
  state: parseAsStringLiteral([
    "all",
    "draft",
    "published",
    "hidden",
  ]).withDefault("all"),
  moderation: parseAsStringLiteral(["all", "hidden", "visible"]).withDefault(
    "all"
  ),
}
const sortFields = [
  { value: "volume", label: "VOL" },
  { value: "chapter", label: "CHAPTER" },
  { value: "updatedAt", label: "CẬP NHẬT" },
] as const satisfies ReadonlyArray<{ value: SortField; label: string }>
const publicationOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "draft", label: "Nháp" },
  { value: "published", label: "Đã đăng" },
  { value: "hidden", label: "Nhóm đang ẩn" },
] as const satisfies ReadonlyArray<{ value: PublicationFilter; label: string }>
const moderationOptions = [
  { value: "all", label: "Tất cả kiểm duyệt" },
  { value: "visible", label: "Bình thường" },
  { value: "hidden", label: "Bị quản trị viên ẩn" },
] as const satisfies ReadonlyArray<{ value: ModerationFilter; label: string }>

class AdminChapterError extends Error {
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
    const error =
      body && typeof body === "object" && "error" in body ? body.error : null
    throw new AdminChapterError(
      response.status,
      error?.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
    )
  }
  return body as T
}

export function adminChapterListPath(
  mangaId: string,
  page: number,
  sort: SortField,
  direction: SortDirection,
  state: PublicationFilter,
  moderation: ModerationFilter
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    direction,
  })
  if (state !== "all") params.set("publicationState", state)
  if (moderation !== "all") params.set("moderation", moderation)
  return `/v1/admin/manga/${encodeURIComponent(mangaId)}/chapters?${params}`
}

export function adminChapterQueryKey(apiBaseUrl: string, mangaId: string) {
  return ["admin-chapters", apiBaseUrl, mangaId] as const
}

export function canSubmitAdminChapterAction(
  target: ChapterActionTarget | null,
  pending: boolean,
  reason: string
) {
  return Boolean(
    target &&
    !pending &&
    (target.action !== "visibility" ||
      target.chapter.moderationHiddenAt ||
      reason.trim())
  )
}

export function runAdminChapterAction(
  apiBaseUrl: string,
  { chapter, reason, action }: ChapterActionInput
) {
  return request(
    apiBaseUrl,
    `/v1/admin/chapters/${encodeURIComponent(chapter.id)}${action === "visibility" ? "/visibility" : ""}`,
    {
      method: action === "delete" ? "DELETE" : "PUT",
      body: JSON.stringify(
        action === "delete"
          ? { expectedVersion: chapter.version }
          : chapter.moderationHiddenAt
            ? { hidden: false, expectedVersion: chapter.version }
            : { hidden: true, expectedVersion: chapter.version, reason }
      ),
      headers: { "Content-Type": "application/json" },
    }
  )
}

export async function invalidateAdminChapterQueries(
  queryClient: QueryClient,
  apiBaseUrl: string,
  userId: string | undefined,
  mangaId: string
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminChapterQueryKey(apiBaseUrl, mangaId),
    }),
    queryClient.invalidateQueries({
      queryKey: ["account", apiBaseUrl, userId, "admin-mangas"],
    }),
  ])
}

function chapterLabel(chapter: Chapter) {
  const number = chapter.number ? `Ch. ${chapter.number}` : "Oneshot"
  return chapter.volume ? `Vol. ${chapter.volume} - ${number}` : number
}

function displayLabel(chapter: Chapter) {
  if (chapter.processingState === "queued") return "Đang chờ"
  if (chapter.processingState === "processing") return "Đang xử lý"
  if (chapter.processingState === "failed") return "Xử lý lỗi"
  if (chapter.publicationState === "draft") return "Nháp"
  return chapter.publicationState === "hidden" ? "Nhóm đang ẩn" : "Đã đăng"
}

function displayVariant(chapter: Chapter) {
  if (chapter.processingState === "failed") return "destructive" as const
  if (chapter.processingState !== "idle") return "secondary" as const
  return chapter.publicationState === "published"
    ? ("default" as const)
    : ("secondary" as const)
}

function canRead(chapter: Chapter, manga: Manga) {
  return (
    manga.publicationState === "published" &&
    !manga.moderationHiddenAt &&
    chapter.publicationState === "published" &&
    !chapter.moderationHiddenAt &&
    chapter.processingState === "idle" &&
    chapter.isFull &&
    chapter.availablePageCount > 0
  )
}

function SortableHead({
  direction,
  label,
  onSort,
  sort,
  value,
}: {
  direction: SortDirection
  label: string
  onSort: (value: SortField) => void
  sort: SortField
  value: SortField
}) {
  const active = sort === value
  const Icon = active
    ? direction === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
    : ArrowUpDownIcon
  return (
    <TableHead
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Button
        className="-ml-2"
        onClick={() => onSort(value)}
        size="sm"
        type="button"
        variant="ghost"
      >
        {label}
        <Icon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </TableHead>
  )
}

function ChapterActions({
  chapter,
  manga,
  onAction,
}: {
  chapter: Chapter
  manga: Manga
  onAction: (chapter: Chapter, action: ChapterAction) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Hành động cho ${chapterLabel(chapter)}`}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canRead(chapter, manga) ? (
          <DropdownMenuItem
            render={
              <Link
                href={`/chapter/${chapter.id}`}
                prefetch={false}
                target="_blank"
              />
            }
          >
            <EyeIcon aria-hidden="true" />
            Xem chương
          </DropdownMenuItem>
        ) : null}
        {chapter.publicationState !== "hidden" ? (
          <DropdownMenuItem
            render={
              <Link
                href={`/admin/manga/${chapter.mangaId}/chapter/${chapter.id}/edit`}
                prefetch={false}
              />
            }
          >
            <PencilIcon aria-hidden="true" />
            Chỉnh sửa
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          render={
            <Link
              href={`/admin/audit?targetKind=chapter&targetId=${encodeURIComponent(chapter.id)}`}
            />
          }
        >
          <ScrollTextIcon aria-hidden="true" />
          Xem nhật ký
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction(chapter, "visibility")}
          variant={chapter.moderationHiddenAt ? "default" : "destructive"}
        >
          {chapter.moderationHiddenAt ? (
            <EyeIcon aria-hidden="true" />
          ) : (
            <EyeOffIcon aria-hidden="true" />
          )}
          {chapter.moderationHiddenAt ? "Gỡ ẩn" : "Ẩn chương"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction(chapter, "delete")}
          variant="destructive"
        >
          <Trash2Icon aria-hidden="true" />
          Xóa chương
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModerationState({ chapter }: { chapter: Chapter }) {
  return (
    <div className="flex max-w-64 flex-col items-start gap-1.5">
      <Badge variant={chapter.moderationHiddenAt ? "destructive" : "outline"}>
        {chapter.moderationHiddenAt ? "Bị quản trị viên ẩn" : "Bình thường"}
      </Badge>
      {chapter.moderationReason ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {chapter.moderationReason}
        </span>
      ) : null}
    </div>
  )
}

function ChapterRow({
  chapter,
  manga,
  onAction,
}: {
  chapter: Chapter
  manga: Manga
  onAction: (chapter: Chapter, action: ChapterAction) => void
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {chapter.volume ? `Vol. ${chapter.volume}` : "-"}
      </TableCell>
      <TableCell className="font-medium">
        {chapter.number ? `Ch. ${chapter.number}` : "Oneshot"}
      </TableCell>
      <TableCell className="max-w-96">
        <span className="line-clamp-2 wrap-break-word">
          {chapter.title || "-"}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={displayVariant(chapter)}>
          {chapter.processingState === "queued" ||
          chapter.processingState === "processing" ? (
            <Spinner data-icon="inline-start" />
          ) : null}
          {displayLabel(chapter)}
        </Badge>
        {chapter.failureReason ? (
          <p className="mt-1 max-w-48 text-xs text-destructive">
            {chapter.failureReason}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <ModerationState chapter={chapter} />
      </TableCell>
      <TableCell>
        {(chapter.publicationState === "draft"
          ? chapter.stagedPageCount
          : chapter.pageCount
        ).toLocaleString("vi-VN")}
      </TableCell>
      <TableCell>{formatVietnamDateTimeInline(chapter.updatedAt)}</TableCell>
      <TableCell className="text-right">
        <ChapterActions chapter={chapter} manga={manga} onAction={onAction} />
      </TableCell>
    </TableRow>
  )
}

function ChapterMobileItem({
  chapter,
  manga,
  onAction,
}: {
  chapter: Chapter
  manga: Manga
  onAction: (chapter: Chapter, action: ChapterAction) => void
}) {
  return (
    <article className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">{chapterLabel(chapter)}</h2>
          <p className="line-clamp-2 text-sm wrap-break-word text-muted-foreground">
            {chapter.title || "Không có tiêu đề"}
          </p>
        </div>
        <ChapterActions chapter={chapter} manga={manga} onAction={onAction} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={displayVariant(chapter)}>{displayLabel(chapter)}</Badge>
        <ModerationState chapter={chapter} />
      </div>
      {chapter.failureReason ? (
        <p className="text-xs text-destructive">{chapter.failureReason}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {(chapter.publicationState === "draft"
          ? chapter.stagedPageCount
          : chapter.pageCount
        ).toLocaleString("vi-VN")}{" "}
        trang · Cập nhật {formatVietnamDateTimeInline(chapter.updatedAt)}
      </p>
    </article>
  )
}

function ListError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Không thể tải danh sách chương</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button onClick={onRetry} variant="outline">
            Thử lại
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

export function AdminChapterList({ mangaId }: { mangaId: string }) {
  const account = useAccount()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<{
    chapter: Chapter
    action: ChapterAction
  } | null>(null)
  const [reason, setReason] = useState("")
  const [query, setQuery] = useQueryStates(filters, { history: "push" })
  const page = Math.max(1, query.page)
  const mangaKey = [
    "manga-management",
    account.apiBaseUrl,
    "admin",
    mangaId,
  ] as const
  const chapterKey = adminChapterQueryKey(account.apiBaseUrl, mangaId)
  const manga = useQuery({
    queryKey: mangaKey,
    enabled: account.status === "authenticated",
    queryFn: ({ signal }) =>
      request<{ data: Manga }>(
        account.apiBaseUrl,
        `/v1/admin/manga/${encodeURIComponent(mangaId)}`,
        {},
        signal
      ),
    staleTime: 30_000,
    retry: false,
  })
  const chapters = useQuery({
    queryKey: [
      ...chapterKey,
      page,
      query.sort,
      query.direction,
      query.state,
      query.moderation,
    ],
    enabled: account.status === "authenticated" && manga.isSuccess,
    queryFn: ({ signal }) =>
      request<ChapterPage>(
        account.apiBaseUrl,
        adminChapterListPath(
          mangaId,
          page,
          query.sort,
          query.direction,
          query.state,
          query.moderation
        ),
        {},
        signal
      ),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const mutation = useMutation({
    retry: false,
    mutationFn: (input: ChapterActionInput) =>
      runAdminChapterAction(account.apiBaseUrl, input),
    onSuccess: async (_result, { chapter, action }) => {
      setTarget(null)
      setReason("")
      toast.add({
        type: "success",
        title:
          action === "delete"
            ? "Đã xóa chương"
            : chapter.moderationHiddenAt
              ? "Đã gỡ ẩn chương"
              : "Đã ẩn chương",
      })
      const leavesFilter =
        action === "delete" ||
        (query.moderation === "visible" && !chapter.moderationHiddenAt) ||
        (query.moderation === "hidden" && Boolean(chapter.moderationHiddenAt))
      if (leavesFilter && chapters.data?.data.length === 1 && page > 1)
        await setQuery({ page: page - 1 })
      await invalidateAdminChapterQueries(
        queryClient,
        account.apiBaseUrl,
        account.user?.id,
        mangaId
      )
    },
  })

  if (account.status === "loading")
    return (
      <Spinner aria-label="Đang tải danh sách chương" className="self-center" />
    )
  if (account.status === "guest")
    return (
      <Alert>
        <AlertTitle>Bạn chưa đăng nhập</AlertTitle>
        <AlertDescription>Đăng nhập để quản lý chương.</AlertDescription>
        <Link
          className={buttonVariants({ className: "mt-3 w-fit" })}
          href={loginHref(`/admin/manga/${mangaId}/chapter`)}
        >
          Đăng nhập
        </Link>
      </Alert>
    )
  if (account.status === "error")
    return (
      <ListError
        message="Không thể tải thông tin tài khoản."
        onRetry={() => void account.retry()}
      />
    )
  if (manga.isPending)
    return (
      <Spinner aria-label="Đang tải thông tin truyện" className="self-center" />
    )
  if (manga.isError)
    return (
      <ListError
        message={manga.error.message}
        onRetry={() => void manga.refetch()}
      />
    )
  if (chapters.isPending)
    return (
      <Spinner aria-label="Đang tải danh sách chương" className="self-center" />
    )
  if (chapters.isError)
    return (
      <ListError
        message={chapters.error.message}
        onRetry={() => void chapters.refetch()}
      />
    )

  const items = chapters.data.data
  const setSort = (sort: SortField) => {
    const direction =
      query.sort === sort
        ? query.direction === "asc"
          ? "desc"
          : "asc"
        : sort === "updatedAt"
          ? "desc"
          : "asc"
    void setQuery({ direction, page: 1, sort })
  }
  const openDialog = (chapter: Chapter, action: ChapterAction) => {
    mutation.reset()
    setReason("")
    setTarget({ chapter, action })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MangaInformation manga={manga.data.data} />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Select
          items={publicationOptions}
          value={query.state}
          onValueChange={(value) => {
            if (value)
              void setQuery({ page: 1, state: value as PublicationFilter })
          }}
        >
          <SelectTrigger aria-label="Lọc trạng thái chương" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {publicationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={moderationOptions}
          value={query.moderation}
          onValueChange={(value) => {
            if (value)
              void setQuery({ moderation: value as ModerationFilter, page: 1 })
          }}
        >
          <SelectTrigger aria-label="Lọc kiểm duyệt chương" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {moderationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          className="sm:col-span-2 md:col-span-1"
          disabled={chapters.isFetching}
          onClick={() => void chapters.refetch()}
          variant="secondary"
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={chapters.isFetching ? "animate-spin" : undefined}
            data-icon="inline-start"
          />
          Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:hidden">
        {sortFields.map(({ label, value }) => {
          const active = query.sort === value
          const Icon = active
            ? query.direction === "asc"
              ? ArrowUpIcon
              : ArrowDownIcon
            : ArrowUpDownIcon
          return (
            <Button
              aria-pressed={active}
              key={value}
              onClick={() => setSort(value)}
              size="sm"
              variant={active ? "secondary" : "outline"}
            >
              {label}
              <Icon aria-hidden="true" data-icon="inline-end" />
            </Button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {query.state !== "all" || query.moderation !== "all"
                ? "Không tìm thấy chương phù hợp"
                : "Truyện chưa có chương"}
            </EmptyTitle>
            <EmptyDescription>
              {query.state !== "all" || query.moderation !== "all"
                ? "Hãy thử bộ lọc khác."
                : "Các chương của truyện sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {chapters.data.meta.total.toLocaleString("vi-VN")} chương
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((chapter) => (
              <ChapterMobileItem
                chapter={chapter}
                key={chapter.id}
                manga={manga.data.data}
                onAction={openDialog}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách chương của {manga.data.data.title}
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <SortableHead
                    direction={query.direction}
                    label="VOLUME"
                    onSort={setSort}
                    sort={query.sort}
                    value="volume"
                  />
                  <SortableHead
                    direction={query.direction}
                    label="CHAPTER"
                    onSort={setSort}
                    sort={query.sort}
                    value="chapter"
                  />
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Hiển thị</TableHead>
                  <TableHead>Kiểm duyệt</TableHead>
                  <TableHead>Trang</TableHead>
                  <SortableHead
                    direction={query.direction}
                    label="CẬP NHẬT"
                    onSort={setSort}
                    sort={query.sort}
                    value="updatedAt"
                  />
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((chapter) => (
                  <ChapterRow
                    chapter={chapter}
                    key={chapter.id}
                    manga={manga.data.data}
                    onAction={openDialog}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            ariaLabel="Phân trang chương"
            currentPage={chapters.data.meta.page}
            disabled={chapters.isFetching}
            onPageChange={(nextPage) => setQuery({ page: nextPage })}
            totalPages={chapters.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setTarget(null)
            setReason("")
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {target?.action === "delete"
                ? "Xóa chương?"
                : target?.chapter.moderationHiddenAt
                  ? "Gỡ ẩn chương?"
                  : "Ẩn chương?"}
            </DialogTitle>
            <DialogDescription>
              {target?.action === "delete"
                ? `${chapterLabel(target.chapter)} sẽ biến mất khỏi danh sách và trang đọc.`
                : target?.chapter.moderationHiddenAt
                  ? `Gỡ chặn ${chapterLabel(target.chapter)}. Chương vẫn không công khai nếu truyện hoặc nhóm đang ẩn nội dung.`
                  : `${target ? chapterLabel(target.chapter) : "Chương"} sẽ bị chặn khỏi trang đọc công khai.`}
            </DialogDescription>
          </DialogHeader>
          {target?.action === "visibility" &&
          !target.chapter.moderationHiddenAt ? (
            <Field>
              <FieldLabel htmlFor="admin-chapter-reason">Lý do ẩn</FieldLabel>
              <Textarea
                id="admin-chapter-reason"
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Nhập lý do ẩn chương..."
                rows={4}
                value={reason}
              />
            </Field>
          ) : null}
          {mutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {mutation.error instanceof AdminChapterError &&
              mutation.error.status === 409
                ? "Trạng thái chương đã thay đổi. Hãy làm mới danh sách rồi thử lại."
                : mutation.error instanceof Error
                  ? mutation.error.message
                  : "Không thể cập nhật chương."}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                setTarget(null)
                setReason("")
              }}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={
                !canSubmitAdminChapterAction(target, mutation.isPending, reason)
              }
              onClick={() => {
                if (target)
                  mutation.mutate({ ...target, reason: reason.trim() })
              }}
              type="button"
              variant={
                target?.action === "visibility" &&
                target.chapter.moderationHiddenAt
                  ? "default"
                  : "destructive"
              }
            >
              {mutation.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {mutation.isPending
                ? "Đang cập nhật…"
                : target?.action === "delete"
                  ? "Xóa chương"
                  : target?.chapter.moderationHiddenAt
                    ? "Gỡ ẩn"
                    : "Ẩn chương"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
