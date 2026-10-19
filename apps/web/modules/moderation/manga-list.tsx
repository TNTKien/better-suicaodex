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
  BookOpenIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  ListIcon,
  PencilIcon,
  SearchIcon,
  ScrollTextIcon,
  Trash2Icon,
} from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { formatVietnamDateTimeInline } from "@/lib/date"
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

type MangaPage =
  paths["/v1/admin/manga"]["get"]["responses"][200]["content"]["application/json"]
type Manga = MangaPage["data"][number]
type VisibilityResponse =
  paths["/v1/admin/manga/{id}/visibility"]["put"]["responses"][200]["content"]["application/json"]
type ApiError = components["schemas"]["ApiError"]
type PublicationFilter = Manga["publicationState"] | "all"
type ModerationFilter = "all" | "hidden" | "visible"
type MangaAction = "visibility" | "delete"
type MangaActionTarget = { manga: Manga; action: MangaAction }
type MangaActionInput = MangaActionTarget & { reason: string }

const limit = 20
const publicationOptions = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đang hiển thị", value: "published" },
  { label: "Nhóm đang ẩn", value: "hidden" },
  { label: "Nháp", value: "draft" },
] as const satisfies ReadonlyArray<{
  label: string
  value: PublicationFilter
}>
const moderationOptions = [
  { label: "Tất cả kiểm duyệt", value: "all" },
  { label: "Bình thường", value: "visible" },
  { label: "Bị quản trị viên ẩn", value: "hidden" },
] as const satisfies ReadonlyArray<{
  label: string
  value: ModerationFilter
}>
const listParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
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
const publicationLabels: Record<Manga["publicationState"], string> = {
  draft: "Nháp",
  published: "Đang hiển thị",
  hidden: "Nhóm đang ẩn",
}

class AdminMangaError extends Error {
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
    throw new AdminMangaError(
      response.status,
      apiError?.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
    )
  }
  return body as T
}

export function adminMangasPath(
  page: number,
  query = "",
  publication: PublicationFilter = "all",
  moderation: ModerationFilter = "all"
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (query.trim()) params.set("q", query.trim())
  if (publication !== "all") params.set("publicationState", publication)
  if (moderation !== "all") params.set("moderation", moderation)
  return `/v1/admin/manga?${params}`
}

export function adminMangaQueryKey(
  apiBaseUrl: string,
  userId: string | undefined
) {
  return ["account", apiBaseUrl, userId, "admin-mangas"] as const
}

export function canSubmitAdminMangaAction(
  target: MangaActionTarget | null,
  pending: boolean,
  reason: string
) {
  return Boolean(
    target &&
    !pending &&
    (target.action !== "visibility" ||
      target.manga.moderationHiddenAt ||
      reason.trim())
  )
}

export function runAdminMangaAction(
  apiBaseUrl: string,
  { manga, action, reason }: MangaActionInput
) {
  return request<VisibilityResponse | null>(
    apiBaseUrl,
    `/v1/admin/manga/${encodeURIComponent(manga.id)}${action === "visibility" ? "/visibility" : ""}`,
    {
      method: action === "delete" ? "DELETE" : "PUT",
      body: JSON.stringify({
        ...(action === "visibility"
          ? {
              hidden: !manga.moderationHiddenAt,
              ...(!manga.moderationHiddenAt ? { reason } : {}),
            }
          : {}),
        expectedVersion: manga.version,
      }),
      headers: { "Content-Type": "application/json" },
    }
  )
}

export function invalidateAdminMangaQueries(
  queryClient: QueryClient,
  apiBaseUrl: string,
  userId: string | undefined
) {
  return queryClient.invalidateQueries({
    queryKey: adminMangaQueryKey(apiBaseUrl, userId),
  })
}

function publicationVariant(state: Manga["publicationState"]) {
  return state === "published" ? "default" : "secondary"
}

function MangaActions({
  manga,
  onAction,
}: {
  manga: Manga
  onAction: (manga: Manga, action: MangaAction) => void
}) {
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
        {manga.publicationState === "published" && !manga.moderationHiddenAt ? (
          <DropdownMenuItem
            render={
              <Link
                href={`/manga/${manga.id}/${manga.slug}`}
                prefetch={false}
                rel="noopener noreferrer"
                target="_blank"
              />
            }
          >
            <EyeIcon aria-hidden="true" />
            Xem truyện
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          render={
            <Link href={`/admin/manga/${manga.id}/edit`} prefetch={false} />
          }
        >
          <PencilIcon aria-hidden="true" />
          Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <Link
              href={`/admin/audit?targetKind=manga&targetId=${encodeURIComponent(manga.id)}`}
            />
          }
        >
          <ScrollTextIcon aria-hidden="true" />
          Xem nhật ký
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction(manga, "visibility")}
          variant={manga.moderationHiddenAt ? "default" : "destructive"}
        >
          {manga.moderationHiddenAt ? (
            <EyeIcon aria-hidden="true" />
          ) : (
            <EyeOffIcon aria-hidden="true" />
          )}
          {manga.moderationHiddenAt ? "Gỡ ẩn" : "Ẩn truyện"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction(manga, "delete")}
          variant="destructive"
        >
          <Trash2Icon aria-hidden="true" />
          Xóa truyện
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModerationState({ manga }: { manga: Manga }) {
  return (
    <div className="flex max-w-72 flex-col items-start gap-1.5">
      <Badge variant={manga.moderationHiddenAt ? "destructive" : "outline"}>
        {manga.moderationHiddenAt ? "Bị quản trị viên ẩn" : "Bình thường"}
      </Badge>
      {manga.moderationReason ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {manga.moderationReason}
        </span>
      ) : null}
    </div>
  )
}

function MangaTableRow({
  manga,
  onAction,
}: {
  manga: Manga
  onAction: (manga: Manga, action: MangaAction) => void
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="max-w-112 min-w-64">
          <span className="line-clamp-2 font-medium wrap-break-word">
            {manga.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {manga.id}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={publicationVariant(manga.publicationState)}>
          {publicationLabels[manga.publicationState]}
        </Badge>
      </TableCell>
      <TableCell>
        <ModerationState manga={manga} />
      </TableCell>
      <TableCell>{formatVietnamDateTimeInline(manga.updatedAt)}</TableCell>
      <TableCell>
        <Link
          className={buttonVariants({ size: "sm", variant: "secondary" })}
          href={`/admin/manga/${manga.id}/chapter`}
          prefetch={false}
        >
          <ListIcon aria-hidden="true" data-icon="inline-start" />
          QL Chương
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <MangaActions manga={manga} onAction={onAction} />
      </TableCell>
    </TableRow>
  )
}

function MangaMobileItem({
  manga,
  onAction,
}: {
  manga: Manga
  onAction: (manga: Manga, action: MangaAction) => void
}) {
  return (
    <article className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="line-clamp-2 font-medium wrap-break-word">
            {manga.title}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{manga.id}</p>
        </div>
        <MangaActions manga={manga} onAction={onAction} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={publicationVariant(manga.publicationState)}>
          {publicationLabels[manga.publicationState]}
        </Badge>
        <ModerationState manga={manga} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Cập nhật {formatVietnamDateTimeInline(manga.updatedAt)}
      </p>
      <Link
        className={buttonVariants({
          className: "mt-3 w-full",
          size: "sm",
          variant: "secondary",
        })}
        href={`/admin/manga/${manga.id}/chapter`}
        prefetch={false}
      >
        <ListIcon aria-hidden="true" data-icon="inline-start" />
        QL Chương
      </Link>
    </article>
  )
}

function actionErrorMessage(error: unknown) {
  if (error instanceof AdminMangaError && error.status === 409)
    return "Trạng thái truyện đã thay đổi. Hãy đóng hộp thoại, tải lại danh sách rồi thử lại."
  return error instanceof Error
    ? error.message
    : "Không thể cập nhật truyện. Vui lòng thử lại."
}

export function AdminMangaList() {
  const account = useAccount()

  if (account.status !== "authenticated" || !account.user) return null

  return (
    <AdminMangaListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminMangaListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<{
    manga: Manga
    action: MangaAction
  } | null>(null)
  const [reason, setReason] = useState("")
  const [filters, setFilters] = useQueryStates(listParams, { history: "push" })
  const page = Math.max(1, filters.page)
  const query = filters.q.trim().replace(/\s+/g, " ")
  const publication = filters.state
  const moderation = filters.moderation
  const queryKey = adminMangaQueryKey(apiBaseUrl, userId)
  const mangas = useQuery({
    queryKey: [...queryKey, page, query, publication, moderation],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      request<MangaPage>(
        apiBaseUrl,
        adminMangasPath(page, query, publication, moderation),
        {},
        signal
      ),
  })
  const items = mangas.data?.data ?? []
  const action = useMutation({
    retry: false,
    mutationFn: (input: MangaActionInput) =>
      runAdminMangaAction(apiBaseUrl, input),
    onSuccess: async (_data, input) => {
      setTarget(null)
      setReason("")
      toast.add({
        type: "success",
        title:
          input.action === "delete"
            ? "Đã xóa truyện"
            : input.manga.moderationHiddenAt
              ? "Đã gỡ ẩn truyện"
              : "Đã ẩn truyện",
      })
      if (input.action === "delete" && items.length === 1 && page > 1)
        await setFilters({ page: page - 1 })
      await invalidateAdminMangaQueries(queryClient, apiBaseUrl, userId)
    },
  })
  const hasFilters = Boolean(
    query || publication !== "all" || moderation !== "all"
  )
  const openAction = (manga: Manga, nextAction: MangaAction) => {
    action.reset()
    setReason("")
    setTarget({ manga, action: nextAction })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_13rem_14rem]">
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
              aria-label="Tìm truyện theo tên hoặc ID"
              autoComplete="off"
              defaultValue={query}
              key={query}
              name="q"
              placeholder="Tìm theo tên hoặc ID..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {mangas.isFetching && !mangas.isPending ? (
                <Spinner aria-label="Đang tìm truyện" />
              ) : null}
              <InputGroupButton aria-label="Tìm kiếm" type="submit">
                Tìm
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Select
          items={publicationOptions}
          onValueChange={(value) => {
            if (value)
              void setFilters({
                page: 1,
                state: value as PublicationFilter,
              })
          }}
          value={publication}
        >
          <SelectTrigger aria-label="Lọc trạng thái truyện" className="w-full">
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
          onValueChange={(value) => {
            if (value)
              void setFilters({
                moderation: value as ModerationFilter,
                page: 1,
              })
          }}
          value={moderation}
        >
          <SelectTrigger
            aria-label="Lọc trạng thái kiểm duyệt"
            className="w-full"
          >
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
      </div>

      {mangas.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách truyện"
          className="self-center"
        />
      ) : mangas.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách truyện</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{mangas.error.message}</span>
            <Button onClick={() => void mangas.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters ? "Không tìm thấy truyện phù hợp" : "Chưa có truyện"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Hãy thử từ khóa hoặc bộ lọc khác."
                : "Danh sách truyện sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {mangas.data.meta.total.toLocaleString("vi-VN")} truyện
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((manga) => (
              <MangaMobileItem
                key={manga.id}
                manga={manga}
                onAction={openAction}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách truyện dành cho quản trị viên
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>Truyện</TableHead>
                  <TableHead>Hiển thị</TableHead>
                  <TableHead>Kiểm duyệt</TableHead>
                  <TableHead>Cập nhật</TableHead>
                  <TableHead>Chương</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((manga) => (
                  <MangaTableRow
                    key={manga.id}
                    manga={manga}
                    onAction={openAction}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            ariaLabel="Phân trang truyện"
            currentPage={page}
            disabled={mangas.isFetching}
            onPageChange={(nextPage) => setFilters({ page: nextPage })}
            totalPages={mangas.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !action.isPending) {
            setTarget(null)
            setReason("")
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {target?.action === "delete"
                ? "Xóa truyện?"
                : target?.manga.moderationHiddenAt
                  ? "Gỡ ẩn truyện?"
                  : "Ẩn truyện?"}
            </DialogTitle>
            <DialogDescription>
              {target?.action === "delete"
                ? `“${target.manga.title}” sẽ biến mất khỏi trang công khai và khu vực quản lý của nhóm. Đây là thao tác xóa mềm.`
                : target?.manga.moderationHiddenAt
                  ? `Gỡ chặn “${target.manga.title}”. Truyện vẫn không công khai nếu nhóm đang ẩn truyện.`
                  : `“${target?.manga.title ?? "Truyện"}” sẽ bị chặn khỏi các trang công khai và không thể được nhóm tự hiện lại.`}
            </DialogDescription>
          </DialogHeader>
          {target?.action === "visibility" &&
          !target.manga.moderationHiddenAt ? (
            <Field>
              <FieldLabel htmlFor="admin-manga-reason">Lý do ẩn</FieldLabel>
              <Textarea
                id="admin-manga-reason"
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Nhập lý do ẩn truyện..."
                rows={4}
                value={reason}
              />
            </Field>
          ) : null}
          {action.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {actionErrorMessage(action.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={action.isPending}
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
                !canSubmitAdminMangaAction(target, action.isPending, reason)
              }
              onClick={() => {
                if (target) action.mutate({ ...target, reason: reason.trim() })
              }}
              type="button"
              variant={
                target?.action === "visibility" &&
                target.manga.moderationHiddenAt
                  ? "default"
                  : "destructive"
              }
            >
              {action.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {action.isPending
                ? "Đang cập nhật…"
                : target?.action === "delete"
                  ? "Xóa truyện"
                  : target?.manga.moderationHiddenAt
                    ? "Gỡ ẩn"
                    : "Ẩn truyện"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
