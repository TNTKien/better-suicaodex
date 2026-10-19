"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useDebouncedValue } from "@mantine/hooks"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDownIcon, PlusIcon, UserPlusIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import {
  groupFormSchema,
  type GroupFormInput,
  type GroupFormValues,
} from "@/modules/groups/form-schema"
import { GroupMediaFields } from "@/modules/groups/media-fields"
import { canManageGroupCoin } from "@/modules/groups/coin-api"
import { GroupCoinWallet } from "@/modules/groups/coin-wallet"
import { GroupDiscovery } from "@/modules/groups/directory"
import type { components } from "@/src/lib/generated/api"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
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
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

type Group = components["schemas"]["GroupManagement"]
type GroupInput = components["schemas"]["GroupInput"]
type Membership = components["schemas"]["GroupMembership"]
type GroupPermissions = Membership["permissions"]
export type PermissionKey = keyof GroupPermissions
type MyGroup = components["schemas"]["MyGroup"]
type GroupList = components["schemas"]["TranslationGroupList"]
type MembershipPage = {
  data: Membership[]
  meta: { page: number; limit: number; hasMore: boolean }
}
type Action = {
  path: string
  method: "POST" | "PUT" | "DELETE"
  body?: unknown
  success: string
}
type GroupView = "empty" | "pending" | "joined"

const root = "/v1/contribution/groups"
const statusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
} as const
const permissionGroups = [
  {
    label: "Quyền manga",
    description: "Thêm, sửa và xóa manga",
    permissions: ["canAddManga", "canEditManga", "canDeleteManga"],
  },
  {
    label: "Quyền chapter",
    description: "Thêm, sửa và xóa chapter",
    permissions: ["canAddChapter", "canEditChapter", "canDeleteChapter"],
  },
] as const satisfies ReadonlyArray<{
  label: string
  description: string
  permissions: ReadonlyArray<PermissionKey>
}>

export function applyPermissionGroup(
  current: GroupPermissions,
  permissions: ReadonlyArray<PermissionKey>,
  checked: boolean
) {
  const next = { ...current }
  for (const permission of permissions) next[permission] = checked
  return next
}
// const linkLabels: Record<string, string> = {
//   facebook: "Facebook",
//   discord: "Discord",
//   website: "Website",
//   twitter: "X/Twitter",
// }
const groupLinkFields = [
  {
    name: "facebook",
    label: "Facebook",
    placeholder: "https://www.facebook.com/...",
    type: "url",
  },
  {
    name: "discord",
    label: "Discord",
    placeholder: "https://discord.gg/...",
    type: "text",
  },
] as const

function groupInput(
  data: GroupFormValues,
  existingLinks?: Group["links"]
): GroupInput {
  return {
    name: data.name,
    description: data.description,
    links: {
      ...(existingLinks?.website ? { website: existingLinks.website } : {}),
      facebook: data.facebook,
      discord: data.discord,
      ...(existingLinks?.twitter ? { twitter: existingLinks.twitter } : {}),
    },
  }
}

export function resolveGroupView(
  approvalStatus: Group["approvalStatus"] | null,
  membershipStatus: Membership["status"] | null
): GroupView {
  if (
    !approvalStatus ||
    !membershipStatus ||
    approvalStatus === "rejected" ||
    membershipStatus === "rejected"
  )
    return "empty"
  if (approvalStatus === "pending" || membershipStatus === "pending")
    return "pending"
  return "joined"
}

async function request<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const fallback: Record<number, string> = {
      401: "Phiên đăng nhập đã hết hạn.",
      403: "Bạn không có quyền thực hiện thao tác này.",
      404: "Không tìm thấy nhóm hoặc yêu cầu.",
      409: "Bạn đã có nhóm hoặc một yêu cầu đang chờ duyệt.",
      429: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    }
    const message =
      typeof body === "object" &&
      body &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error &&
      "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : fallback[response.status] || "Không thể kết nối tới máy chủ."
    throw new Error(message)
  }
  return body as T
}

export function GroupWorkspace() {
  const account = useAccount()
  const searchParams = useSearchParams()
  const requestedGroupId = searchParams.get("join")
  const requestedGroupQuery = searchParams.get("q") ?? ""

  if (account.status === "loading")
    return <Spinner aria-label="Đang tải tài khoản" className="self-center" />
  if (account.status === "guest") return <LoginRequired />
  if (account.status !== "authenticated" || !account.user)
    return (
      <Alert>
        <AlertTitle>Không thể tải tài khoản</AlertTitle>
        <AlertDescription>
          <Button onClick={() => void account.retry()}>Thử lại</Button>
        </AlertDescription>
      </Alert>
    )

  return (
    <GroupContent
      key={`${account.user.id}:${account.identity!.sessionId}`}
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
      sessionId={account.identity!.sessionId}
      accountActive={account.account?.profile.status === "active"}
      requestedGroupId={requestedGroupId}
      requestedGroupQuery={requestedGroupQuery}
    />
  )
}

function LoginRequired() {
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Bạn cần đăng nhập để dùng chức năng này</ItemTitle>
      </ItemContent>
      <ItemActions>
        <Link className={buttonVariants()} href={loginHref("/manage/group")}>
          Đăng nhập
        </Link>
      </ItemActions>
    </Item>
  )
}

function GroupContent({
  apiBaseUrl,
  userId,
  sessionId,
  accountActive,
  requestedGroupId,
  requestedGroupQuery,
}: {
  apiBaseUrl: string
  userId: string
  sessionId: string
  accountActive: boolean
  requestedGroupId: string | null
  requestedGroupQuery: string
}) {
  const queryClient = useQueryClient()
  const [transferTarget, setTransferTarget] = useState<Membership | null>(null)
  const queryKey = ["account", apiBaseUrl, userId, "groups"] as const
  const [dialog, setDialog] = useState<"create" | "join" | "edit" | null>(
    requestedGroupId ? "join" : null
  )
  const mine = useQuery({
    queryKey: [...queryKey, "me"],
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) =>
      request<MyGroup>(apiBaseUrl, "/v1/me/groups", {}, signal),
  })
  const mutation = useMutation({
    retry: false,
    mutationFn: ({ path, method, body }: Action) =>
      request<unknown>(apiBaseUrl, path, {
        method,
        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { "Content-Type": "application/json" },
            }),
      }),
    onSuccess: async (_data, action) => {
      setDialog(null)
      await queryClient.invalidateQueries({ queryKey })
      toast.add({ type: "success", title: action.success })
    },
    onError: (error: Error) => {
      toast.add({ type: "error", title: error.message })
    },
  })

  if (mine.isPending)
    return <Spinner aria-label="Đang tải nhóm dịch" className="self-center" />
  if (mine.isError)
    return (
      <Alert>
        <AlertTitle>Không thể tải nhóm dịch</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{mine.error.message}</span>
          <Button variant="outline" onClick={() => void mine.refetch()}>
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )

  const current = mine.data.data
  const view = resolveGroupView(
    current?.group.approvalStatus ?? null,
    current?.membership.status ?? null
  )
  const busy = mutation.isPending || !accountActive
  const manageCoin =
    !!current && accountActive && canManageGroupCoin(current, mine.data.isAdmin)
  const act = (action: Action) => {
    if (!busy) mutation.mutate(action)
  }
  const requestJoin = (groupId: string) =>
    act({
      path: `${root}/${groupId}/requests`,
      method: "POST",
      success: "Đã gửi yêu cầu tham gia nhóm.",
    })

  return (
    <div className="flex flex-col gap-5">
      {!accountActive && (
        <Alert variant="destructive">
          <AlertTitle>Tài khoản đang bị hạn chế</AlertTitle>
          <AlertDescription>
            Bạn không thể tạo, tham gia hoặc duyệt yêu cầu nhóm.
          </AlertDescription>
        </Alert>
      )}

      {view === "empty" ? (
        <>
          <Empty className="flex-none items-start border border-solid p-4 text-left text-wrap sm:flex-row sm:items-center sm:justify-between">
            <EmptyHeader className="max-w-none items-start gap-1">
              <EmptyTitle>Bạn chưa có nhóm dịch</EmptyTitle>
              <EmptyDescription>
                Để có quyền đăng truyện, bạn phải là thành viên của một nhóm
                dịch. Bạn có thể tạo nhóm dịch mới hoặc xin gia nhập nhóm bên
                dưới.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="w-auto max-w-none shrink-0 flex-row flex-wrap gap-2">
              <Button disabled={busy} onClick={() => setDialog("create")}>
                <PlusIcon data-icon="inline-start" />
                Tạo nhóm dịch
              </Button>
            </EmptyContent>
          </Empty>
          <GroupDiscovery
            apiBaseUrl={apiBaseUrl}
            busy={busy}
            onJoin={requestJoin}
          />
        </>
      ) : (
        current && (
          <GroupSummary
            current={current}
            pending={view === "pending"}
            busy={busy}
            onEdit={() => setDialog("edit")}
            onCancel={() =>
              act({
                path: `${root}/${current.group.id}/requests/me`,
                method: "DELETE",
                success: "Đã hủy yêu cầu.",
              })
            }
            onLeave={() =>
              act({
                path: `${root}/${current.group.id}/membership`,
                method: "DELETE",
                success: "Đã rời nhóm.",
              })
            }
          />
        )
      )}

      {view === "joined" && current && (
        <>
          {(current.membership.role === "leader" || mine.data.isAdmin) && (
            <MembershipList
              apiBaseUrl={apiBaseUrl}
              userId={userId}
              groupId={current.group.id}
              status="pending"
              busy={busy}
              onReview={(member, action) =>
                act({
                  path: `${root}/${current.group.id}/requests/${encodeURIComponent(member.userId)}`,
                  method: "PUT",
                  body: {
                    action,
                  },
                  success:
                    action === "approve"
                      ? `Đã duyệt ${member.name}.`
                      : `Đã từ chối ${member.name}.`,
                })
              }
            />
          )}
          <MembershipList
            apiBaseUrl={apiBaseUrl}
            userId={userId}
            groupId={current.group.id}
            status="approved"
            busy={busy}
            coinWallet={
              manageCoin ? (
                <GroupCoinWallet
                  key={`${userId}:${sessionId}:${current.group.id}`}
                  apiBaseUrl={apiBaseUrl}
                  identity={{ userId, sessionId }}
                  groupId={current.group.id}
                  recipient={transferTarget}
                  onClose={() => setTransferTarget(null)}
                  disabled={busy}
                />
              ) : undefined
            }
            onTransfer={manageCoin ? setTransferTarget : undefined}
            onPermissionsChange={
              current.membership.role === "leader"
                ? (member, permissions) =>
                    act({
                      path: `${root}/${current.group.id}/members/${encodeURIComponent(member.userId)}/permissions`,
                      method: "PUT",
                      body: permissions,
                      success: `Đã cập nhật quyền của ${member.name}.`,
                    })
                : undefined
            }
            onRemove={
              current.membership.role === "leader"
                ? (member) =>
                    act({
                      path: `${root}/${current.group.id}/members/${encodeURIComponent(member.userId)}`,
                      method: "DELETE",
                      success: `Đã buộc ${member.name} rời nhóm.`,
                    })
                : undefined
            }
          />
        </>
      )}

      <GroupFormDialog
        apiBaseUrl={apiBaseUrl}
        open={dialog === "create" && view === "empty"}
        busy={busy}
        onOpenChange={(open) => setDialog(open ? "create" : null)}
        onSubmit={(body) =>
          act({
            path: root,
            method: "POST",
            body,
            success: "Đã gửi yêu cầu tạo nhóm.",
          })
        }
      />
      {view === "joined" && current?.membership.role === "leader" && (
        <GroupFormDialog
          apiBaseUrl={apiBaseUrl}
          group={current.group}
          open={dialog === "edit"}
          busy={busy}
          onOpenChange={(open) => setDialog(open ? "edit" : null)}
          onSubmit={(body) =>
            act({
              path: `${root}/${current.group.id}`,
              method: "PUT",
              body,
              success: "Đã cập nhật thông tin nhóm.",
            })
          }
        />
      )}
      <JoinGroupDialog
        apiBaseUrl={apiBaseUrl}
        initialQuery={requestedGroupQuery}
        open={dialog === "join" && view === "empty"}
        busy={busy}
        onOpenChange={(open) => setDialog(open ? "join" : null)}
        onSubmit={requestJoin}
      />
    </div>
  )
}

export function GroupSummary({
  current,
  pending,
  busy,
  onEdit,
  onCancel,
  onLeave,
}: {
  current: NonNullable<MyGroup["data"]>
  pending: boolean
  busy: boolean
  onEdit: () => void
  onCancel: () => void
  onLeave: () => void
}) {
  const { group, membership } = current
  return (
    <Item variant="outline" className="rounded-xl bg-card p-6">
      <ItemMedia>
        <Avatar className="size-12 rounded-md after:rounded-md">
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
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="text-lg">
          {group.name}{" "}
          <Badge variant={pending ? "secondary" : "default"}>
            {pending
              ? statusLabels[
                  group.approvalStatus === "pending"
                    ? group.approvalStatus
                    : membership.status
                ]
              : group.inactive
                ? "Ngừng hoạt động"
                : "Đang hoạt động"}
          </Badge>
        </ItemTitle>
        <ItemDescription>
          {membership.role === "leader" ? "Trưởng nhóm" : "Thành viên"}
        </ItemDescription>
      </ItemContent>

      <ItemActions className="flex-wrap">
        {group.approvalStatus === "approved" && (
          <>
            <Link
              className={buttonVariants({ variant: "default", size: "sm" })}
              href={`/group/${group.id}/${group.slug}`}
            >
              Xem trang nhóm
            </Link>
            {membership.status === "approved" && (
              <>
                <Link
                  className={buttonVariants({ variant: "default", size: "sm" })}
                  href={`/manage/group/mangas`}
                >
                  QL Truyện
                </Link>
                {membership.role === "leader" && (
                  <Button size="sm" disabled={busy} onClick={onEdit}>
                    Sửa thông tin
                  </Button>
                )}
              </>
            )}
          </>
        )}
        {pending && (
          <Button variant="destructive" disabled={busy} onClick={onCancel}>
            Hủy yêu cầu
          </Button>
        )}
        {!pending && membership.role === "member" && (
          <Button variant="destructive" disabled={busy} onClick={onLeave}>
            Rời nhóm
          </Button>
        )}
      </ItemActions>
    </Item>
  )
}

export function MembershipList({
  apiBaseUrl,
  userId,
  groupId,
  status,
  busy,
  onReview,
  onRemove,
  onPermissionsChange,
  onTransfer,
  coinWallet,
}: {
  apiBaseUrl: string
  userId: string
  groupId: string
  status: "pending" | "approved"
  busy: boolean
  onReview?: (member: Membership, action: "approve" | "reject") => void
  onRemove?: (member: Membership) => void
  onPermissionsChange?: (
    member: Membership,
    permissions: GroupPermissions
  ) => void
  onTransfer?: (member: Membership) => void
  coinWallet?: React.ReactNode
}) {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Membership | null>(null)
  const members = useQuery({
    queryKey: [
      "account",
      apiBaseUrl,
      userId,
      "groups",
      groupId,
      "members",
      status,
      page,
    ],
    enabled: open,
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) =>
      request<MembershipPage>(
        apiBaseUrl,
        `${root}/${groupId}/members?status=${status}&page=${page}&limit=20`,
        {},
        signal
      ),
  })
  const pending = status === "pending"

  return (
    <>
      <Collapsible
        className="group/collapsible"
        open={open}
        onOpenChange={setOpen}
        render={<Card />}
      >
        <CardHeader>
          <CardTitle>
            {pending ? "Yêu cầu tham gia nhóm" : "Danh sách thành viên"}
          </CardTitle>
          <CardDescription>
            {pending
              ? "Duyệt các thành viên xin vào nhóm"
              : "Các thành viên hiện tại của nhóm dịch"}
            {coinWallet && <div className="mt-2">{coinWallet}</div>}
          </CardDescription>
          <CardAction>
            <CollapsibleTrigger
              aria-label={`Thu gọn hoặc mở rộng ${pending ? "yêu cầu tham gia nhóm" : "danh sách thành viên"}`}
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
          <CardContent>
            {members.isPending ? (
              <Spinner
                aria-label={
                  pending
                    ? "Đang tải yêu cầu tham gia"
                    : "Đang tải danh sách thành viên"
                }
                className="self-center"
              />
            ) : members.isError ? (
              <Alert>
                <AlertTitle>
                  {pending
                    ? "Không thể tải yêu cầu tham gia"
                    : "Không thể tải danh sách thành viên"}
                </AlertTitle>
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
                  <EmptyDescription>
                    {pending
                      ? "Không có yêu cầu nào"
                      : "Chưa có thành viên nào"}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup>
                {members.data.data.map((member) => (
                  <Item key={member.userId} variant="outline">
                    <ItemMedia>
                      <AvatarDecoration frame={member.avatarFrame ?? null}>
                        <Avatar className="size-10">
                          <AvatarFallback>
                            {initials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                      </AvatarDecoration>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{member.name}</ItemTitle>
                      <ItemDescription>
                        {pending
                          ? "Đang chờ duyệt"
                          : member.role === "leader"
                            ? "Trưởng nhóm"
                            : "Thành viên"}
                      </ItemDescription>
                    </ItemContent>
                    {pending && onReview ? (
                      <ItemActions className="ml-auto">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => onReview(member, "approve")}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onReview(member, "reject")}
                        >
                          Từ chối
                        </Button>
                      </ItemActions>
                    ) : onTransfer ||
                      (member.role === "member" &&
                        (onPermissionsChange || onRemove)) ? (
                      <ItemActions className="ml-auto flex-wrap">
                        {onTransfer && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onTransfer(member)}
                          >
                            Chuyển coin
                          </Button>
                        )}
                        {member.role === "member" && onPermissionsChange && (
                          <PermissionMenu
                            member={member}
                            disabled={busy}
                            onChange={onPermissionsChange}
                          />
                        )}
                        {member.role === "member" && onRemove && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => setRemoveTarget(member)}
                          >
                            Buộc rời nhóm
                          </Button>
                        )}
                      </ItemActions>
                    ) : null}
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
          {members.data && (page > 1 || members.data.meta.hasMore) && (
            <CardFooter className="justify-between gap-3">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Trang trước
              </Button>
              <span className="text-sm text-muted-foreground">
                Trang {page}
              </span>
              <Button
                variant="outline"
                disabled={!members.data.meta.hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang sau
              </Button>
            </CardFooter>
          )}
        </CollapsibleContent>
      </Collapsible>
      {onRemove && (
        <Dialog
          open={removeTarget !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setRemoveTarget(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buộc thành viên rời nhóm?</DialogTitle>
              <DialogDescription>
                {removeTarget?.name} sẽ mất quyền thành viên của nhóm dịch.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRemoveTarget(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || !removeTarget}
                onClick={() => {
                  if (!removeTarget) return
                  onRemove(removeTarget)
                  setRemoveTarget(null)
                }}
              >
                Xác nhận
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export function PermissionMenu({
  member,
  disabled,
  onChange,
}: {
  member: Membership
  disabled: boolean
  onChange: (member: Membership, permissions: GroupPermissions) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" disabled={disabled} />}
      >
        Phân quyền
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {permissionGroups.map((group) => (
          <DropdownMenuCheckboxItem
            key={group.label}
            checked={group.permissions.every(
              (permission) => member.permissions[permission]
            )}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange(
                member,
                applyPermissionGroup(
                  member.permissions,
                  group.permissions,
                  checked
                )
              )
            }
          >
            <span className="flex flex-col">
              <span>{group.label}</span>
              <span className="text-xs text-muted-foreground">
                {group.description}
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function GroupFormDialog({
  apiBaseUrl,
  group,
  lockName = false,
  open,
  busy,
  onOpenChange,
  onSubmit,
}: {
  apiBaseUrl: string
  group?: Group
  lockName?: boolean
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: GroupInput) => void
}) {
  const [mediaBusy, setMediaBusy] = useState(false)
  const editing = group !== undefined
  const name = group?.name ?? ""
  const description = group?.description ?? ""
  const facebook = group?.links.facebook ?? ""
  const discord = group?.links.discord ?? ""
  const idPrefix = editing ? "edit-group" : "create-group"
  const form = useForm<GroupFormInput, unknown, GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name,
      description,
      facebook,
      discord,
    },
    mode: "onBlur",
  })
  const { reset } = form

  useEffect(() => {
    if (open) reset({ name, description, facebook, discord })
  }, [description, discord, facebook, name, open, reset])

  const dialogBusy = busy || mediaBusy

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && dialogBusy) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={`max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 ${group ? "md:max-w-4xl" : ""}`}
      >
        <DialogHeader className="p-6 pr-12 pb-4">
          <DialogTitle>
            {editing ? "Sửa thông tin nhóm" : "Tạo nhóm dịch"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Cập nhật thông tin hiển thị trên trang nhóm dịch."
              : "Nhóm dịch mới cần chờ xét duyệt trước khi đăng truyện. Bạn có thể đặt avatar và banner nhóm sau khi nhóm được duyệt."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
          onSubmit={form.handleSubmit((data) => {
            onSubmit(groupInput(data, group?.links))
          })}
        >
          <div
            className={`grid min-h-0 gap-6 overflow-y-auto p-6 pt-2 ${group ? "md:grid-cols-2" : ""}`}
          >
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-disabled={dialogBusy || lockName || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor={`${idPrefix}-name`}>
                      Tên nhóm dịch
                    </FieldLabel>
                    <Input
                      {...field}
                      id={`${idPrefix}-name`}
                      aria-invalid={fieldState.invalid}
                      required
                      maxLength={80}
                      disabled={dialogBusy || lockName}
                    />
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
                    data-disabled={dialogBusy || undefined}
                    data-invalid={fieldState.invalid || undefined}
                  >
                    <FieldLabel htmlFor={`${idPrefix}-description`}>
                      Giới thiệu
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={`${idPrefix}-description`}
                      aria-invalid={fieldState.invalid}
                      maxLength={1_000}
                      rows={4}
                      disabled={dialogBusy}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              {groupLinkFields.map(({ name, label, placeholder, type }) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-disabled={dialogBusy || undefined}
                      data-invalid={fieldState.invalid || undefined}
                    >
                      <FieldLabel htmlFor={`${idPrefix}-${name}`}>
                        {label}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={`${idPrefix}-${name}`}
                        type={type}
                        aria-invalid={fieldState.invalid}
                        maxLength={220}
                        disabled={dialogBusy}
                        placeholder={placeholder}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              ))}
            </FieldGroup>
            {group ? (
              <GroupMediaFields
                apiBaseUrl={apiBaseUrl}
                disabled={busy}
                group={group}
                key={group.id}
                onPendingChange={setMediaBusy}
              />
            ) : null}
          </div>
          <DialogFooter className="border-t p-6 pt-4">
            <Button type="submit" disabled={dialogBusy}>
              {editing ? "Lưu thay đổi" : "Gửi yêu cầu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function JoinGroupDialog({
  apiBaseUrl,
  initialQuery,
  open,
  busy,
  onOpenChange,
  onSubmit,
}: {
  apiBaseUrl: string
  initialQuery: string
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (groupId: string) => void
}) {
  const [search, setSearch] = useState(initialQuery)
  const activeQuery = search.trim()
  const [query] = useDebouncedValue(activeQuery, 300)
  const groups = useQuery({
    queryKey: ["public-groups", apiBaseUrl, "search", query],
    enabled: open && query.length > 0 && activeQuery === query,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      request<GroupList>(
        apiBaseUrl,
        `/v1/groups?${new URLSearchParams({ q: query })}`,
        {},
        signal
      ),
  })
  const results =
    groups.data?.data.filter(
      (group) => !group.inactive && group.slug !== "system"
    ) ?? []
  const waiting = activeQuery.length > 0 && activeQuery !== query

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tham gia nhóm</DialogTitle>
          <DialogDescription>
            Tìm nhóm dịch và gửi yêu cầu tham gia.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="group-search">Tìm theo tên nhóm</FieldLabel>
          <Input
            id="group-search"
            type="search"
            autoComplete="off"
            placeholder="Nhập tên nhóm..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        {!activeQuery ? (
          <p className="text-sm text-muted-foreground">
            Nhập từ khóa để bắt đầu tìm kiếm.
          </p>
        ) : waiting || groups.isPending || groups.isFetching ? (
          <p className="text-sm text-muted-foreground">Đang tìm...</p>
        ) : groups.isError ? (
          <Button variant="outline" onClick={() => void groups.refetch()}>
            Thử lại
          </Button>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Không tìm thấy nhóm nào
          </p>
        ) : (
          <ItemGroup className="max-h-[min(28rem,55vh)] overflow-y-auto pr-1">
            {results.map((group) => (
              <Item key={group.id} variant="outline">
                <ItemMedia>
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
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{group.name}</ItemTitle>
                  <ItemDescription>/{group.slug}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => onSubmit(group.id)}
                  >
                    <UserPlusIcon data-icon="inline-start" />
                    Tham gia
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </DialogContent>
    </Dialog>
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
