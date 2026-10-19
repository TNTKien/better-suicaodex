"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAccount } from "@/modules/account/provider"
import { AccountApiError, accountRequest } from "@/modules/account/api"
import type { components } from "@/src/lib/generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@workspace/ui/components/empty"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

type Worker = components["schemas"]["ImageServer2Worker"]
type MangaList = components["schemas"]["ImageServer2MangaList"]
type ChapterList = components["schemas"]["ImageServer2ChapterList"]
type BatchInput = components["schemas"]["ImageServer2BatchInput"]
type BatchResult = components["schemas"]["ImageServer2BatchResult"]
type Action = BatchInput
const base = "/v1/admin/image-server2"
const readOptions = {
  gcTime: 0,
  retry: false,
  staleTime: Infinity,
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: "always",
  refetchOnReconnect: false,
} as const
const errorMessages: Record<string, string> = {
  INVALID_MANIFEST:
    "Danh sách ảnh nguồn không hợp lệ (trống, quá 220 ảnh hoặc vị trí ảnh sai).",
  JOB_RUNNING: "Chapter đang được worker xử lý.",
}
const labels = {
  missing: "Chưa xếp hàng",
  stale: "Cần cập nhật",
  pending: "Đang chờ",
  running: "Đang xử lý",
  retry_wait: "Chờ thử lại",
  ready: "Sẵn sàng",
  failed: "Lỗi",
} satisfies Record<ChapterList["data"][number]["state"], string>

async function write<T>(
  apiBaseUrl: string,
  path: string,
  method: string,
  body: unknown
): Promise<T> {
  const response = await fetch(new URL(`${base}${path}`, apiBaseUrl), {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn."
        : response.status === 403
          ? "Bạn không có quyền thực hiện thao tác này."
          : "Thao tác chưa hoàn tất. Hãy kiểm tra trạng thái rồi thử lại."
    )
  return response.json()
}

function Pager({
  page,
  hasMore,
  disabled,
  onChange,
}: {
  page: number
  hasMore: boolean
  disabled: boolean
  onChange: (page: number) => void
}) {
  return (
    <nav
      aria-label="Phân trang"
      className="flex items-center justify-end gap-3"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page === 1}
        onClick={() => onChange(page - 1)}
      >
        Trước
      </Button>
      <span className="text-sm text-muted-foreground">Trang {page}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !hasMore}
        onClick={() => onChange(page + 1)}
      >
        Sau
      </Button>
    </nav>
  )
}

function LoadState({
  pending,
  error,
  empty,
  retry,
}: {
  pending: boolean
  error: Error | null
  empty: boolean
  retry: () => void
}) {
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Không tải được dữ liệu</AlertTitle>
        <AlertDescription>
          {error instanceof AccountApiError && error.status === 404
            ? "Truyện không tồn tại hoặc không thể truy cập."
            : error.message}
          <Button variant="outline" size="sm" onClick={retry}>
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  if (pending)
    return (
      <div role="status" aria-label="Đang tải">
        <Skeleton className="h-24 w-full" />
      </div>
    )
  if (empty)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyDescription>Không có dữ liệu phù hợp.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return null
}

export function AdminImageServer2({ mangaId }: { mangaId?: string }) {
  const { apiBaseUrl, user, status } = useAccount()
  const queryClient = useQueryClient()
  const key = ["account", apiBaseUrl, user?.id, "image-server2"]
  const enabled = status === "authenticated"
  const [action, setAction] = useState<Action | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  const worker = useQuery({
    queryKey: [...key, "worker"],
    enabled,
    ...readOptions,
    queryFn: ({ signal }) =>
      accountRequest<Worker>(apiBaseUrl, `${base}/worker`, "include", signal),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const switchWorker = useMutation({
    mutationFn: (value: boolean) =>
      write<Worker>(apiBaseUrl, "/worker", "PUT", { enabled: value }),
    onMutate: () => queryClient.cancelQueries({ queryKey: [...key, "worker"] }),
    onSuccess: (value) => {
      queryClient.setQueryData([...key, "worker"], value)
      toast.add({
        type: "success",
        title: value.enabled
          ? "Đã cho phép nhận job mới"
          : "Đã tạm dừng nhận job mới",
      })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Chưa lưu được switch. Hãy kiểm tra trạng thái rồi thử lại.",
      }),
    onSettled: refresh,
  })
  const batch = useMutation({
    mutationFn: (input: BatchInput) =>
      write<BatchResult>(apiBaseUrl, "/jobs", "POST", input),
    onSuccess: (value) => {
      setResult(value)
      setAction(null)
      toast.add({
        type: value.errors.length
          ? value.applied
            ? "warning"
            : "error"
          : value.applied
            ? "success"
            : "info",
        title: value.applied
          ? `Đã xếp hàng ${value.applied} chapter`
          : value.errors.length
            ? "Không thể xếp hàng chapter"
            : "Không có chapter cần xếp hàng",
      })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Thao tác chưa hoàn tất. Kiểm tra danh sách trước khi thử lại.",
      }),
    onSettled: refresh,
  })
  const chooseAction = (value: Action) => {
    setAction(value)
    batch.reset()
  }
  const busy = batch.isPending
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Worker TikTok</CardTitle>
          <CardDescription>
            Điều khiển việc nhận chapter mới. Tắt switch vẫn cho chapter đang xử
            lý hoàn tất. Dữ liệu tự cập nhật mỗi 15 giây khi tab đang hiển thị
            và khi quay lại tab.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              disabled={worker.isFetching || switchWorker.isPending}
              onClick={() => void refresh()}
            >
              Làm mới
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoadState
            pending={worker.isPending}
            error={worker.error}
            empty={false}
            retry={() => void worker.refetch()}
          />
          {worker.data && (
            <>
              <Field orientation="horizontal">
                <Switch
                  id="image-server2-worker"
                  checked={worker.data.enabled}
                  disabled={switchWorker.isPending || !!worker.error}
                  onCheckedChange={(value) => switchWorker.mutate(value)}
                  aria-describedby="worker-help"
                />
                <FieldLabel htmlFor="image-server2-worker">
                  Cho phép worker nhận job mới
                </FieldLabel>
                {switchWorker.isPending && <Spinner aria-label="Đang lưu" />}
              </Field>
              <p id="worker-help" className="text-sm text-muted-foreground">
                {worker.data.enabled
                  ? "Đang cho phép nhận job."
                  : "Đang tạm dừng nhận job."}{" "}
                Sau khi bật lại, worker nhận thay đổi trong tối đa khoảng 30
                giây. Tiến trình worker cần được chạy riêng; switch không khởi
                động tiến trình.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Upload theo env:{" "}
                  {worker.data.uploadConfigured ? "Bật" : "Tắt"}
                </Badge>
                <Badge variant="outline">
                  Đọc SV2 theo env: {worker.data.readEnabled ? "Bật" : "Tắt"}
                </Badge>
              </div>
              {!worker.data.uploadConfigured && (
                <Alert>
                  <AlertTitle>Upload đang tắt trong cấu hình</AlertTitle>
                  <AlertDescription>
                    Cần bật IMAGE_SERVER2_ENABLED và
                    IMAGE_SERVER2_UPLOAD_ENABLED, rồi khởi động lại worker. Vẫn
                    có thể chuẩn bị hàng đợi bên dưới.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <Alert>
          <AlertTitle>Kết quả thao tác</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Đã xếp hàng {result.applied} chapter; bỏ qua {result.skipped}; lỗi{" "}
              {result.errors.length}.
            </p>
            {result.hasMore && (
              <p>
                Còn chapter trong lựa chọn này. Giữ nguyên lựa chọn và bấm thao
                tác lần nữa để xử lý lượt tiếp theo (tối đa 100 chapter/lượt).
              </p>
            )}
            {result.errors.length > 0 && (
              <ul className="max-h-40 overflow-auto text-xs">
                {result.errors.map((error) => (
                  <li key={error.chapterId}>
                    {error.chapterId}: {errorMessages[error.code] ?? error.code}{" "}
                    ({error.code})
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {mangaId ? (
        <ChapterPanel
          key={mangaId}
          mangaId={mangaId}
          busy={busy}
          chooseAction={chooseAction}
          refresh={refresh}
        />
      ) : (
        <MangaPanel busy={busy} chooseAction={chooseAction} refresh={refresh} />
      )}
      <Dialog
        open={!!action}
        onOpenChange={(value) => {
          if (!value && !busy) setAction(null)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (action) batch.mutate(action)
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>
                {action?.action === "retry"
                  ? "Thử lại chapter lỗi"
                  : "Đưa chapter vào hàng đợi"}
              </DialogTitle>
              <DialogDescription>
                {action?.mangaIds
                  ? `Áp dụng cho ${action.mangaIds.length} truyện đã chọn, bao gồm chapter WD cũ.`
                  : `Áp dụng cho ${action?.chapterIds?.length ?? 0} chapter đã chọn.`}{" "}
                Mỗi lượt tối đa 100 chapter.{" "}
                {action?.action === "retry"
                  ? "Chỉ thử lại job lỗi hoặc đang chờ thử lại; giữ các ảnh đã xác minh."
                  : "Chỉ thêm chapter chưa xếp hàng hoặc có phiên bản ảnh mới."}
              </DialogDescription>
            </DialogHeader>
            {batch.error && (
              <Alert variant="destructive">
                <AlertDescription>{batch.error.message}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Spinner data-icon="inline-start" />}Xác nhận
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MangaPanel({
  busy,
  chooseAction,
  refresh,
}: {
  busy: boolean
  chooseAction: (action: Action) => void
  refresh: () => Promise<void>
}) {
  const { apiBaseUrl, user, status } = useAccount()
  const key = ["account", apiBaseUrl, user?.id, "image-server2"]
  const enabled = status === "authenticated"
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const mangas = useQuery({
    queryKey: [...key, "mangas", q, page],
    enabled,
    ...readOptions,
    queryFn: ({ signal }) =>
      accountRequest<MangaList>(
        apiBaseUrl,
        `${base}/mangas?${new URLSearchParams({ q, page: String(page), limit: "20" })}`,
        "include",
        signal
      ),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Truyện và tiến độ</CardTitle>
        <CardDescription>
          Chỉ hiển thị chapter đang đọc được. Chapter WD cũ chỉ được đưa vào
          hàng đợi khi bạn chọn thao tác. Số sẵn sàng tính theo phiên bản ảnh
          hiện tại.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setQ(search.trim())
            setPage(1)
            setSelected([])
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sv2-search">Tìm truyện</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="sv2-search"
                  value={search}
                  maxLength={120}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tên truyện…"
                />
                <Button type="submit">Tìm</Button>
              </div>
            </Field>
          </FieldGroup>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!selected.length || busy}
            onClick={() =>
              chooseAction({ action: "enqueue", mangaIds: selected })
            }
          >
            Xếp hàng truyện đã chọn ({selected.length})
          </Button>
          <Button
            variant="outline"
            disabled={!selected.length || busy}
            onClick={() =>
              chooseAction({ action: "retry", mangaIds: selected })
            }
          >
            Thử lại chapter lỗi
          </Button>
          <Button
            variant="ghost"
            disabled={mangas.isFetching}
            onClick={() => void refresh()}
          >
            Làm mới
          </Button>
        </div>
        <LoadState
          pending={mangas.isPending}
          error={mangas.error}
          empty={!mangas.data?.data.length}
          retry={() => void mangas.refetch()}
        />
        {!!mangas.data?.data.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox
                    aria-label="Chọn tất cả truyện trong trang"
                    checked={mangas.data.data.every((row) =>
                      selected.includes(row.id)
                    )}
                    onCheckedChange={(value) =>
                      setSelected(
                        value ? mangas.data!.data.map((row) => row.id) : []
                      )
                    }
                  />
                </TableHead>
                <TableHead>Truyện</TableHead>
                <TableHead>Sẵn sàng</TableHead>
                <TableHead>Đang xử lý / chờ</TableHead>
                <TableHead>Lỗi</TableHead>
                <TableHead>
                  <span className="sr-only">Chi tiết</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mangas.data.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Chọn ${row.title}`}
                      checked={selected.includes(row.id)}
                      onCheckedChange={(value) =>
                        setSelected((ids) =>
                          value
                            ? [...ids, row.id]
                            : ids.filter((id) => id !== row.id)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-96 min-w-48 font-medium whitespace-normal">
                    {row.title}
                  </TableCell>
                  <TableCell>
                    {row.ready} / {row.chapters}
                  </TableCell>
                  <TableCell>
                    {row.running} / {row.queued}
                  </TableCell>
                  <TableCell>{row.failed}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          prefetch={false}
                          href={`/admin/image-server2/${row.id}/chapters`}
                        />
                      }
                    >
                      Chapter
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager
          page={page}
          hasMore={mangas.data?.meta.hasMore ?? false}
          disabled={mangas.isFetching || busy}
          onChange={(value) => {
            setPage(value)
            setSelected([])
          }}
        />
      </CardContent>
    </Card>
  )
}

function ChapterPanel({
  mangaId,
  busy,
  chooseAction,
  refresh,
}: {
  mangaId: string
  busy: boolean
  chooseAction: (action: Action) => void
  refresh: () => Promise<void>
}) {
  const { apiBaseUrl, user, status } = useAccount()
  const [page, setPage] = useState(1)
  const [state, setState] = useState("all")
  const [selected, setSelected] = useState<string[]>([])
  const chapters = useQuery({
    queryKey: [
      "account",
      apiBaseUrl,
      user?.id,
      "image-server2",
      "chapters",
      mangaId,
      state,
      page,
    ],
    enabled: status === "authenticated",
    ...readOptions,
    queryFn: ({ signal }) =>
      accountRequest<ChapterList>(
        apiBaseUrl,
        `${base}/mangas/${mangaId}/chapters?${new URLSearchParams({ page: String(page), limit: "20", ...(state === "all" ? {} : { state }) })}`,
        "include",
        signal
      ),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Chapter{chapters.data ? ` · ${chapters.data.manga.title}` : ""}
        </CardTitle>
        <CardDescription>
          Ảnh đã xác minh / tổng ảnh. Tự cập nhật mỗi 15 giây khi tab đang hiển
          thị và khi quay lại tab. Bấm Làm mới để cập nhật ngay.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field className="w-52">
            <FieldLabel htmlFor="sv2-state">Trạng thái</FieldLabel>
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value ?? "all")
                setPage(1)
                setSelected([])
              }}
            >
              <SelectTrigger id="sv2-state">
                <SelectValue>
                  {state === "all"
                    ? "Tất cả"
                    : labels[state as keyof typeof labels]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {Object.entries(labels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button
            disabled={!selected.length || busy}
            onClick={() =>
              chooseAction({ action: "enqueue", chapterIds: selected })
            }
          >
            Xếp hàng ({selected.length})
          </Button>
          <Button
            variant="outline"
            disabled={!selected.length || busy}
            onClick={() =>
              chooseAction({ action: "retry", chapterIds: selected })
            }
          >
            Thử lại lỗi
          </Button>
          <Button
            variant="outline"
            disabled={chapters.isFetching}
            onClick={() => void refresh()}
          >
            Làm mới
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link prefetch={false} href="/admin/image-server2" />}
          >
            Về danh sách truyện
          </Button>
        </div>
        <LoadState
          pending={chapters.isPending}
          error={chapters.error}
          empty={!chapters.data?.data.length}
          retry={() => void chapters.refetch()}
        />
        {!!chapters.data?.data.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox
                    aria-label="Chọn tất cả chapter trong trang"
                    checked={chapters.data.data.every((row) =>
                      selected.includes(row.id)
                    )}
                    onCheckedChange={(value) =>
                      setSelected(
                        value ? chapters.data!.data.map((row) => row.id) : []
                      )
                    }
                  />
                </TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ảnh</TableHead>
                <TableHead>Lượt thử</TableHead>
                <TableHead>Lỗi gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chapters.data.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Chọn chapter ${row.number ?? row.id}`}
                      checked={selected.includes(row.id)}
                      onCheckedChange={(value) =>
                        setSelected((ids) =>
                          value
                            ? [...ids, row.id]
                            : ids.filter((id) => id !== row.id)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-96 min-w-48 whitespace-normal">
                    <p>
                      {row.number ? `Ch. ${row.number}` : "Chapter"}
                      {row.title ? ` · ${row.title}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.pagesVersion === 0
                        ? "WD cũ"
                        : `Phiên bản ${row.pagesVersion}`}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.state === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {labels[row.state]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.verified} / {row.total}
                  </TableCell>
                  <TableCell>{row.attempts}</TableCell>
                  <TableCell className="max-w-60 whitespace-normal">
                    {row.lastErrorCode ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager
          page={page}
          hasMore={chapters.data?.meta.hasMore ?? false}
          disabled={chapters.isFetching || busy}
          onChange={(value) => {
            setPage(value)
            setSelected([])
          }}
        />
      </CardContent>
    </Card>
  )
}
