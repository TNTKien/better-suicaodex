"use client"

import { useState } from "react"
import { TZDate } from "@date-fns/tz"
import { useInfiniteQuery } from "@tanstack/react-query"
import { RefreshCwIcon, SearchXIcon } from "lucide-react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { useAccount } from "@/modules/account/provider"
import { adminAccountRequest } from "@/modules/moderation/account-moderation"
import type { paths } from "@/src/lib/generated/api"
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
import { Input } from "@workspace/ui/components/input"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type AuditPage =
  paths["/v1/admin/audit"]["get"]["responses"][200]["content"]["application/json"]
type AuditEntry = AuditPage["data"][number]
type TargetKind = AuditEntry["targetKind"]
const targetKinds = [
  { label: "Tất cả đối tượng", value: "all" },
  { label: "Người dùng", value: "user" },
  { label: "Truyện", value: "manga" },
  { label: "Tập", value: "volume" },
  { label: "Chương", value: "chapter" },
  { label: "Bình luận", value: "comment" },
  { label: "Nhóm dịch", value: "group" },
  { label: "Tác giả/Họa sĩ", value: "person" },
  { label: "Thể loại", value: "tag" },
  { label: "TikTok Server 2", value: "image_server2" },
  { label: "Thông báo hệ thống", value: "system_notice" },
  { label: "Khung avatar", value: "avatar_frame" },
  { label: "Chủ đề khung", value: "avatar_frame_topic" },
] as const satisfies ReadonlyArray<{ label: string; value: TargetKind | "all" }>
type TargetFilter = (typeof targetKinds)[number]["value"]
const filtersParser = {
  targetKind: parseAsStringLiteral(
    targetKinds.map(({ value }) => value)
  ).withDefault("all"),
  targetId: parseAsString.withDefault(""),
  actorUserId: parseAsString.withDefault(""),
  action: parseAsString.withDefault(""),
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
}
const vietnamTimeZone = "Asia/Ho_Chi_Minh"

function dateBoundary(value: string, end: boolean) {
  if (!value) return null
  return TZDate.tz(
    vietnamTimeZone,
    `${value}T${end ? "23:59:59.999" : "00:00:00.000"}`
  ).toISOString()
}

export function adminAuditPath(
  filters: {
    targetKind: TargetFilter
    targetId: string
    actorUserId: string
    action: string
    from: string
    to: string
  },
  cursor?: string | null
) {
  const query = new URLSearchParams({ limit: "20" })
  if (filters.targetKind !== "all") query.set("targetKind", filters.targetKind)
  for (const key of ["targetId", "actorUserId", "action"] as const) {
    const value = filters[key].trim()
    if (value) query.set(key, value)
  }
  const from = dateBoundary(filters.from, false)
  const to = dateBoundary(filters.to, true)
  if (from) query.set("from", from)
  if (to) query.set("to", to)
  if (cursor) query.set("cursor", cursor)
  return `/v1/admin/audit?${query}`
}

function targetLabel(kind: TargetKind) {
  return targetKinds.find(({ value }) => value === kind)?.label ?? kind
}

function Snapshot({ value }: { value: Record<string, unknown> | null }) {
  return value ? (
    <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  ) : (
    <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
  )
}

function AuditDetail({
  entry,
  onClose,
}: {
  entry: AuditEntry | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chi tiết audit</DialogTitle>
          <DialogDescription>{entry?.action}</DialogDescription>
        </DialogHeader>
        {entry ? (
          <div className="space-y-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Đối tượng</dt>
                <dd className="wrap-break-word">
                  {targetLabel(entry.targetKind)} · {entry.targetId}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Người thực hiện</dt>
                <dd className="wrap-break-word">
                  {entry.actor?.name ??
                    entry.actorUserId ??
                    "Hệ thống hoặc tài khoản không còn tồn tại"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Lý do</dt>
                <dd className="wrap-break-word">{entry.reason}</dd>
              </div>
            </dl>
            <section className="space-y-2">
              <h3 className="font-medium">Trước thay đổi</h3>
              <Snapshot value={entry.before} />
            </section>
            <section className="space-y-2">
              <h3 className="font-medium">Sau thay đổi</h3>
              <Snapshot value={entry.after} />
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function EntrySummary({ entry }: { entry: AuditEntry }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="font-medium wrap-break-word">{entry.action}</p>
      <p
        className="line-clamp-2 text-sm text-muted-foreground"
        title={entry.reason}
      >
        {entry.reason}
      </p>
    </div>
  )
}

export function AdminAuditList() {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminAuditListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminAuditListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const [filters, setFilters] = useQueryStates(filtersParser, {
    history: "push",
  })
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const audit = useInfiniteQuery({
    queryKey: ["account", apiBaseUrl, userId, "admin-audit", filters],
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: AuditPage) =>
      lastPage.meta.nextCursor ?? undefined,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ pageParam, signal }) =>
      adminAccountRequest<AuditPage>(
        apiBaseUrl,
        adminAuditPath(filters, pageParam),
        {},
        signal
      ),
  })
  const entries = audit.data?.pages.flatMap(({ data }) => data) ?? []
  const resetFilters = () =>
    void setFilters({
      targetKind: "all",
      targetId: null,
      actorUserId: null,
      action: null,
      from: null,
      to: null,
    })

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2 xl:grid-cols-4">
        <Select
          items={targetKinds}
          value={filters.targetKind}
          onValueChange={(value) =>
            void setFilters({ targetKind: value as TargetFilter })
          }
        >
          <SelectTrigger className="w-full" aria-label="Loại đối tượng">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {targetKinds.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Input
          aria-label="Mã đối tượng"
          placeholder="Mã đối tượng"
          value={filters.targetId}
          onChange={(event) =>
            void setFilters({ targetId: event.target.value || null })
          }
        />
        <Input
          aria-label="Mã người thực hiện"
          placeholder="Mã người thực hiện"
          value={filters.actorUserId}
          onChange={(event) =>
            void setFilters({ actorUserId: event.target.value || null })
          }
        />
        <Input
          aria-label="Tên hành động"
          placeholder="Tên hành động, ví dụ moderation.manga.hidden"
          value={filters.action}
          onChange={(event) =>
            void setFilters({ action: event.target.value || null })
          }
        />
        <label className="space-y-1 text-xs text-muted-foreground">
          Từ ngày
          <Input
            type="date"
            value={filters.from}
            onChange={(event) =>
              void setFilters({ from: event.target.value || null })
            }
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Đến ngày
          <Input
            type="date"
            value={filters.to}
            onChange={(event) =>
              void setFilters({ to: event.target.value || null })
            }
          />
        </label>
        <div className="flex gap-2 md:col-span-2 xl:justify-end">
          <Button onClick={resetFilters} variant="outline">
            Xóa bộ lọc
          </Button>
          <Button
            aria-label="Làm mới nhật ký"
            onClick={() => void audit.refetch()}
            variant="secondary"
          >
            <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
            Làm mới
          </Button>
        </div>
      </div>

      {audit.isPending ? (
        <Spinner aria-label="Đang tải nhật ký quản trị" className="mx-auto" />
      ) : audit.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải nhật ký quản trị</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{audit.error.message}</span>
            <Button onClick={() => void audit.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : entries.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Không có bản ghi phù hợp</EmptyTitle>
            <EmptyDescription>Thử thay đổi hoặc xóa bộ lọc.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="divide-y overflow-hidden rounded-lg border md:hidden">
            {entries.map((entry) => (
              <article className="space-y-3 p-4" key={entry.id}>
                <EntrySummary entry={entry} />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {targetLabel(entry.targetKind)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatVietnamDateTimeInline(entry.createdAt)}
                  </span>
                </div>
                <p className="truncate text-sm">
                  {entry.actor?.name ??
                    entry.actorUserId ??
                    "Hệ thống hoặc tài khoản không còn tồn tại"}
                </p>
                <Button
                  onClick={() => setSelected(entry)}
                  size="sm"
                  variant="secondary"
                >
                  Chi tiết
                </Button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead className="text-right">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatVietnamDateTimeInline(entry.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {entry.actor?.name ??
                        entry.actorUserId ??
                        "Hệ thống hoặc tài khoản không còn tồn tại"}
                    </TableCell>
                    <TableCell className="max-w-96">
                      <EntrySummary entry={entry} />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <Badge variant="outline">
                        {targetLabel(entry.targetKind)}
                      </Badge>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {entry.targetId}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => setSelected(entry)}
                        size="sm"
                        variant="secondary"
                      >
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {audit.hasNextPage ? (
            <Button
              className="mx-auto flex"
              disabled={audit.isFetchingNextPage}
              onClick={() => void audit.fetchNextPage()}
              variant="outline"
            >
              {audit.isFetchingNextPage ? <Spinner aria-hidden="true" /> : null}
              Tải thêm
            </Button>
          ) : null}
        </>
      )}
      <AuditDetail entry={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
