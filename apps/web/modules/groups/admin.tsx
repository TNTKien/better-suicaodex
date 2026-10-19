"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CrownIcon,
  EllipsisIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { Controller, useForm } from "react-hook-form"

import { AccountApiError, accountRequest } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import {
  adminGroupFormSchema,
  type AdminGroupFormInput,
  type AdminGroupFormValues,
} from "@/modules/groups/form-schema"
import { GroupFormDialog, PermissionMenu } from "@/modules/groups/workspace"
import type { components } from "@/src/lib/generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  Dialog,
  DialogClose,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

type Group = components["schemas"]["AdminGroupManagement"]
type GroupList = {
  data: Group[]
  meta: { page: number; limit: number; hasMore: boolean }
}
type ReviewStatus = Group["approvalStatus"]
type StatusFilter = ReviewStatus | "all"
type GroupAction = "approve" | "reject" | "delete"
type ActionTarget = { action: GroupAction; group: Group }
type CreateGroupInput = components["schemas"]["GroupInput"] & {
  leaderUserId: string
}
type GroupInput = components["schemas"]["GroupInput"]
type Membership = components["schemas"]["GroupMembership"]
type MembershipPage = {
  data: Membership[]
  meta: { page: number; limit: number; hasMore: boolean }
}
type MemberAction =
  | {
      type: "permissions"
      groupId: string
      member: Membership
      permissions: Membership["permissions"]
    }
  | { type: "kick"; groupId: string; member: Membership }

const formDefaults: AdminGroupFormInput = {
  name: "",
  leaderUserId: "",
  description: "",
  facebook: "",
  discord: "",
}

const limit = 20
const listParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral([
    "all",
    "pending",
    "approved",
    "rejected",
  ]).withDefault("all"),
}
const tableDefinition = tableFeatures({})
const columnHelper = createColumnHelper<typeof tableDefinition, Group>()
const reviewOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "Tất cả", value: "all" },
  { label: "Chờ duyệt", value: "pending" },
  { label: "Đã duyệt", value: "approved" },
  { label: "Đã từ chối", value: "rejected" },
]
const reviewLabels: Record<ReviewStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
}
const publicationLabels: Record<Group["publicationState"], string> = {
  draft: "Bản nháp",
  published: "Công khai",
  hidden: "Đã ẩn",
}

function GroupActions({
  group,
  onAction,
  onEdit,
  onLeader,
  onMembers,
}: {
  group: Group
  onAction: (target: ActionTarget) => void
  onEdit: (group: Group) => void
  onLeader: (group: Group) => void
  onMembers: (group: Group) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {group.slug !== "system" ? (
        <Button
          aria-label={`Danh sách thành viên nhóm ${group.name}`}
          size="icon-sm"
          variant="ghost"
          onClick={() => onMembers(group)}
        >
          <UsersIcon data-icon="inline-start" />
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Hành động cho nhóm ${group.name}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon data-icon="inline-start" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {group.approvalStatus === "pending" ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Xét duyệt</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onAction({ action: "approve", group })}
                >
                  <CheckIcon />
                  Phê duyệt
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onAction({ action: "reject", group })}
                >
                  <XIcon />
                  Từ chối
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Quản lý</DropdownMenuLabel>
            {group.slug !== "system" && group.approvalStatus === "approved" ? (
              <DropdownMenuItem onClick={() => onLeader(group)}>
                <CrownIcon />
                Gán trưởng nhóm
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => onEdit(group)}>
              <PencilIcon />
              Sửa
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onAction({ action: "delete", group })}
            >
              <Trash2Icon />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function groupColumns(
  onAction: (target: ActionTarget) => void,
  onEdit: (group: Group) => void,
  onLeader: (group: Group) => void,
  onMembers: (group: Group) => void
) {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Nhóm dịch",
      cell: ({ row }) => (
        <div className="flex min-w-48 items-center gap-3 whitespace-normal">
          <Avatar className="rounded-md after:rounded-md">
            <AvatarImage
              alt=""
              className="rounded-md"
              referrerPolicy="no-referrer"
              src={row.original.avatarUrl ?? undefined}
            />
            <AvatarFallback className="rounded-md">
              {initials(row.original.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium wrap-break-word">
              {row.original.name}
            </span>
            <span className="text-xs wrap-break-word text-muted-foreground">
              /{row.original.slug}
            </span>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor("description", {
      header: "Mô tả",
      cell: ({ row }) => (
        <span className="line-clamp-2 min-w-56 whitespace-normal text-muted-foreground">
          {row.original.description || "Chưa có mô tả"}
        </span>
      ),
    }),
    columnHelper.accessor("creator", {
      header: "Người tạo",
      cell: ({ row }) =>
        row.original.creator ? (
          <Link
            className="font-medium hover:underline"
            href={`/profile/${row.original.creator.id}`}
          >
            {row.original.creator.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        ),
    }),
    columnHelper.accessor("approvalStatus", {
      header: "Phê duyệt",
      cell: ({ row }) => (
        <div className="flex min-w-28 flex-col items-start gap-1">
          <Badge
            variant={
              row.original.approvalStatus === "approved"
                ? "default"
                : row.original.approvalStatus === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            {reviewLabels[row.original.approvalStatus]}
          </Badge>
        </div>
      ),
    }),
    columnHelper.accessor("publicationState", {
      header: "Hiển thị",
      cell: ({ row }) => (
        <Badge variant="outline">
          {publicationLabels[row.original.publicationState]}
        </Badge>
      ),
    }),
    columnHelper.accessor("inactive", {
      header: "Hoạt động",
      cell: ({ row }) => (
        <Badge variant={row.original.inactive ? "destructive" : "secondary"}>
          {row.original.inactive ? "Tạm ngừng" : "Đang hoạt động"}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Hành động",
      cell: ({ row }) => (
        <GroupActions
          group={row.original}
          onAction={onAction}
          onEdit={onEdit}
          onLeader={onLeader}
          onMembers={onMembers}
        />
      ),
    }),
  ])
}

export function adminGroupsPath(
  status: StatusFilter,
  page: number,
  query = ""
) {
  const params = new URLSearchParams()
  if (status !== "all") params.set("status", status)
  if (query.trim()) params.set("q", query.trim())
  params.set("page", String(page))
  params.set("limit", String(limit))
  return `/v1/admin/groups?${params}`
}

async function createAdminGroup(apiBaseUrl: string, input: CreateGroupInput) {
  const response = await fetch(new URL("/v1/admin/groups", apiBaseUrl), {
    method: "POST",
    body: JSON.stringify(input),
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new AccountApiError(response.status)
  return (await response.json()) as { data: Group }
}

async function updateAdminGroup(
  apiBaseUrl: string,
  groupId: string,
  input: GroupInput
) {
  const response = await fetch(
    new URL(`/v1/contribution/groups/${groupId}`, apiBaseUrl),
    {
      method: "PUT",
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "include",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    }
  )
  if (!response.ok) throw new AccountApiError(response.status)
}

async function mutateAdminGroup(
  apiBaseUrl: string,
  { action, group }: ActionTarget
) {
  const reviewing = action !== "delete"
  const response = await fetch(
    new URL(
      reviewing
        ? `/v1/admin/groups/${group.id}/review`
        : `/v1/admin/groups/${group.id}`,
      apiBaseUrl
    ),
    {
      method: reviewing ? "PUT" : "DELETE",
      ...(reviewing ? { body: JSON.stringify({ action }) } : {}),
      cache: "no-store",
      credentials: "include",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    }
  )
  if (!response.ok) throw new AccountApiError(response.status)
}

async function mutateGroupMember(apiBaseUrl: string, action: MemberAction) {
  const response = await fetch(
    new URL(
      `/v1/contribution/groups/${action.groupId}/members/${encodeURIComponent(action.member.userId)}${action.type === "permissions" ? "/permissions" : ""}`,
      apiBaseUrl
    ),
    {
      method: action.type === "permissions" ? "PUT" : "DELETE",
      ...(action.type === "permissions"
        ? {
            body: JSON.stringify(action.permissions),
            headers: {
              accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        : { headers: { accept: "application/json" } }),
      cache: "no-store",
      credentials: "include",
      signal: AbortSignal.timeout(8_000),
    }
  )
  if (!response.ok) throw new AccountApiError(response.status)
}

async function setGroupLeader(
  apiBaseUrl: string,
  groupId: string,
  userId: string
) {
  const response = await fetch(
    new URL(`/v1/contribution/groups/${groupId}/leader`, apiBaseUrl),
    {
      method: "POST",
      body: JSON.stringify({ userId }),
      cache: "no-store",
      credentials: "include",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    }
  )
  if (!response.ok) throw new AccountApiError(response.status)
}

function createErrorMessage(error: unknown) {
  if (!(error instanceof AccountApiError))
    return "Không thể tạo nhóm dịch. Vui lòng thử lại."
  if (error.status === 404) return "Không tìm thấy tài khoản trưởng nhóm."
  if (error.status === 409)
    return "Trưởng nhóm đã thuộc một nhóm khác hoặc tên nhóm đã tồn tại."
  if (error.status === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại."
  return "Dữ liệu chưa hợp lệ hoặc không thể tạo nhóm dịch."
}

function actionErrorMessage(error: unknown) {
  if (error instanceof AccountApiError && error.status === 409)
    return "Trạng thái nhóm đã thay đổi. Hãy tải lại danh sách."
  if (error instanceof AccountApiError && error.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng thử lại."
  return "Không thể cập nhật nhóm dịch. Vui lòng thử lại."
}

export function AdminGroups() {
  const account = useAccount()

  if (account.status !== "authenticated" || !account.user) return null

  return (
    <AdminGroupsContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminGroupsContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const [filters, setFilters] = useQueryStates(listParams, { history: "push" })
  const status = filters.status
  const query = filters.q.trim().replace(/\s+/g, " ")
  const page = Number.isSafeInteger(filters.page)
    ? Math.max(1, filters.page)
    : 1
  const searchForm = useRef<HTMLFormElement>(null)
  const [target, setTarget] = useState<ActionTarget | null>(null)
  const [editTarget, setEditTarget] = useState<Group | null>(null)
  const [leaderTarget, setLeaderTarget] = useState<Group | null>(null)
  const [membersTarget, setMembersTarget] = useState<Group | null>(null)
  const queryClient = useQueryClient()
  const queryKey = ["account", apiBaseUrl, userId, "admin-groups"] as const
  const groups = useQuery({
    queryKey: [...queryKey, status, query, page],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      accountRequest<GroupList>(
        apiBaseUrl,
        adminGroupsPath(status, page, query),
        "include",
        signal
      ),
  })
  const items = groups.data?.data ?? []
  const hasFilters = Boolean(query || status !== "all")
  const action = useMutation({
    retry: false,
    mutationFn: (input: ActionTarget) => mutateAdminGroup(apiBaseUrl, input),
    onSuccess: (_, input) => {
      setTarget(null)
      toast.add({
        type: "success",
        title:
          input.action === "approve"
            ? "Đã duyệt nhóm dịch"
            : input.action === "reject"
              ? "Đã từ chối nhóm dịch"
              : "Đã xóa nhóm dịch",
      })
      void queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) =>
      toast.add({ type: "error", title: actionErrorMessage(error) }),
  })
  const edit = useMutation({
    retry: false,
    mutationFn: ({ group, input }: { group: Group; input: GroupInput }) =>
      updateAdminGroup(apiBaseUrl, group.id, input),
    onSuccess: () => {
      setEditTarget(null)
      toast.add({ type: "success", title: "Đã cập nhật nhóm dịch" })
      void queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) =>
      toast.add({ type: "error", title: actionErrorMessage(error) }),
  })
  const openAction = useCallback((next: ActionTarget) => {
    setTarget(next)
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <GroupActionDialog
        pending={action.isPending}
        target={target}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setTarget(null)
        }}
        onSubmit={() => {
          if (target) action.mutate(target)
        }}
      />
      <GroupFormDialog
        apiBaseUrl={apiBaseUrl}
        group={editTarget ?? undefined}
        lockName={editTarget?.slug === "system"}
        open={editTarget !== null}
        busy={edit.isPending}
        onOpenChange={(open) => {
          if (!open && !edit.isPending) setEditTarget(null)
        }}
        onSubmit={(input) => {
          if (editTarget) edit.mutate({ group: editTarget, input })
        }}
      />
      <SetLeaderDialog
        key={leaderTarget ? `leader-${leaderTarget.id}` : "leader-closed"}
        apiBaseUrl={apiBaseUrl}
        group={leaderTarget}
        userId={userId}
        onOpenChange={(open) => {
          if (!open) setLeaderTarget(null)
        }}
      />
      <AdminGroupMembersDialog
        key={membersTarget ? `members-${membersTarget.id}` : "members-closed"}
        apiBaseUrl={apiBaseUrl}
        userId={userId}
        group={membersTarget}
        onOpenChange={(open) => {
          if (!open) setMembersTarget(null)
        }}
      />

      <CreateGroupCard
        apiBaseUrl={apiBaseUrl}
        onCreated={() => {
          searchForm.current?.reset()
          void setFilters(null)
          void queryClient.invalidateQueries({ queryKey })
        }}
      />

      <div className="grid gap-3 md:grid-cols-[minmax(18rem,1fr)_14rem]">
        <form
          ref={searchForm}
          onSubmit={(event) => {
            event.preventDefault()
            const value = String(
              new FormData(event.currentTarget).get("q") ?? ""
            )
              .trim()
              .replace(/\s+/g, " ")
            void setFilters({ q: value, page: 1 })
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Tìm nhóm dịch theo tên"
              autoComplete="off"
              defaultValue={query}
              key={query}
              maxLength={160}
              name="q"
              placeholder="Tìm theo tên nhóm..."
              type="search"
            />
            <InputGroupAddon align="inline-end">
              {groups.isFetching && !groups.isPending ? (
                <Spinner aria-label="Đang tìm nhóm dịch" />
              ) : null}
              <InputGroupButton aria-label="Tìm kiếm" type="submit">
                Tìm
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Select
          items={reviewOptions}
          value={status}
          onValueChange={(value) => {
            if (value) {
              void setFilters({ status: value, page: 1 })
            }
          }}
        >
          <SelectTrigger
            aria-label="Lọc trạng thái nhóm dịch"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {reviewOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {hasFilters ? (
        <Button
          className="self-start"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            searchForm.current?.reset()
            void setFilters(null)
          }}
        >
          Xóa bộ lọc
        </Button>
      ) : null}

      {groups.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách nhóm dịch"
          className="self-center"
        />
      ) : groups.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách nhóm dịch</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Vui lòng thử lại.</span>
            <Button variant="outline" onClick={() => void groups.refetch()}>
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters
                ? "Không tìm thấy nhóm dịch phù hợp"
                : "Chưa có nhóm dịch"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Hãy thử từ khóa hoặc trạng thái khác."
                : "Danh sách nhóm dịch sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Đang hiển thị {items.length.toLocaleString("vi-VN")} nhóm dịch
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((group) => (
              <GroupMobileItem
                group={group}
                key={group.id}
                onAction={openAction}
                onEdit={setEditTarget}
                onLeader={setLeaderTarget}
                onMembers={setMembersTarget}
              />
            ))}
          </div>
          <GroupDataTable
            data={items}
            onAction={openAction}
            onEdit={setEditTarget}
            onLeader={setLeaderTarget}
            onMembers={setMembersTarget}
          />
          {groups.data && (page > 1 || groups.data.meta.hasMore) ? (
            <nav
              aria-label="Phân trang nhóm dịch"
              className="flex items-center justify-center gap-2"
            >
              <Button
                aria-label="Trang trước"
                disabled={page === 1 || groups.isFetching}
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={() => void setFilters({ page: page - 1 })}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="min-w-14 text-center text-sm text-muted-foreground tabular-nums">
                {page}
              </span>
              <Button
                aria-label="Trang sau"
                disabled={!groups.data.meta.hasMore || groups.isFetching}
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={() => void setFilters({ page: page + 1 })}
              >
                <ChevronRightIcon />
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}

function SetLeaderDialog({
  apiBaseUrl,
  userId,
  group,
  onOpenChange,
}: {
  apiBaseUrl: string
  userId: string
  group: Group | null
  onOpenChange: (open: boolean) => void
}) {
  const [leaderUserId, setLeaderUserId] = useState("")
  const queryClient = useQueryClient()
  const mutation = useMutation({
    retry: false,
    mutationFn: (targetUserId: string) =>
      setGroupLeader(apiBaseUrl, group!.id, targetUserId),
    onSuccess: () => {
      toast.add({ type: "success", title: "Đã gán trưởng nhóm" })
      void queryClient.invalidateQueries({
        queryKey: [
          "account",
          apiBaseUrl,
          userId,
          "admin-group-members",
          group!.id,
        ],
      })
      onOpenChange(false)
    },
    onError: (error) => {
      const title =
        error instanceof AccountApiError && error.status === 404
          ? "Không tìm thấy tài khoản."
          : error instanceof AccountApiError && error.status === 409
            ? "Tài khoản đã thuộc nhóm khác, đang có yêu cầu chờ duyệt hoặc đã là trưởng nhóm."
            : "Không thể gán trưởng nhóm. Vui lòng thử lại."
      toast.add({ type: "error", title })
    },
  })
  const normalizedUserId = leaderUserId.trim()

  return (
    <Dialog
      open={group !== null}
      onOpenChange={(open) => {
        if (!mutation.isPending) onOpenChange(open)
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (normalizedUserId) mutation.mutate(normalizedUserId)
          }}
        >
          <DialogHeader>
            <DialogTitle>Gán trưởng nhóm</DialogTitle>
            <DialogDescription>
              Gán tài khoản làm trưởng nhóm {group?.name}. Trưởng nhóm hiện tại,
              nếu có, sẽ trở thành thành viên.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="admin-group-leader-user-id">
              ID tài khoản
            </FieldLabel>
            <Input
              autoComplete="off"
              id="admin-group-leader-user-id"
              maxLength={255}
              placeholder="Nhập ID tài khoản"
              value={leaderUserId}
              onChange={(event) => setLeaderUserId(event.target.value)}
            />
            <FieldDescription>
              Tài khoản chưa thuộc nhóm nào sẽ được thêm trực tiếp vào nhóm này.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              disabled={mutation.isPending || !normalizedUserId}
              type="submit"
            >
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Gán trưởng nhóm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AdminGroupMembersDialog({
  apiBaseUrl,
  userId,
  group,
  onOpenChange,
}: {
  apiBaseUrl: string
  userId: string
  group: Group | null
  onOpenChange: (open: boolean) => void
}) {
  const [page, setPage] = useState(1)
  const [kickTarget, setKickTarget] = useState<Membership | null>(null)
  const queryClient = useQueryClient()
  const groupId = group?.id ?? ""
  const queryKey = [
    "account",
    apiBaseUrl,
    userId,
    "admin-group-members",
    groupId,
  ] as const
  const members = useQuery({
    queryKey: [...queryKey, page],
    enabled: groupId.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      accountRequest<MembershipPage>(
        apiBaseUrl,
        `/v1/contribution/groups/${groupId}/members?status=approved&page=${page}&limit=${limit}`,
        "include",
        signal
      ),
  })
  const mutation = useMutation({
    retry: false,
    mutationFn: (action: MemberAction) => mutateGroupMember(apiBaseUrl, action),
    onSuccess: (_, action) => {
      if (action.type === "kick") {
        setKickTarget(null)
        if (page > 1 && members.data?.data.length === 1)
          setPage((value) => value - 1)
      }
      toast.add({
        type: "success",
        title:
          action.type === "permissions"
            ? `Đã cập nhật quyền của ${action.member.name}`
            : `Đã kick ${action.member.name} khỏi nhóm`,
      })
      void queryClient.invalidateQueries({
        queryKey: [
          "account",
          apiBaseUrl,
          userId,
          "admin-group-members",
          action.groupId,
        ],
      })
    },
    onError: () =>
      toast.add({
        type: "error",
        title: "Không thể cập nhật thành viên. Vui lòng thử lại.",
      }),
  })
  const changePermission = (
    member: Membership,
    permissions: Membership["permissions"]
  ) => {
    if (!group) return
    mutation.mutate({
      type: "permissions",
      groupId: group.id,
      member,
      permissions,
    })
  }

  return (
    <>
      <Dialog
        open={group !== null}
        onOpenChange={(open) => {
          if (!mutation.isPending) onOpenChange(open)
        }}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thành viên nhóm {group?.name}</DialogTitle>
            <DialogDescription>
              Phân quyền hoặc buộc thành viên rời khỏi nhóm dịch.
            </DialogDescription>
          </DialogHeader>
          {members.isPending ? (
            <Spinner aria-label="Đang tải danh sách thành viên" />
          ) : members.isError ? (
            <Alert>
              <AlertTitle>Không thể tải danh sách thành viên</AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  onClick={() => void members.refetch()}
                >
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          ) : members.data.data.length === 0 ? (
            <Empty className="p-6">
              <EmptyHeader>
                <EmptyDescription>Nhóm chưa có thành viên.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup>
              {members.data.data.map((member) => (
                <Item key={member.userId} variant="outline">
                  <ItemMedia>
                    <AvatarDecoration frame={member.avatarFrame ?? null}>
                      <Avatar className="size-10">
                        <AvatarFallback>{initials(member.name)}</AvatarFallback>
                      </Avatar>
                    </AvatarDecoration>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{member.name}</ItemTitle>
                    <ItemDescription>
                      {member.role === "leader" ? "Trưởng nhóm" : "Thành viên"}
                    </ItemDescription>
                  </ItemContent>
                  {member.role === "member" && (
                    <ItemActions className="ml-auto flex-wrap">
                      <PermissionMenu
                        member={member}
                        disabled={mutation.isPending}
                        onChange={changePermission}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={mutation.isPending}
                        onClick={() => setKickTarget(member)}
                      >
                        Kick
                      </Button>
                    </ItemActions>
                  )}
                </Item>
              ))}
            </ItemGroup>
          )}
          {members.data && (page > 1 || members.data.meta.hasMore) && (
            <DialogFooter className="justify-between sm:justify-between">
              <Button
                variant="outline"
                disabled={page === 1 || members.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Trang trước
              </Button>
              <span className="self-center text-sm text-muted-foreground">
                Trang {page}
              </span>
              <Button
                variant="outline"
                disabled={!members.data.meta.hasMore || members.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang sau
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={kickTarget !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setKickTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kick thành viên khỏi nhóm?</DialogTitle>
            <DialogDescription>
              {kickTarget?.name} sẽ mất toàn bộ quyền trong nhóm {group?.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setKickTarget(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutation.isPending || !group || !kickTarget}
              onClick={() => {
                if (!group || !kickTarget) return
                mutation.mutate({
                  type: "kick",
                  groupId: group.id,
                  member: kickTarget,
                })
              }}
            >
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function GroupActionDialog({
  target,
  pending,
  onOpenChange,
  onSubmit,
}: {
  target: ActionTarget | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}) {
  const action = target?.action
  const title =
    action === "approve"
      ? "Duyệt nhóm dịch?"
      : action === "reject"
        ? "Từ chối nhóm dịch?"
        : "Xóa nhóm dịch?"
  const description =
    action === "approve"
      ? `Nhóm “${target?.group.name}” sẽ được công khai.`
      : action === "reject"
        ? `Yêu cầu tạo nhóm “${target?.group.name}” sẽ bị từ chối.`
        : `Nhóm “${target?.group.name}” sẽ bị ẩn khỏi hệ thống.`
  const submitLabel =
    action === "approve" ? "Duyệt" : action === "reject" ? "Từ chối" : "Xóa"

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              disabled={pending}
              render={<Button type="button" variant="outline" />}
            >
              Hủy
            </DialogClose>
            <Button
              disabled={pending}
              type="submit"
              variant={action === "approve" ? "default" : "destructive"}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateGroupCard({
  apiBaseUrl,
  onCreated,
}: {
  apiBaseUrl: string
  onCreated: () => void
}) {
  const form = useForm<AdminGroupFormInput, unknown, AdminGroupFormValues>({
    resolver: zodResolver(adminGroupFormSchema),
    defaultValues: formDefaults,
    mode: "onBlur",
  })
  const mutation = useMutation({
    retry: false,
    mutationFn: (input: CreateGroupInput) =>
      createAdminGroup(apiBaseUrl, input),
    onSuccess: () => {
      form.reset()
      onCreated()
      toast.add({ type: "success", title: "Đã tạo nhóm dịch" })
    },
    onError: (error) => {
      toast.add({ type: "error", title: createErrorMessage(error) })
    },
  })

  return (
    <Collapsible className="group/collapsible" render={<Card />}>
      <CardHeader>
        <CardTitle>Tạo nhóm dịch</CardTitle>
        <CardDescription>
          Nhóm do quản trị viên tạo sẽ được duyệt và công khai ngay.
        </CardDescription>
        <CardAction>
          <CollapsibleTrigger
            aria-label="Thu gọn hoặc mở rộng biểu mẫu tạo nhóm"
            render={<Button size="icon-sm" type="button" variant="ghost" />}
          >
            <ChevronDownIcon
              aria-hidden="true"
              className="transition-transform group-data-open/collapsible:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
        </CardAction>
      </CardHeader>
      <CollapsibleContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={form.handleSubmit((data) => {
            mutation.mutate({
              name: data.name,
              leaderUserId: data.leaderUserId,
              description: data.description,
              links: {
                facebook: data.facebook,
                discord: data.discord,
              },
            })
          })}
        >
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-disabled={mutation.isPending || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor="admin-group-name">Tên nhóm</FieldLabel>
                    <Input
                      {...field}
                      id="admin-group-name"
                      aria-invalid={fieldState.invalid}
                      maxLength={80}
                      required
                      disabled={mutation.isPending}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="leaderUserId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-disabled={mutation.isPending || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor="admin-group-leader">
                      ID tài khoản trưởng nhóm
                    </FieldLabel>
                    <Input
                      {...field}
                      id="admin-group-leader"
                      aria-invalid={fieldState.invalid}
                      maxLength={128}
                      required
                      disabled={mutation.isPending}
                    />
                    <FieldDescription>
                      Tài khoản chưa thuộc hoặc gửi yêu cầu vào nhóm khác.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    className="sm:col-span-2"
                    data-disabled={mutation.isPending || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor="admin-group-description">
                      Mô tả
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="admin-group-description"
                      aria-invalid={fieldState.invalid}
                      maxLength={1_000}
                      rows={3}
                      disabled={mutation.isPending}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="facebook"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-disabled={mutation.isPending || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor="admin-group-facebook">
                      Facebook
                    </FieldLabel>
                    <Input
                      {...field}
                      id="admin-group-facebook"
                      type="url"
                      aria-invalid={fieldState.invalid}
                      maxLength={220}
                      placeholder="https://facebook.com/..."
                      disabled={mutation.isPending}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="discord"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-disabled={mutation.isPending || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor="admin-group-discord">
                      Discord
                    </FieldLabel>
                    <Input
                      {...field}
                      id="admin-group-discord"
                      aria-invalid={fieldState.invalid}
                      maxLength={220}
                      placeholder="https://discord.gg/..."
                      disabled={mutation.isPending}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Tạo nhóm dịch
            </Button>
          </CardFooter>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}

function GroupMobileItem({
  group,
  onAction,
  onEdit,
  onLeader,
  onMembers,
}: {
  group: Group
  onAction: (target: ActionTarget) => void
  onEdit: (group: Group) => void
  onLeader: (group: Group) => void
  onMembers: (group: Group) => void
}) {
  return (
    <article className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="rounded-md after:rounded-md">
            <AvatarImage
              alt=""
              className="rounded-md"
              referrerPolicy="no-referrer"
              src={group.avatarUrl ?? undefined}
            />
            <AvatarFallback className="rounded-md">
              {initials(group.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="font-medium wrap-break-word">{group.name}</p>
            <p className="text-sm wrap-break-word text-muted-foreground">
              /{group.slug}
            </p>
          </div>
        </div>
        <GroupActions
          group={group}
          onAction={onAction}
          onEdit={onEdit}
          onLeader={onLeader}
          onMembers={onMembers}
        />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {group.description || "Chưa có mô tả"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge
          variant={
            group.approvalStatus === "approved"
              ? "default"
              : group.approvalStatus === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {reviewLabels[group.approvalStatus]}
        </Badge>
        <Badge variant="outline">
          {publicationLabels[group.publicationState]}
        </Badge>
        <Badge variant={group.inactive ? "destructive" : "secondary"}>
          {group.inactive ? "Tạm ngừng" : "Đang hoạt động"}
        </Badge>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Người tạo:{" "}
        {group.creator ? (
          <Link
            className="font-medium hover:underline"
            href={`/profile/${group.creator.id}`}
          >
            {group.creator.name}
          </Link>
        ) : (
          "N/A"
        )}
      </p>
    </article>
  )
}

function GroupDataTable({
  data,
  onAction,
  onEdit,
  onLeader,
  onMembers,
}: {
  data: Group[]
  onAction: (target: ActionTarget) => void
  onEdit: (group: Group) => void
  onLeader: (group: Group) => void
  onMembers: (group: Group) => void
}) {
  const columns = useMemo(
    () => groupColumns(onAction, onEdit, onLeader, onMembers),
    [onAction, onEdit, onLeader, onMembers]
  )
  const table = useTable({ features: tableDefinition, columns, data })

  return (
    <div className="hidden overflow-hidden rounded-md border md:block">
      <Table aria-label="Danh sách nhóm dịch">
        <TableCaption className="sr-only">
          Danh sách nhóm dịch dành cho quản trị viên
        </TableCaption>
        <TableHeader className="uppercase">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={columns.length}>
                Không tìm thấy nhóm dịch.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  )
}
