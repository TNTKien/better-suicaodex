"use client"

import { useRouter } from "next/navigation"
import { ChevronDownIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

import {
  useLibraryItem,
  showLibraryLoginToast,
} from "@workspace/account/library-item"
import { useAccount } from "@/modules/account/provider"
import { AssetImage } from "@workspace/ui/components/asset-image"
import type { components } from "@/src/lib/generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  LibraryApiError,
  type LibraryCategory,
  libraryCategories,
} from "@workspace/account/library-api"

type LibraryItem = components["schemas"]["LibraryItem"]

const actionClassName = "hvn-manga-follow"

export function MangaLibraryAction({
  mangaId,
  returnTo,
}: {
  mangaId: string
  returnTo: string
}) {
  const router = useRouter()
  const { account, apiBaseUrl, retry, status, user } = useAccount()
  const userId = status === "authenticated" ? (user?.id ?? null) : null
  const { item, update } = useLibraryItem<LibraryItem>(
    apiBaseUrl,
    userId,
    mangaId
  )

  if (
    status === "guest" ||
    (item.error instanceof LibraryApiError && item.error.status === 401)
  )
    return (
      <Button
        className={actionClassName}
        size="lg"
        onClick={() => showLibraryLoginToast(returnTo, router.push)}
      >
        <AssetImage
          src="/brand/loginto-follow.webp"
          alt=""
          width={16}
          height={16}
          className="size-4 shrink-0"
        />
        Đăng nhập để theo dõi truyện
      </Button>
    )

  if (status === "error" || item.isError)
    return (
      <Button
        className={actionClassName}
        size="lg"
        onClick={() => void (status === "error" ? retry() : item.refetch())}
      >
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Thử lại
      </Button>
    )

  if (status === "loading" || item.isPending)
    return (
      <Button className={actionClassName} size="lg" disabled>
        <Spinner data-icon="inline-start" />
        Đang tải thư viện…
      </Button>
    )

  if (account?.profile.status !== "active")
    return (
      <Button className={actionClassName} size="lg" disabled>
        <AssetImage
          src="/brand/loginto-follow.webp"
          alt=""
          width={16}
          height={16}
          className="size-4 shrink-0"
        />
        Tài khoản bị hạn chế
      </Button>
    )

  const label = libraryCategories.find(
    ({ value }) => value === item.data?.category
  )?.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={actionClassName}
            size="lg"
            disabled={update.isPending}
          />
        }
      >
        {update.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <AssetImage
            src="/brand/loginto-follow.webp"
            alt=""
            width={16}
            height={16}
            className="size-4 shrink-0"
          />
        )}
        {update.isPending ? "Đang cập nhật…" : (label ?? "Theo dõi truyện")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 rounded-none border border-[#666666] bg-[#111111]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Chọn Theo dõi để nhận thông báo</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            disabled={update.isPending}
            value={item.data?.category ?? ""}
            onValueChange={(value) => update.mutate(value as LibraryCategory)}
          >
            {libraryCategories.map((category) => (
              <DropdownMenuRadioItem
                key={category.value}
                value={category.value}
              >
                {category.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {item.data ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={update.isPending}
                onClick={() => update.mutate(null)}
                variant="destructive"
              >
                <Trash2Icon aria-hidden="true" />
                Xóa khỏi thư viện
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
