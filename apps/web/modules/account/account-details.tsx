"use client"

import Link from "next/link"
import {
  BadgeCheckIcon,
  CalendarIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  GlobeIcon,
  HistoryIcon,
  LinkIcon,
  LogOutIcon,
  MailIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react"
import SiDiscord from "@icons-pack/react-simple-icons/icons/SiDiscord"
import SiGithub from "@icons-pack/react-simple-icons/icons/SiGithub"
import SiGoogle from "@icons-pack/react-simple-icons/icons/SiGoogle"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date"
import { loginHref } from "./api"
import { ProfileEditor } from "./profile-editor"
import { useAccount } from "./provider"
import {
  ProfileDetailGrid,
  ProfileHeader,
  ProfileHeaderSkeleton,
} from "./profile"
import { OwnAvatarFrames } from "@/modules/avatar-frames/account-inventory"

const providers = {
  discord: { name: "Discord", icon: SiDiscord },
  github: { name: "GitHub", icon: SiGithub },
  google: { name: "Google", icon: SiGoogle },
  credential: { name: "Mật khẩu", icon: ShieldCheckIcon },
}

export function AccountDetails() {
  const { status, account, retry, signOut } = useAccount()
  if (status === "loading") return <AccountSkeleton />
  if (status === "guest")
    return (
      <Alert>
        <AlertTitle>Bạn chưa đăng nhập</AlertTitle>
        <AlertDescription>
          Đăng nhập để xem thông tin tài khoản của bạn.
        </AlertDescription>
        <Button
          className="mt-3 w-fit"
          nativeButton={false}
          render={<Link href={loginHref("/manage/account")} />}
        >
          Đăng nhập
        </Button>
      </Alert>
    )
  if (!account)
    return (
      <Alert variant="destructive">
        <AlertTitle>Chưa tải được tài khoản</AlertTitle>
        <AlertDescription>
          Kiểm tra kết nối và thử lại. Thông tin tài khoản cũ sẽ không được hiển
          thị.
        </AlertDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void retry()}>
            Thử lại
          </Button>
          <Button
            variant="outline"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            {signOut.isPending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : (
              <LogOutIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {signOut.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
          </Button>
        </div>
        {signOut.isError && (
          <p className="mt-2 text-sm text-destructive">
            Đăng xuất chưa thành công. Vui lòng thử lại.
          </p>
        )}
      </Alert>
    )

  const { user, profile } = account
  const name = user.name || "Độc giả"
  const verification = user.emailVerified ? "Đã xác minh" : "Chưa xác minh"
  const details = [
    { label: "User ID", value: user.id, icon: FingerprintIcon },
    { label: "Tên hiển thị", value: name, icon: UserIcon },
    { label: "Email", value: user.email, icon: MailIcon },
    {
      label: "Ngày tham gia",
      value: formatVietnamDate(user.createdAt),
      icon: CalendarIcon,
    },
    { label: "Trạng thái xác thực", value: verification, icon: BadgeCheckIcon },
    {
      label: "Cập nhật tài khoản lần cuối",
      value: formatVietnamDateTime(user.updatedAt),
      icon: HistoryIcon,
    },
    {
      label: "Cập nhật hồ sơ lần cuối",
      value: formatVietnamDateTime(profile.updatedAt),
      icon: HistoryIcon,
    },
    {
      label: "Hiển thị trang cá nhân",
      value: profile.isPublic ? "Công khai" : "Riêng tư",
      icon: GlobeIcon,
    },
    {
      label: "Trạng thái tài khoản",
      value:
        profile.status === "active"
          ? "Hoạt động"
          : profile.status === "suspended"
            ? "Tạm hạn chế"
            : "Đã ban",
      icon: ShieldCheckIcon,
    },
    {
      label: "Tài khoản liên kết",
      icon: LinkIcon,
      value: account.linkedProviders.length ? (
        <div className="flex flex-wrap gap-2">
          {account.linkedProviders.map((id) => {
            const { icon: Icon, name: label } = providers[
              id as keyof typeof providers
            ] ?? { name: id, icon: LinkIcon }
            return (
              <Badge key={id} variant="secondary">
                <Icon aria-hidden="true" data-icon="inline-start" />
                {label}
              </Badge>
            )
          })}
        </div>
      ) : (
        "Chưa có tài khoản liên kết."
      ),
    },
  ]
  return (
    <>
      <ProfileHeader
        profile={{ name, image: user.image }}
        avatarFrame={user.avatarFrame}
        avatarShape="circle"
        bio={profile.bio}
      >
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge variant="secondary">
            <BadgeCheckIcon aria-hidden="true" data-icon="inline-start" />
            {verification}
          </Badge>
          <Badge variant="outline" className="max-w-full min-w-0">
            <MailIcon aria-hidden="true" data-icon="inline-start" />
            <span className="truncate" title={user.email}>
              {user.email}
            </span>
          </Badge>
        </div>
      </ProfileHeader>
      {profile.status !== "active" && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>
            {profile.status === "suspended"
              ? "Tài khoản đang bị tạm hạn chế"
              : "Tài khoản đã bị ban"}
          </AlertTitle>
          <AlertDescription>
            Bạn vẫn có thể xem thông tin của mình, nhưng không thể tạo hoặc cập
            nhật nội dung. Trang cá nhân công khai hiện không khả dụng.
          </AlertDescription>
        </Alert>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {profile.status === "active" && <ProfileEditor />}
        {profile.isPublic && profile.status === "active" && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/profile/${user.id}`} prefetch={false} />}
          >
            <ExternalLinkIcon aria-hidden="true" data-icon="inline-start" />
            Xem trang cá nhân
          </Button>
        )}
        <OwnAvatarFrames />
        <Button
          variant="destructive"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          {signOut.isPending ? (
            <Spinner aria-hidden="true" data-icon="inline-start" />
          ) : (
            <LogOutIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {signOut.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
        </Button>
      </div>
      {signOut.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Đăng xuất chưa thành công. Vui lòng thử lại.
        </p>
      )}
      <section className="mt-6 flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Thông tin tài khoản</h2>
        <ProfileDetailGrid className="lg:grid-cols-3" details={details} />
      </section>
    </>
  )
}

function AccountSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải thông tin tài khoản"
      className="flex flex-col gap-6"
    >
      <ProfileHeaderSkeleton />
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-32" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56 max-w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
