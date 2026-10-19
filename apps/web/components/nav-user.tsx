"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ChevronsUpDownIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  UserIcon,
  UserShieldIcon,
  UsersIcon,
} from "lucide-react"

import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import { ProfileAvatar } from "@/modules/account/profile"
import { coinLabel } from "@/modules/shop/admin-api"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

const roleColor = {
  user: "text-muted-foreground",
  member: "text-info",
  leader: "text-warning",
  admin: "text-destructive",
} as const

function NavUserBalance() {
  const account = useAccount()
  if (
    account.status !== "authenticated" ||
    account.account?.profile.status !== "active"
  )
    return null
  const balance = account.account.coinBalance

  return (
    <Card size="sm" className="mx-2 mt-1 mb-2 gap-0 py-3 rounded-md bg-card/30">
      <CardContent className="flex-row items-center gap-3 px-3">
        <Image
          src="/images/suicao_coin.webp"
          alt=""
          width={28}
          height={28}
          className="shrink-0"
          unoptimized
        />
        <div className="min-w-0" aria-live="polite" aria-atomic="true">
          <p className="text-xs text-muted-foreground">Số dư của bạn</p>
          {typeof balance === "string" ? (
            <p className="wrap-break-word font-semibold text-warning tabular-nums">
              {coinLabel(balance)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Số dư chưa khả dụng</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function NavUser() {
  const { status, user, account, error, retry, signOut } = useAccount()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {status === "loading" ? (
          <div
            role="status"
            aria-label="Đang tải tài khoản"
            className="flex h-12 items-center gap-2 group-data-[collapsible=icon]:h-8"
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1 group-data-[collapsible=icon]:hidden" />
          </div>
        ) : status === "error" && !user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  aria-label="Tùy chọn khi không tải được tài khoản"
                  className="h-12"
                  tooltip={{ children: error, side: "left" }}
                  variant="outline"
                />
              }
            >
              <RefreshCwIcon aria-hidden="true" />
              <span>Thử tải lại tài khoản</span>
              <ChevronsUpDownIcon
                aria-hidden="true"
                className="ml-auto group-data-[collapsible=icon]:hidden"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isMobile ? "bottom" : "left"}
              align="start"
              className="w-64 max-w-[calc(100vw-2rem)]"
            >
              <DropdownMenuItem onClick={() => void retry()}>
                <RefreshCwIcon aria-hidden="true" /> Thử lại
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={signOut.isPending}
                closeOnClick={false}
                onClick={() => signOut.mutate()}
                variant="destructive"
              >
                {signOut.isPending ? (
                  <Spinner />
                ) : (
                  <LogOutIcon aria-hidden="true" />
                )}{" "}
                {signOut.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
              </DropdownMenuItem>
              {signOut.isError && (
                <p role="alert" className="p-2 text-sm text-destructive">
                  Đăng xuất không thành công. Vui lòng thử lại.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : !user ? (
          <SidebarMenuButton
            variant="outline"
            aria-label="Đăng nhập"
            className="h-12"
            tooltip={{ children: "Đăng nhập", side: "left" }}
            onClick={() => {
              setOpenMobile(false)
              window.location.assign(
                loginHref(
                  window.location.pathname +
                    window.location.search +
                    window.location.hash
                )
              )
            }}
          >
            <LogInIcon aria-hidden="true" />
            <span>Đăng nhập</span>
          </SidebarMenuButton>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  aria-label={`Tài khoản ${user.name}`}
                  size="lg"
                  variant="outline"
                  className="overflow-visible group-data-[state=collapsed]:rounded-full"
                  tooltip={{ children: user.name || "Tài khoản", side: "left" }}
                />
              }
            >
              <ProfileAvatar
                name={user.name}
                image={user.image}
                shape="circle"
                avatarFrame={account?.user.avatarFrame ?? null}
              />
              <div className="grid min-w-0 flex-1 text-left text-sm group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">
                  {user.name || "Độc giả"}
                </span>
                <span
                  className={cn(
                    "truncate font-mono text-xs uppercase",
                    roleColor[account?.user.role ?? "user"]
                  )}
                >
                  {account?.user.role}
                </span>
              </div>
              <ChevronsUpDownIcon
                aria-hidden="true"
                className="ml-auto group-data-[collapsible=icon]:hidden"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isMobile ? "bottom" : "left"}
              align="start"
              className="w-64 max-w-[calc(100vw-2rem)]"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate">
                  {user.name || "Độc giả"}
                </DropdownMenuLabel>
                <NavUserBalance />
                <DropdownMenuItem
                  render={
                    <Link
                      href="/manage/account"
                      onNavigate={() => setOpenMobile(false)}
                    />
                  }
                >
                  <UserShieldIcon aria-hidden="true" /> Tài khoản
                </DropdownMenuItem>
                {account?.profile.isPublic &&
                  account.profile.status === "active" && (
                    <DropdownMenuItem
                      render={
                        <Link
                          href={`/profile/${account.user.id}`}
                          prefetch={false}
                          onNavigate={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <UserIcon aria-hidden="true" /> Trang cá nhân
                    </DropdownMenuItem>
                  )}
                <DropdownMenuItem
                  render={
                    <Link
                      href="/manage/group"
                      onNavigate={() => setOpenMobile(false)}
                    />
                  }
                >
                  <UsersIcon aria-hidden="true" /> Nhóm dịch
                </DropdownMenuItem>
                {status === "error" && (
                  <DropdownMenuItem onClick={() => void retry()}>
                    <RefreshCwIcon aria-hidden="true" /> Thử tải lại profile
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={signOut.isPending}
                  closeOnClick={false}
                  onClick={() => signOut.mutate()}
                  variant="destructive"
                >
                  {signOut.isPending ? (
                    <Spinner />
                  ) : (
                    <LogOutIcon aria-hidden="true" />
                  )}{" "}
                  {signOut.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {signOut.isError && (
                <p role="alert" className="p-2 text-sm text-destructive">
                  Đăng xuất không thành công. Vui lòng thử lại.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
