"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Bowser from "bowser"
import {
  BanIcon,
  MonitorSmartphoneIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { useAccount } from "@/modules/account/provider"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import { AdminUserAvatarFrames } from "@/modules/avatar-frames/admin-user-frames"
import {
  accountActionDescription,
  accountActionErrorMessage,
  accountActionLabel,
  accountStatusLabels,
  adminAccountRequest,
  AdminAccountError,
  type AccountStatus,
  type AdminUserDetail as AdminUser,
  adminUserQueryKey,
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
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

type AdminUserSession =
  paths["/v1/admin/users/{id}/sessions"]["get"]["responses"][200]["content"]["application/json"]["data"][number]

const providerLabels: Record<string, string> = {
  credential: "Email/Mật khẩu",
  discord: "Discord",
  github: "GitHub",
  google: "Google",
}

const platformLabels: Record<string, string> = {
  desktop: "Máy tính",
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  tv: "TV",
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Thiết bị không xác định"
  try {
    const parsed = Bowser.parse(userAgent)
    const parts = [
      parsed.browser.name,
      parsed.os.name,
      parsed.platform.type
        ? (platformLabels[parsed.platform.type] ?? parsed.platform.type)
        : undefined,
    ].filter(Boolean)
    return parts.join(" · ") || "Thiết bị không xác định"
  } catch {
    return "Thiết bị không xác định"
  }
}

function statusVariant(status: AccountStatus) {
  if (status === "banned") return "destructive" as const
  if (status === "suspended") return "secondary" as const
  return "outline" as const
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-break-word">{value}</dd>
    </div>
  )
}

function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={statusVariant(status)}>{accountStatusLabels[status]}</Badge>
  )
}

export function AdminAccountDetail({ targetUserId }: { targetUserId: string }) {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminAccountDetailContent
      actorUserId={account.user.id}
      apiBaseUrl={account.apiBaseUrl}
      targetUserId={targetUserId}
    />
  )
}

function AdminAccountDetailContent({
  actorUserId,
  apiBaseUrl,
  targetUserId,
}: {
  actorUserId: string
  apiBaseUrl: string
  targetUserId: string
}) {
  const queryClient = useQueryClient()
  const [targetStatus, setTargetStatus] = useState<AccountStatus | null>(null)
  const queryKey = adminUserQueryKey(apiBaseUrl, actorUserId, targetUserId)
  const detail = useQuery({
    queryKey,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      adminAccountRequest<{ data: AdminUser }>(
        apiBaseUrl,
        `/v1/admin/users/${encodeURIComponent(targetUserId)}`,
        {},
        signal
      ),
  })
  const sessions = useQuery({
    queryKey: [...queryKey, "sessions"],
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      adminAccountRequest<{ data: AdminUserSession[] }>(
        apiBaseUrl,
        `/v1/admin/users/${encodeURIComponent(targetUserId)}/sessions`,
        {},
        signal
      ),
  })
  const user = detail.data?.data
  const mutation = useMutation({
    retry: false,
    mutationFn: (status: AccountStatus) =>
      runAdminAccountStatusAction(apiBaseUrl, user!, status),
    onSuccess: async (_response, status) => {
      setTargetStatus(null)
      toast.add({
        type: "success",
        title:
          status === "suspended"
            ? "Đã tạm hạn chế tài khoản"
            : status === "banned"
              ? "Đã ban tài khoản"
              : user?.status === "banned"
                ? "Đã gỡ ban tài khoản"
                : "Đã khôi phục tài khoản",
      })
      await Promise.all([
        detail.refetch(),
        sessions.refetch(),
        queryClient.invalidateQueries({
          queryKey: adminUsersQueryKey(apiBaseUrl, actorUserId),
        }),
      ])
    },
    onError: async (error) => {
      if (!(error instanceof AdminAccountError)) return
      if (error.code === "VERSION_CONFLICT") await detail.refetch()
      if (error.code === "STATE_UNCHANGED") {
        setTargetStatus(null)
        await detail.refetch()
        toast.add({ title: "Trạng thái tài khoản đã được cập nhật trước đó" })
      }
    },
  })
  const openAction = (status: AccountStatus) => {
    mutation.reset()
    setTargetStatus(status)
  }

  if (detail.isPending)
    return (
      <Spinner
        aria-label="Đang tải thông tin người dùng"
        className="self-center"
      />
    )

  if (detail.isError || !user)
    return (
      <Alert variant="destructive">
        <AlertTitle>Không thể tải thông tin người dùng</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{detail.error?.message}</span>
          <Button onClick={() => void detail.refetch()} variant="outline">
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )

  return (
    <>
      <div className="flex justify-end">
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/admin/audit?targetKind=user&targetId=${encodeURIComponent(user.id)}`}
            />
          }
          variant="outline"
        >
          <ScrollTextIcon aria-hidden="true" data-icon="inline-start" />
          Xem nhật ký
        </Button>
      </div>
      {user.status !== "active" ? (
        <Alert variant={user.status === "banned" ? "destructive" : "default"}>
          <ShieldAlertIcon aria-hidden="true" />
          <AlertTitle>
            {user.status === "banned"
              ? "Tài khoản đã bị ban"
              : "Tài khoản đang bị tạm hạn chế"}
          </AlertTitle>
          <AlertDescription>
            {user.status === "banned"
              ? "Người dùng không thể đăng nhập cho đến khi được gỡ ban."
              : "Người dùng không thể tạo hoặc chỉnh sửa nội dung."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <AvatarDecoration frame={user.avatarFrame ?? null}>
              <Avatar className="size-14 overflow-hidden">
                {user.image ? <AvatarImage alt="" src={user.image} /> : null}
                <AvatarFallback>
                  {user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </AvatarDecoration>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg">{user.name}</CardTitle>
              <CardDescription className="truncate">
                {user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <AccountStatusBadge status={user.status} />
            {user.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
          </div>
          <dl className="grid gap-5 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="ID" value={user.id} />
            <DetailField
              label="Email"
              value={user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
            />
            <DetailField
              label="Tài khoản liên kết"
              value={
                user.linkedProviders.length ? (
                  <span className="flex flex-wrap gap-1">
                    {user.linkedProviders.map((provider) => (
                      <Badge key={provider} variant="outline">
                        {providerLabels[provider] ?? provider}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "Không có"
                )
              }
            />
            <DetailField
              label="Hồ sơ"
              value={user.isPublic ? "Công khai" : "Riêng tư"}
            />
            <DetailField label="Phiên bản" value={user.version} />
            <DetailField
              label="Ngày tạo"
              value={formatVietnamDateTimeInline(user.createdAt)}
            />
            <DetailField
              label="Cập nhật"
              value={formatVietnamDateTimeInline(user.updatedAt)}
            />
          </dl>
          {user.bio ? (
            <div className="border-t pt-5">
              <p className="text-xs font-medium text-muted-foreground">
                Giới thiệu
              </p>
              <p className="mt-1 wrap-break-word whitespace-pre-wrap">
                {user.bio}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AdminUserAvatarFrames
        key={`${apiBaseUrl}:${actorUserId}:${targetUserId}`}
        actorUserId={actorUserId}
        apiBaseUrl={apiBaseUrl}
        targetUserId={targetUserId}
        userName={user.name}
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Phiên đăng nhập đang hoạt động</CardTitle>
          <CardDescription>
            IP và thiết bị được ghi nhận khi phiên đăng nhập được tạo. Hiển thị
            tối đa 100 phiên gần nhất.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.isPending ? (
            <Spinner
              aria-label="Đang tải phiên đăng nhập"
              className="self-center"
            />
          ) : sessions.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Không thể tải phiên đăng nhập</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <span>{sessions.error.message}</span>
                <Button
                  onClick={() => void sessions.refetch()}
                  variant="outline"
                >
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          ) : sessions.data.data.length ? (
            <ul className="divide-y overflow-hidden rounded-md border">
              {sessions.data.data.map((session) => (
                <li className="space-y-3 p-3" key={session.id}>
                  <div className="flex min-w-0 items-center gap-2">
                    <MonitorSmartphoneIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <p
                      className="truncate font-medium"
                      title={session.userAgent ?? undefined}
                    >
                      {deviceLabel(session.userAgent)}
                    </p>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <DetailField
                      label="Địa chỉ IP"
                      value={session.ipAddress ?? "Không xác định"}
                    />
                    <DetailField
                      label="Tạo lúc"
                      value={formatVietnamDateTimeInline(session.createdAt)}
                    />
                    <DetailField
                      label="Hết hạn"
                      value={formatVietnamDateTimeInline(session.expiresAt)}
                    />
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Không có phiên đăng nhập đang hoạt động.
            </p>
          )}
        </CardContent>
      </Card>

      {user.moderatedAt ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Kiểm duyệt gần nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label="Thời điểm"
                value={formatVietnamDateTimeInline(user.moderatedAt)}
              />
              <DetailField
                label="Người thực hiện"
                value={user.moderatedByUserId ?? "Không có"}
              />
              <DetailField
                label="Lý do hệ thống"
                value={user.moderationReason ?? "Không có"}
              />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>Trạng thái tài khoản</CardTitle>
          <CardDescription>
            Các thao tác sẽ thu hồi phiên đăng nhập hiện hữu và được ghi audit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-row flex-wrap">
          {user.status === "active" ? (
            <>
              <Button
                onClick={() => openAction("suspended")}
                variant="secondary"
              >
                <ShieldAlertIcon aria-hidden="true" data-icon="inline-start" />
                Tạm hạn chế
              </Button>
              <Button
                onClick={() => openAction("banned")}
                variant="destructive"
              >
                <BanIcon aria-hidden="true" data-icon="inline-start" />
                Ban tài khoản
              </Button>
            </>
          ) : user.status === "suspended" ? (
            <>
              <Button onClick={() => openAction("active")}>
                <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
                Khôi phục
              </Button>
              <Button
                onClick={() => openAction("banned")}
                variant="destructive"
              >
                <BanIcon aria-hidden="true" data-icon="inline-start" />
                Ban tài khoản
              </Button>
            </>
          ) : (
            <Button onClick={() => openAction("active")}>
              <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
              Gỡ ban
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={targetStatus !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setTargetStatus(null)
            mutation.reset()
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {targetStatus
                ? `${accountActionLabel(user.status, targetStatus)} tài khoản?`
                : "Cập nhật tài khoản?"}
            </DialogTitle>
            <DialogDescription>
              {targetStatus
                ? accountActionDescription(user.status, targetStatus)
                : "Xác nhận thay đổi trạng thái tài khoản."}
            </DialogDescription>
          </DialogHeader>
          {mutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Không thể cập nhật tài khoản</AlertTitle>
              <AlertDescription>
                {accountActionErrorMessage(mutation.error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                setTargetStatus(null)
                mutation.reset()
              }}
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!targetStatus || mutation.isPending}
              onClick={() => {
                if (targetStatus) mutation.mutate(targetStatus)
              }}
              variant={targetStatus === "banned" ? "destructive" : "default"}
            >
              {mutation.isPending ? <Spinner aria-hidden="true" /> : null}
              {targetStatus
                ? accountActionLabel(user.status, targetStatus)
                : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
