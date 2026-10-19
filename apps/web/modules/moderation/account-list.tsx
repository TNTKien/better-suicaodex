"use client"

import Link from "next/link"
import { useState } from "react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  BanIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldAlertIcon,
  UserRoundSearchIcon,
} from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { useAccount } from "@/modules/account/provider"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import {
  accountActionDescription,
  accountActionErrorMessage,
  accountActionLabel,
  accountStatusLabels,
  adminAccountRequest,
  AdminAccountError,
  type AccountStatus,
  adminUsersQueryKey,
  runAdminAccountStatusAction,
} from "@/modules/moderation/account-moderation"
import type { paths } from "@/src/lib/generated/api"
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

type UserPage =
  paths["/v1/admin/users"]["get"]["responses"][200]["content"]["application/json"]
type AdminUser = UserPage["data"][number]
type StatusFilter = AdminUser["status"] | "all"
type ActionTarget = { status: AccountStatus; user: AdminUser }

const limit = 20
const statusOptions = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Hoạt động", value: "active" },
  { label: "Hạn chế", value: "suspended" },
  { label: "Đã ban", value: "banned" },
] as const satisfies ReadonlyArray<{
  label: string
  value: StatusFilter
}>
const listParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral([
    "all",
    "active",
    "suspended",
    "banned",
  ]).withDefault("all"),
}

export function adminUsersPath(
  page: number,
  query = "",
  status: StatusFilter = "all"
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (query.trim()) params.set("q", query.trim())
  if (status !== "all") params.set("status", status)
  return `/v1/admin/users?${params}`
}

function statusVariant(status: AdminUser["status"]) {
  if (status === "banned") return "destructive" as const
  if (status === "suspended") return "secondary" as const
  return "outline" as const
}

function UserIdentity({ user }: { user: AdminUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AvatarDecoration frame={user.avatarFrame ?? null}>
        <Avatar className="size-11 overflow-hidden">
          {user.image ? <AvatarImage alt="" src={user.image} /> : null}
          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </AvatarDecoration>
      <div className="min-w-0">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}

function UserBadges({ user }: { user: AdminUser }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={statusVariant(user.status)}>
        {accountStatusLabels[user.status]}
      </Badge>
      {user.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
    </div>
  )
}

function UserActions({
  onAction,
  user,
}: {
  onAction: (target: ActionTarget) => void
  user: AdminUser
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <DetailLink user={user} />
      {user.status === "active" ? (
        <Button
          onClick={() => onAction({ status: "suspended", user })}
          size="sm"
          variant="secondary"
        >
          <ShieldAlertIcon aria-hidden="true" data-icon="inline-start" />
          Hạn chế
        </Button>
      ) : (
        <Button onClick={() => onAction({ status: "active", user })} size="sm">
          <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
          {user.status === "banned" ? "Gỡ ban" : "Khôi phục"}
        </Button>
      )}
      {user.status !== "banned" ? (
        <Button
          onClick={() => onAction({ status: "banned", user })}
          size="sm"
          variant="destructive"
        >
          <BanIcon aria-hidden="true" data-icon="inline-start" />
          Ban
        </Button>
      ) : null}
    </div>
  )
}

function DetailLink({ user }: { user: AdminUser }) {
  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "secondary" })}
      href={`/admin/user/${user.id}`}
      prefetch={false}
    >
      Xem chi tiết
    </Link>
  )
}

function UserTableRow({
  onAction,
  user,
}: {
  onAction: (target: ActionTarget) => void
  user: AdminUser
}) {
  return (
    <TableRow>
      <TableCell className="max-w-96 min-w-64">
        <UserIdentity user={user} />
      </TableCell>
      <TableCell>
        <UserBadges user={user} />
      </TableCell>
      <TableCell>{formatVietnamDateTimeInline(user.createdAt)}</TableCell>
      <TableCell className="text-right">
        <UserActions onAction={onAction} user={user} />
      </TableCell>
    </TableRow>
  )
}

function UserMobileItem({
  onAction,
  user,
}: {
  onAction: (target: ActionTarget) => void
  user: AdminUser
}) {
  return (
    <article className="p-3">
      <UserIdentity user={user} />
      <div className="mt-3">
        <UserBadges user={user} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Tham gia {formatVietnamDateTimeInline(user.createdAt)}
      </p>
      <div className="mt-3">
        <UserActions onAction={onAction} user={user} />
      </div>
    </article>
  )
}

export function AdminAccountList() {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminAccountListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminAccountListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<ActionTarget | null>(null)
  const [filters, setFilters] = useQueryStates(listParams, { history: "push" })
  const page = Math.max(1, filters.page)
  const query = filters.q.trim().replace(/\s+/g, " ")
  const status = filters.status
  const queryKey = adminUsersQueryKey(apiBaseUrl, userId)
  const users = useQuery({
    queryKey: [...queryKey, page, query, status],
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      adminAccountRequest<UserPage>(
        apiBaseUrl,
        adminUsersPath(page, query, status),
        {},
        signal
      ),
  })
  const items = users.data?.data ?? []
  const action = useMutation({
    retry: false,
    mutationFn: (input: ActionTarget) =>
      runAdminAccountStatusAction(apiBaseUrl, input.user, input.status),
    onSuccess: async (_response, input) => {
      setTarget(null)
      toast.add({
        type: "success",
        title:
          input.status === "suspended"
            ? "Đã hạn chế tài khoản"
            : input.status === "banned"
              ? "Đã ban tài khoản"
              : input.user.status === "banned"
                ? "Đã gỡ ban tài khoản"
                : "Đã khôi phục tài khoản",
      })
      await queryClient.invalidateQueries({
        queryKey: adminUsersQueryKey(apiBaseUrl, userId),
      })
    },
    onError: async (error, input) => {
      if (!(error instanceof AdminAccountError)) return
      if (error.code === "VERSION_CONFLICT") {
        const refreshed = await users.refetch()
        const current = refreshed.data?.data.find(
          (user) => user.id === input.user.id
        )
        if (current) setTarget({ ...input, user: current })
      }
      if (error.code === "STATE_UNCHANGED") {
        setTarget(null)
        await users.refetch()
        toast.add({ title: "Trạng thái tài khoản đã được cập nhật trước đó" })
      }
    },
  })
  const hasFilters = Boolean(query || status !== "all")
  const openAction = (nextTarget: ActionTarget) => {
    action.reset()
    setTarget(nextTarget)
  }

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
              aria-label="Tìm người dùng theo tên, email hoặc ID"
              autoComplete="off"
              defaultValue={query}
              key={query}
              name="q"
              placeholder="Tìm theo tên, email hoặc ID..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {users.isFetching && !users.isPending ? (
                <Spinner aria-label="Đang tìm người dùng" />
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
            aria-label="Lọc trạng thái người dùng"
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

      {users.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách người dùng"
          className="self-center"
        />
      ) : users.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách người dùng</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{users.error.message}</span>
            <Button onClick={() => void users.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRoundSearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters
                ? "Không tìm thấy người dùng phù hợp"
                : "Chưa có người dùng"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Hãy thử từ khóa hoặc bộ lọc khác."
                : "Danh sách người dùng sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {users.data.meta.total.toLocaleString("vi-VN")} người dùng
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((user) => (
              <UserMobileItem key={user.id} onAction={openAction} user={user} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách người dùng dành cho quản trị viên
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((user) => (
                  <UserTableRow
                    key={user.id}
                    onAction={openAction}
                    user={user}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            ariaLabel="Phân trang người dùng"
            currentPage={page}
            disabled={users.isFetching}
            onPageChange={(nextPage) => setFilters({ page: nextPage })}
            totalPages={users.data.meta.totalPages}
          />
        </>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !action.isPending) {
            setTarget(null)
            action.reset()
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {target
                ? `${accountActionLabel(target.user.status, target.status)} tài khoản?`
                : "Cập nhật tài khoản?"}
            </DialogTitle>
            <DialogDescription>
              {target
                ? accountActionDescription(target.user.status, target.status)
                : "Xác nhận thay đổi trạng thái tài khoản."}
            </DialogDescription>
          </DialogHeader>
          {action.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Không thể cập nhật tài khoản</AlertTitle>
              <AlertDescription>
                {accountActionErrorMessage(action.error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              disabled={action.isPending}
              onClick={() => {
                setTarget(null)
                action.reset()
              }}
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!target || action.isPending}
              onClick={() => {
                if (target) action.mutate(target)
              }}
              variant={target?.status === "banned" ? "destructive" : "default"}
            >
              {action.isPending ? <Spinner aria-hidden="true" /> : null}
              {target
                ? accountActionLabel(target.user.status, target.status)
                : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
