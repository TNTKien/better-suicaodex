"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"

import { PagePagination } from "@/components/page-pagination"
import { formatVietnamDateTimeInline } from "@/lib/date"
import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import type { components } from "@/src/lib/generated/api"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
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

import { MangaInformation } from "./manga-information"

type ApiError = components["schemas"]["ApiError"]
type Chapter = components["schemas"]["ChapterManagementSummary"]
type Manga = components["schemas"]["MangaManagementDetail"]
type MyGroup = components["schemas"]["MyGroup"]
type ChapterPage = {
  data: Chapter[]
  meta: components["schemas"]["PageMeta"]
}
type SortField = "volume" | "chapter" | "updatedAt"
type SortDirection = "asc" | "desc"

const limit = 20
const filters = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(["volume", "chapter", "updatedAt"]).withDefault(
    "updatedAt"
  ),
  direction: parseAsStringLiteral(["desc", "asc"]).withDefault("desc"),
}
const sortFields = [
  { value: "volume", label: "VOL" },
  { value: "chapter", label: "CHAPTER" },
  { value: "updatedAt", label: "CẬP NHẬT" },
] as const satisfies ReadonlyArray<{ value: SortField; label: string }>

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
    throw new Error(error?.message ?? "Không thể tải danh sách chương.")
  }
  return body as T
}

function chapterListPath(
  groupId: string,
  mangaId: string,
  page: number,
  sort: SortField,
  direction: SortDirection
) {
  const query = new URLSearchParams({
    direction,
    limit: String(limit),
    page: String(page),
    sort,
  })
  return `/v1/contribution/groups/${encodeURIComponent(groupId)}/manga/${encodeURIComponent(mangaId)}/chapters?${query}`
}

function chapterListHref(
  mangaId: string,
  page: number,
  sort: SortField,
  direction: SortDirection
) {
  const query = new URLSearchParams()
  if (sort !== "updatedAt") query.set("sort", sort)
  if (direction !== "desc") query.set("direction", direction)
  if (page > 1) query.set("page", String(page))
  const value = query.toString()
  return `/manage/manga/${mangaId}/chapters${value ? `?${value}` : ""}`
}

function chapterLabel(chapter: Chapter) {
  const number = chapter.number ? `Ch. ${chapter.number}` : "Oneshot"
  return chapter.volume ? `Vol. ${chapter.volume.number} - ${number}` : number
}

function publicationLabel(chapter: Chapter) {
  if (chapter.processingState === "queued") return "Đang chờ"
  if (chapter.processingState === "processing") return "Đang xử lý"
  if (chapter.processingState === "failed") return "Xử lý lỗi"
  return chapter.publicationState === "draft" ? "Nháp" : "Đã đăng"
}

function publicationVariant(chapter: Chapter) {
  if (chapter.processingState === "failed") return "destructive" as const
  if (chapter.processingState !== "idle") return "secondary" as const
  return chapter.publicationState === "draft"
    ? ("secondary" as const)
    : ("default" as const)
}

function chapterPageCount(chapter: Chapter) {
  return chapter.publicationState === "draft"
    ? chapter.stagedPageCount
    : chapter.pageCount
}

function ChapterModerationState({ chapter }: { chapter: Chapter }) {
  if (!chapter.moderationHiddenAt) return null

  return (
    <div className="flex max-w-72 flex-col items-start gap-1.5">
      <Badge variant="destructive">Bị quản trị viên ẩn</Badge>
      {chapter.moderationReason ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {chapter.moderationReason}
        </span>
      ) : null}
    </div>
  )
}

function chapterIsReadable(chapter: Chapter) {
  return (
    chapter.publicationState === "published" &&
    chapter.processingState === "idle" &&
    chapter.isFull &&
    chapter.availablePageCount > 0
  )
}

function SortableTableHead({
  direction,
  label,
  onSort,
  sort,
  value,
}: {
  direction: SortDirection
  label: string
  onSort: (sort: SortField) => void
  sort: SortField
  value: SortField
}) {
  const active = sort === value
  const SortIcon = active
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
        <SortIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </TableHead>
  )
}

type ChapterActionsProps = {
  canDelete: boolean
  canEdit: boolean
  canRead: boolean
  chapter: Chapter
  onDelete: (chapter: Chapter) => void
}

function ChapterActions({
  canDelete,
  canEdit,
  canRead,
  chapter,
  onDelete,
}: ChapterActionsProps) {
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
        <DropdownMenuGroup>
          {canRead ? (
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
          {canEdit ? (
            <DropdownMenuItem
              render={
                <Link
                  href={`/manage/manga/${chapter.mangaId}/chapters/${chapter.id}/edit`}
                  prefetch={false}
                />
              }
            >
              <PencilIcon aria-hidden="true" />
              Chỉnh sửa
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <DropdownMenuItem
              onClick={() => onDelete(chapter)}
              variant="destructive"
            >
              <Trash2Icon aria-hidden="true" />
              Xóa chương
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChapterTableRow(props: ChapterActionsProps) {
  const { chapter } = props
  return (
    <TableRow>
      <TableCell className="font-medium">
        {chapter.volume ? `Vol. ${chapter.volume.number}` : "-"}
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
        <div className="flex flex-col items-start gap-1.5">
          <Badge variant={publicationVariant(chapter)}>
            {chapter.processingState === "queued" ||
            chapter.processingState === "processing" ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            {publicationLabel(chapter)}
          </Badge>
          <ChapterModerationState chapter={chapter} />
        </div>
      </TableCell>
      <TableCell>{chapterPageCount(chapter).toLocaleString("vi-VN")}</TableCell>
      <TableCell>{formatVietnamDateTimeInline(chapter.updatedAt)}</TableCell>
      <TableCell className="text-right">
        {props.canRead || props.canEdit || props.canDelete ? (
          <ChapterActions {...props} />
        ) : (
          "-"
        )}
      </TableCell>
    </TableRow>
  )
}

function ChapterMobileItem(props: ChapterActionsProps) {
  const { chapter } = props
  return (
    <article className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">{chapterLabel(chapter)}</h2>
            <Badge className="shrink-0" variant={publicationVariant(chapter)}>
              {publicationLabel(chapter)}
            </Badge>
          </div>
          <p className="line-clamp-2 text-sm wrap-break-word text-muted-foreground">
            {chapter.title || "Không có tiêu đề"}
          </p>
        </div>

        {props.canRead || props.canEdit || props.canDelete ? (
          <ChapterActions {...props} />
        ) : null}
      </div>
      <ChapterModerationState chapter={chapter} />
      <p className="text-xs text-muted-foreground">
        {chapterPageCount(chapter).toLocaleString("vi-VN")} trang · Cập nhật{" "}
        {formatVietnamDateTimeInline(chapter.updatedAt)}
      </p>
    </article>
  )
}

function ChapterListError({
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
          <Button onClick={onRetry} type="button" variant="outline">
            Thử lại
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

export function ChapterList({ mangaId }: { mangaId: string }) {
  const account = useAccount()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null)
  const [query, setQuery] = useQueryStates(filters, { history: "push" })
  const page = Math.max(1, query.page)
  const mine = useQuery({
    queryKey: ["account", account.apiBaseUrl, account.user?.id, "groups", "me"],
    enabled: account.status === "authenticated",
    queryFn: ({ signal }) =>
      request<MyGroup>(account.apiBaseUrl, "/v1/me/groups", {}, signal),
    staleTime: 30_000,
    retry: false,
  })
  const membership = mine.data?.data
  const groupAvailable = Boolean(
    account.account?.profile.status === "active" &&
    membership &&
    membership.group.approvalStatus === "approved" &&
    membership.group.publicationState === "published" &&
    !membership.group.inactive &&
    (mine.data?.isAdmin || membership.membership.status === "approved")
  )
  const groupId = groupAvailable ? (membership?.group.id ?? null) : null
  const manga = useQuery({
    queryKey: ["manga-management", account.apiBaseUrl, groupId, mangaId],
    enabled: Boolean(groupId),
    queryFn: ({ signal }) =>
      request<{ data: Manga }>(
        account.apiBaseUrl,
        `/v1/contribution/groups/${encodeURIComponent(groupId!)}/manga/${encodeURIComponent(mangaId)}`,
        {},
        signal
      ),
    staleTime: 30_000,
    retry: false,
  })
  const chapters = useQuery({
    queryKey: [
      "group-chapters",
      account.apiBaseUrl,
      groupId,
      mangaId,
      page,
      query.sort,
      query.direction,
    ],
    enabled: Boolean(groupId && manga.data),
    queryFn: ({ signal }) =>
      request<ChapterPage>(
        account.apiBaseUrl,
        chapterListPath(groupId!, mangaId, page, query.sort, query.direction),
        {},
        signal
      ),
    placeholderData: (previous) => previous,
    retry: false,
  })
  const remove = useMutation({
    mutationFn: (chapter: Chapter) =>
      request<void>(
        account.apiBaseUrl,
        `/v1/contribution/groups/${encodeURIComponent(groupId!)}/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapter.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ expectedVersion: chapter.version }),
          headers: { "Content-Type": "application/json" },
        }
      ),
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.add({ type: "success", title: "Đã xóa chương" })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["group-chapters", account.apiBaseUrl, groupId, mangaId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["manga-management", account.apiBaseUrl, groupId, mangaId],
        }),
      ])
    },
  })

  if (
    account.status === "loading" ||
    (account.status === "authenticated" && mine.isPending)
  )
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
          href={loginHref(`/manage/manga/${mangaId}/chapters`)}
        >
          Đăng nhập
        </Link>
      </Alert>
    )
  if (account.status === "error" || mine.isError)
    return (
      <ChapterListError
        message="Không thể tải thông tin nhóm dịch."
        onRetry={() =>
          void (account.status === "error" ? account.retry() : mine.refetch())
        }
      />
    )
  if (!groupId || !membership)
    return (
      <ChapterListError message="Bạn cần thuộc một nhóm đã được duyệt để xem danh sách này." />
    )
  if (manga.isPending)
    return (
      <Spinner aria-label="Đang tải danh sách chương" className="self-center" />
    )
  if (manga.isError)
    return (
      <ChapterListError
        message={manga.error.message}
        onRetry={() => void manga.refetch()}
      />
    )
  if (!manga.data) return <ChapterListError message="Không tìm thấy truyện." />
  if (chapters.isPending)
    return (
      <Spinner aria-label="Đang tải danh sách chương" className="self-center" />
    )
  if (chapters.isError)
    return (
      <ChapterListError
        message={chapters.error.message}
        onRetry={() => void chapters.refetch()}
      />
    )

  const mangaModerated = Boolean(manga.data.data.moderationHiddenAt)
  const isAdmin = mine.data?.isAdmin ?? false
  const canAdd =
    !mangaModerated &&
    (isAdmin || membership.membership.permissions.canAddChapter)
  const canEdit =
    !mangaModerated &&
    (isAdmin || membership.membership.permissions.canEditChapter)
  const canDelete =
    !mangaModerated &&
    (isAdmin || membership.membership.permissions.canDeleteChapter)
  const items = chapters.data.data
  const openDeleteDialog = (chapter: Chapter) => {
    remove.reset()
    setDeleteTarget(chapter)
  }
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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MangaInformation manga={manga.data.data} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <div className="grid grid-cols-3 gap-2 md:hidden">
          {sortFields.map(({ label, value }) => {
            const active = query.sort === value
            const SortIcon = active
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
                type="button"
                variant={active ? "secondary" : "outline"}
              >
                {label}
                <SortIcon aria-hidden="true" data-icon="inline-end" />
              </Button>
            )
          })}
        </div>
        <Button
          className="w-full md:w-auto"
          disabled={chapters.isFetching}
          onClick={() => void chapters.refetch()}
          type="button"
          variant="secondary"
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={chapters.isFetching ? "animate-spin" : undefined}
            data-icon="inline-start"
          />
          Làm mới
        </Button>
        {canAdd ? (
          <Link
            className={buttonVariants({
              className: "w-full md:w-auto",
            })}
            href={`/manage/manga/${mangaId}/chapters/new`}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Thêm chương mới
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Truyện chưa có chương</EmptyTitle>
            <EmptyDescription>
              Các chương của truyện sẽ xuất hiện tại đây.
            </EmptyDescription>
          </EmptyHeader>
          {canAdd ? (
            <EmptyContent>
              <Link
                className={buttonVariants()}
                href={`/manage/manga/${mangaId}/chapters/new`}
              >
                <PlusIcon aria-hidden="true" data-icon="inline-start" />
                Thêm chương mới
              </Link>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <>
          {/* <p className="text-sm text-muted-foreground">
            {chapters.data.meta.total.toLocaleString("vi-VN")} chương
          </p> */}
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((chapter) => (
              <ChapterMobileItem
                canDelete={
                  canDelete &&
                  !chapter.moderationHiddenAt &&
                  (isAdmin || chapter.isOwner)
                }
                canEdit={canEdit && !chapter.moderationHiddenAt}
                canRead={
                  !mangaModerated &&
                  !chapter.moderationHiddenAt &&
                  chapterIsReadable(chapter)
                }
                chapter={chapter}
                key={chapter.id}
                onDelete={openDeleteDialog}
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
                  <SortableTableHead
                    direction={query.direction}
                    label="VOLUME"
                    onSort={setSort}
                    sort={query.sort}
                    value="volume"
                  />
                  <SortableTableHead
                    direction={query.direction}
                    label="CHAPTER"
                    onSort={setSort}
                    sort={query.sort}
                    value="chapter"
                  />
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Số Trang</TableHead>
                  <SortableTableHead
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
                  <ChapterTableRow
                    canDelete={
                      canDelete &&
                      !chapter.moderationHiddenAt &&
                      (isAdmin || chapter.isOwner)
                    }
                    canEdit={canEdit && !chapter.moderationHiddenAt}
                    canRead={
                      !mangaModerated &&
                      !chapter.moderationHiddenAt &&
                      chapterIsReadable(chapter)
                    }
                    chapter={chapter}
                    key={chapter.id}
                    onDelete={openDeleteDialog}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <PagePagination
            ariaLabel="Phân trang chương"
            currentPage={chapters.data.meta.page}
            getPageHref={(nextPage) =>
              chapterListHref(mangaId, nextPage, query.sort, query.direction)
            }
            totalPages={chapters.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleteTarget(null)
            remove.reset()
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (deleteTarget) remove.mutate(deleteTarget)
            }}
          >
            <DialogHeader>
              <DialogTitle>Xóa chương?</DialogTitle>
              <DialogDescription>
                {deleteTarget
                  ? `${chapterLabel(deleteTarget)} sẽ bị xóa khỏi hệ thống.`
                  : "Chương sẽ bị xóa khỏi hệ thống."}
              </DialogDescription>
            </DialogHeader>
            {remove.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {remove.error.message}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={remove.isPending}
                onClick={() => {
                  setDeleteTarget(null)
                  remove.reset()
                }}
                type="button"
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                disabled={remove.isPending}
                type="submit"
                variant="destructive"
              >
                {remove.isPending ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <Trash2Icon aria-hidden="true" data-icon="inline-start" />
                )}
                {remove.isPending ? "Đang xóa…" : "Xóa chương"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
