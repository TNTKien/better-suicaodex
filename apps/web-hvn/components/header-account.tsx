"use client"

import { primaryWebOrigin } from "@workspace/catalog/origins"


import Link from "next/link"
import { ChevronDown, LogOut, RefreshCw } from "lucide-react"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"

export function HeaderAccount({ mobile = false }: { mobile?: boolean }) {
  const { user, status, retry, signOut, error } = useAccount()
  const className = mobile ? "hvn-button w-full! hover:bg-muted!" : "hvn-button min-w-0 font-bold!"

  if (status === "loading") {
    return (
      <Button
        size="sm"
        className={`${className} hvn-placeholder`}
        disabled
        aria-busy="true"
        aria-label="Đang tải tài khoản"
      >
        <Spinner aria-hidden="true" />
        Đang tải…
      </Button>
    )
  }

  if (!user && status !== "error") {
    return (
      <Link
        href="/login"
        prefetch={false}
        className={buttonVariants({ size: "sm", className })}
        onNavigate={(event) => {
          event.preventDefault()
          window.location.assign(
            loginHref(
              window.location.pathname +
                window.location.search +
                window.location.hash
            )
          )
        }}
      >
        Đăng nhập
      </Link>
    )
  }

  const greeting = user
    ? `Hi, ${user.name.trim() || "bạn"}`
    : "Thử tải lại tài khoản"
  const links = user
    ? [
        {
          label: "Tường nhà bạn",
          href: `/profile/${user.id}`,
          external: false,
        },
        {
          label: "Đăng truyện",
          href: `${primaryWebOrigin}/manage/group`,
          external: true,
        },
      ]
    : []
  const signOutContent = (
    <>
      {signOut.isPending ? (
        <Spinner aria-hidden="true" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      {signOut.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
    </>
  )
  const signOutError = signOut.isError && (
    <p role="alert" className="p-2 text-sm text-destructive">
      Đăng xuất không thành công. Vui lòng thử lại.
    </p>
  )

  if (mobile) {
    return (
      <>
        <div className={buttonVariants({ size: "sm", className, variant: "outline" })}>
          <span className="truncate">{greeting}</span>
        </div>
        {links.map(({ label, href, external }) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className={buttonVariants({ size: "sm", className, variant: "outline" })}
          >
            {label}
          </Link>
        ))}
        {status === "error" && (
          <Button
            size="sm"
            className={className}
            onClick={() => void retry()}
            title={error}
          >
            <RefreshCw aria-hidden="true" /> Thử tải lại tài khoản
          </Button>
        )}
        <Button
          size="sm"
          className={className}
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
          variant="outline"
        >
          {signOutContent}
        </Button>
        {signOutError}
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" className={className} />}>
        <span className="max-w-44 truncate">{greeting}</span>
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          {links.map(({ label, href, external }) => (
            <DropdownMenuItem
              key={href}
              render={
                <Link
                  href={href}
                  prefetch={false}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                />
              }
            >
              {label}
            </DropdownMenuItem>
          ))}
          {status === "error" && (
            <DropdownMenuItem onClick={() => void retry()} title={error}>
              <RefreshCw aria-hidden="true" /> Thử tải lại tài khoản
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            closeOnClick={false}
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            {signOutContent}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {signOutError}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
