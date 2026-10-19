"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BookOpenIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  ListIcon,
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

import { AssetImage } from "@/components/asset-image"
import { PagePagination } from "@/components/page-pagination"
import { formatVietnamDateTimeInline } from "@/lib/date"
import { cover256, mangaStatusLabel } from "@/lib/catalog"
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

type ApiError = components["schemas"]["ApiError"]
type Manga = components["schemas"]["MangaManagementSummary"]
type MyGroup = components["schemas"]["MyGroup"]
type MangaPage = {
  data: Manga[]
  meta: components["schemas"]["PageMeta"]
}
type PublicationFilter = "all" | Manga["publicationState"]

const limit = 20
const publicationFilters = [
  { value: "all", label: "Tất cả" },
  { value: "published", label: "Đang hiển thị" },
  { value: "hidden", label: "Đang ẩn" },
] as const satisfies ReadonlyArray<{
  value: PublicationFilter
  label: string
}>
const listParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  state: parseAsStringLiteral(["all", "published", "hidden"]).withDefault(
    "all"
  ),
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
    throw new Error(error?.message ?? "Không thể tải danh sách truyện.")
  }
  return body as T
}

function mangaListPath(
  groupId: string,
  page: number,
  query: string,
  state: PublicationFilter
) {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
  })
  if (query) params.set("q", query)
  if (state !== "all") params.set("publicationState", state)
  return `/v1/contribution/groups/${encodeURIComponent(groupId)}/manga?${params}`
}

function groupMangaHref(page: number, query: string, state: PublicationFilter) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (state !== "all") params.set("state", state)
  if (page > 1) params.set("page", String(page))
  const value = params.toString()
  return `/manage/group/mangas${value ? `?${value}` : ""}`
}

function MangaListError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Không thể tải truyện của nhóm</AlertTitle>
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

type MangaActionsProps = {
  canChangeVisibility: boolean
  canDelete: boolean
  canEdit: boolean
  manga: Manga
  onDelete: (manga: Manga) => void
  onVisibility: (manga: Manga) => void
}

function MangaActions({
  canChangeVisibility,
  canDelete,
  canEdit,
  manga,
  onDelete,
  onVisibility,
}: MangaActionsProps) {
  if (manga.moderationHiddenAt) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Hành động cho truyện ${manga.title}`}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {manga.publicationState === "published" ? (
          <DropdownMenuItem
            render={
              <Link
                href={`/manga/${manga.id}/${manga.slug}`}
                prefetch={false}
                target="_blank"
              />
            }
          >
            <EyeIcon aria-hidden="true" />
            Xem truyện
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem
            render={
              <Link href={`/manage/manga/${manga.id}/edit`} prefetch={false} />
            }
          >
            <PencilIcon aria-hidden="true" />
            Chỉnh sửa
          </DropdownMenuItem>
        ) : null}
        {canChangeVisibility ? (
          <DropdownMenuItem onClick={() => onVisibility(manga)}>
            {manga.publicationState === "hidden" ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeOffIcon aria-hidden="true" />
            )}
            {manga.publicationState === "hidden" ? "Hiện truyện" : "Ẩn truyện"}
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem
            onClick={() => onDelete(manga)}
            variant="destructive"
          >
            <Trash2Icon aria-hidden="true" />
            Xóa truyện
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MangaVisibility({ manga }: { manga: Manga }) {
  return (
    <div className="flex max-w-72 flex-col items-start gap-1.5">
      <Badge
        variant={manga.publicationState === "hidden" ? "secondary" : "default"}
      >
        {manga.publicationState === "hidden" ? "Đang ẩn" : "Đang hiển thị"}
      </Badge>
      {manga.moderationHiddenAt ? (
        <>
          <Badge variant="destructive">Bị quản trị viên ẩn</Badge>
          {manga.moderationReason ? (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {manga.moderationReason}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function MangaTableRow({
  canChangeVisibility,
  canDelete,
  canEdit,
  manga,
  onDelete,
  onVisibility,
}: MangaActionsProps) {
  const cover = manga.cover as Manga["cover"] | null
  const alternativeTitle = Object.values(manga.alternativeTitles).flat()[0]

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-64 items-center gap-3">
          <div className="aspect-5/7 w-12 shrink-0 overflow-hidden rounded-md">
            <AssetImage
              alt={`Bìa truyện ${manga.title}`}
              className="size-full object-cover"
              height={cover?.height ?? 1_000}
              src={cover256(cover?.url ?? null)}
              width={cover?.width ?? 700}
            />
          </div>
          <div className="max-w-96 min-w-0">
            <span className="line-clamp-2 font-medium wrap-break-word">
              {manga.title}
            </span>
            {alternativeTitle ? (
              <span className="block truncate text-sm text-muted-foreground">
                {alternativeTitle}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <MangaVisibility manga={manga} />
      </TableCell>
      <TableCell>{mangaStatusLabel(manga.status)}</TableCell>
      <TableCell>{formatVietnamDateTimeInline(manga.updatedAt)}</TableCell>
      <TableCell>
        <Link
          className={buttonVariants({ size: "sm", variant: "secondary" })}
          href={`/manage/manga/${manga.id}/chapters`}
          prefetch={false}
        >
          <ListIcon aria-hidden="true" data-icon="inline-start" />
          {manga.moderationHiddenAt ? "Xem chương" : "QL Chương"}
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <MangaActions
          canChangeVisibility={canChangeVisibility}
          canDelete={canDelete}
          canEdit={canEdit}
          manga={manga}
          onDelete={onDelete}
          onVisibility={onVisibility}
        />
      </TableCell>
    </TableRow>
  )
}

function MangaMobileItem(props: MangaActionsProps) {
  const { manga } = props
  const cover = manga.cover as Manga["cover"] | null
  const alternativeTitle = Object.values(manga.alternativeTitles).flat()[0]

  return (
    <article className="flex gap-3 p-3">
      <div className="aspect-5/7 w-28 shrink-0 overflow-hidden rounded-md">
        <AssetImage
          alt={`Bìa truyện ${manga.title}`}
          className="size-full object-cover"
          height={cover?.height ?? 1_000}
          src={cover256(cover?.url ?? null)}
          width={cover?.width ?? 700}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="line-clamp-2 font-medium wrap-break-word">
              {manga.title}
            </h2>
            {alternativeTitle ? (
              <p className="truncate text-sm text-muted-foreground">
                {alternativeTitle}
              </p>
            ) : null}
          </div>
          <MangaActions {...props} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MangaVisibility manga={manga} />
          <Badge variant="outline">{mangaStatusLabel(manga.status)}</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cập nhật {formatVietnamDateTimeInline(manga.updatedAt)}
        </p>
        <Link
          className={buttonVariants({
            className: "mt-3 w-full",
            size: "sm",
            variant: "secondary",
          })}
          href={`/manage/manga/${manga.id}/chapters`}
          prefetch={false}
        >
          <ListIcon aria-hidden="true" data-icon="inline-start" />
          {manga.moderationHiddenAt ? "Xem chương" : "QL Chương"}
        </Link>
      </div>
    </article>
  )
}

export function GroupMangaList() {
  const account = useAccount()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Manga | null>(null)
  const [visibilityTarget, setVisibilityTarget] = useState<Manga | null>(null)
  const [filters, setFilters] = useQueryStates(listParams, {
    history: "push",
  })
  const page = Math.max(1, filters.page)
  const query = filters.q.trim().replace(/\s+/g, " ")
  const mine = useQuery({
    queryKey: ["account", account.apiBaseUrl, account.user?.id, "groups", "me"],
    enabled: account.status === "authenticated",
    queryFn: ({ signal }) =>
      request<MyGroup>(account.apiBaseUrl, "/v1/me/groups", {}, signal),
    staleTime: 30_000,
    retry: false,
  })
  const membership = mine.data?.data
  const groupId =
    account.account?.profile.status === "active" &&
    membership?.group.approvalStatus === "approved" &&
    membership.group.publicationState === "published" &&
    !membership.group.inactive &&
    (mine.data?.isAdmin || membership.membership.status === "approved")
      ? membership.group.id
      : null
  const mangaList = useQuery({
    queryKey: [
      "group-manga",
      account.apiBaseUrl,
      groupId,
      page,
      query,
      filters.state,
    ],
    enabled: Boolean(groupId),
    queryFn: ({ signal }) =>
      request<MangaPage>(
        account.apiBaseUrl,
        mangaListPath(groupId!, page, query, filters.state),
        {},
        signal
      ),
    placeholderData: (previous) => previous,
    retry: false,
  })
  const visibility = useMutation({
    mutationFn: (manga: Manga) =>
      request<{ data: Manga }>(
        account.apiBaseUrl,
        `/v1/contribution/groups/${encodeURIComponent(groupId!)}/manga/${encodeURIComponent(manga.id)}/visibility`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: manga.version,
            hidden: manga.publicationState === "published",
          }),
          headers: { "Content-Type": "application/json" },
        }
      ),
    onSuccess: async (_data, manga) => {
      setVisibilityTarget(null)
      toast.add({
        type: "success",
        title:
          manga.publicationState === "published"
            ? "Đã ẩn truyện"
            : "Đã hiện truyện",
      })
      await queryClient.invalidateQueries({
        queryKey: ["group-manga", account.apiBaseUrl, groupId],
      })
    },
  })
  const remove = useMutation({
    mutationFn: (manga: Manga) =>
      request<void>(
        account.apiBaseUrl,
        `/v1/contribution/groups/${encodeURIComponent(groupId!)}/manga/${encodeURIComponent(manga.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ expectedVersion: manga.version }),
          headers: { "Content-Type": "application/json" },
        }
      ),
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.add({ type: "success", title: "Đã xóa truyện" })
      await queryClient.invalidateQueries({
        queryKey: ["group-manga", account.apiBaseUrl, groupId],
      })
    },
  })

  if (
    account.status === "loading" ||
    (account.status === "authenticated" && mine.isPending)
  )
    return <Spinner aria-label="Đang tải nhóm dịch" className="self-center" />
  if (account.status === "guest")
    return (
      <Alert>
        <AlertTitle>Bạn chưa đăng nhập</AlertTitle>
        <AlertDescription>Đăng nhập để xem truyện của nhóm.</AlertDescription>
        <Link
          className={buttonVariants({ className: "mt-3 w-fit" })}
          href={loginHref("/manage/group/mangas")}
        >
          Đăng nhập
        </Link>
      </Alert>
    )
  if (account.status === "error" || mine.isError)
    return (
      <MangaListError
        message="Không thể tải thông tin nhóm dịch."
        onRetry={() =>
          void (account.status === "error" ? account.retry() : mine.refetch())
        }
      />
    )
  if (!groupId || !membership)
    return (
      <MangaListError message="Bạn cần thuộc một nhóm đã được duyệt để xem danh sách này." />
    )

  const isAdmin = mine.data?.isAdmin ?? false
  const permissions = membership.membership.permissions
  const canAdd = isAdmin || permissions.canAddManga
  const items = mangaList.data?.data ?? []
  const canEditManga = isAdmin || permissions.canEditManga
  const openDelete = (target: Manga) => {
    remove.reset()
    setDeleteTarget(target)
  }
  const openVisibility = (target: Manga) => {
    visibility.reset()
    setVisibilityTarget(target)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Các truyện thuộc nhóm {membership.group.name}
        </p>
        {canAdd ? (
          <Link className={buttonVariants()} href="/manage/manga/new">
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Thêm truyện mới
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
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
              aria-label="Tìm truyện của nhóm"
              autoComplete="off"
              defaultValue={query}
              key={query}
              name="q"
              placeholder="Tìm kiếm truyện..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {mangaList.isFetching && !mangaList.isPending ? (
                <Spinner aria-label="Đang tìm truyện" />
              ) : null}
              <InputGroupButton aria-label="Tìm kiếm" type="submit">
                Tìm
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Select
          items={publicationFilters}
          onValueChange={(value) =>
            void setFilters({ page: 1, state: value as PublicationFilter })
          }
          value={filters.state}
        >
          <SelectTrigger className="w-full" aria-label="Lọc trạng thái truyện">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {publicationFilters.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {mangaList.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách truyện"
          className="self-center"
        />
      ) : mangaList.isError ? (
        <MangaListError
          message={mangaList.error.message}
          onRetry={() => void mangaList.refetch()}
        />
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {query || filters.state !== "all"
                ? "Không tìm thấy truyện phù hợp"
                : "Nhóm chưa có truyện"}
            </EmptyTitle>
            <EmptyDescription>
              {query || filters.state !== "all"
                ? "Hãy thử từ khóa hoặc trạng thái khác."
                : "Truyện do nhóm tạo hoặc quản lý sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
          {canAdd && !query && filters.state === "all" ? (
            <EmptyContent>
              <Link className={buttonVariants()} href="/manage/manga/new">
                <PlusIcon aria-hidden="true" data-icon="inline-start" />
                Thêm truyện mới
              </Link>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {mangaList.data.meta.total.toLocaleString("vi-VN")} truyện
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((manga) => (
              <MangaMobileItem
                canChangeVisibility={
                  isAdmin || (manga.isOwner && permissions.canEditManga)
                }
                canDelete={
                  isAdmin || (manga.isOwner && permissions.canDeleteManga)
                }
                canEdit={canEditManga}
                key={manga.id}
                manga={manga}
                onDelete={openDelete}
                onVisibility={openVisibility}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách truyện của nhóm {membership.group.name}
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>Truyện</TableHead>
                  <TableHead>Hiển thị</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Cập nhật</TableHead>
                  <TableHead>Chương</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((manga) => (
                  <MangaTableRow
                    canChangeVisibility={
                      isAdmin || (manga.isOwner && permissions.canEditManga)
                    }
                    canDelete={
                      isAdmin || (manga.isOwner && permissions.canDeleteManga)
                    }
                    canEdit={canEditManga}
                    key={manga.id}
                    manga={manga}
                    onDelete={openDelete}
                    onVisibility={openVisibility}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <PagePagination
            ariaLabel="Phân trang truyện của nhóm"
            currentPage={mangaList.data.meta.page}
            getPageHref={(nextPage) =>
              groupMangaHref(nextPage, query, filters.state)
            }
            totalPages={mangaList.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={Boolean(visibilityTarget)}
        onOpenChange={(open) => {
          if (!open && !visibility.isPending) setVisibilityTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {visibilityTarget?.publicationState === "published"
                ? "Ẩn truyện?"
                : "Hiện truyện?"}
            </DialogTitle>
            <DialogDescription>
              {visibilityTarget?.publicationState === "published"
                ? `“${visibilityTarget.title}” sẽ không còn xuất hiện trên các trang công khai. Bạn vẫn có thể quản lý truyện và chương.`
                : `“${visibilityTarget?.title ?? "Truyện"}” sẽ xuất hiện trở lại trên các trang công khai.`}
            </DialogDescription>
          </DialogHeader>
          {visibility.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {visibility.error.message}
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
            >
              {visibility.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {visibility.isPending
                ? "Đang cập nhật…"
                : visibilityTarget?.publicationState === "published"
                  ? "Ẩn truyện"
                  : "Hiện truyện"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleteTarget(null)
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
              <DialogTitle>Xóa truyện?</DialogTitle>
              <DialogDescription>
                {deleteTarget
                  ? `“${deleteTarget.title}” sẽ bị xóa khỏi hệ thống.`
                  : "Truyện sẽ bị xóa khỏi hệ thống."}
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
                {remove.isPending ? "Đang xóa…" : "Xóa truyện"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
