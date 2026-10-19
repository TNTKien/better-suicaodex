"use client"

import { useRouter } from "@bprogress/next/app"
import {
  BookmarkIcon,
  ChevronDownIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"

import {
  useLibraryItem,
  showLibraryLoginToast,
} from "@workspace/account/library-item"
export { showLibraryLoginToast } from "@workspace/account/library-item"
import { useAccount } from "@/modules/account/provider"
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
  type LibraryItem,
  libraryCategories,
} from "./api"

const actionClassName =
  "w-full md:w-52 shrink-0 whitespace-nowrap h-8! md:h-10! bg-cyan-800 hover:bg-cyan-700"

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
        <BookmarkIcon aria-hidden="true" data-icon="inline-start" />
        Thêm vào thư viện
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
        <BookmarkIcon aria-hidden="true" data-icon="inline-start" />
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
          <BookmarkIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {update.isPending ? "Đang cập nhật…" : (label ?? "Thêm vào thư viện")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
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
