"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BoxIcon,
  FrameIcon,
  SearchIcon,
  ShoppingBagIcon,
  UserRoundIcon,
} from "lucide-react"
import { useQueryStates } from "nuqs"

import { useAccount } from "@/modules/account/provider"
import { loginHref, type CurrentAccount } from "@/modules/account/api"
import { ProfileAvatar } from "@/modules/account/profile"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import type { FrameIdentity } from "@/modules/avatar-frames/account-api"
import { PagePagination } from "@/components/page-pagination"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "@workspace/ui/components/toast"
import { coinLabel } from "./admin-api"
import { ShopCategoryLink, shopFrameParams, shopHref } from "./navigation"
import {
  framePurchaseLabel,
  purchaseErrorMessage,
  purchaseFrame,
  purchaseStorageKey,
  purchaseUncertain,
  readPendingPurchase,
  refreshShopPurchase,
  savePendingPurchase,
  shopFramesOptions,
  shopTopicsOptions,
  type PurchaseAttempt,
  type ShopFrame,
} from "./api"

export { shopFrameParams } from "./navigation"
const rarities = [
  { value: "all", label: "Tất cả độ hiếm" },
  ...["R", "SR", "SSR"].map((value) => ({ value, label: value })),
]

export function AvatarFrameShop({ overview = false }: { overview?: boolean }) {
  const context = useAccount()
  const identity =
    context.status === "authenticated" &&
    context.account?.profile.status === "active"
      ? context.identity
      : null
  return (
    <ShopContent
      key={`${context.apiBaseUrl}:${identity?.userId}:${identity?.sessionId}`}
      apiBaseUrl={context.apiBaseUrl}
      identity={identity}
      account={context.account ?? null}
      status={context.status}
      overview={overview}
    />
  )
}

function ShopContent({
  apiBaseUrl,
  identity,
  account,
  status,
  overview,
}: {
  apiBaseUrl: string
  identity: FrameIdentity | null
  account: CurrentAccount | null
  status: string
  overview: boolean
}) {
  const client = useQueryClient()
  const [params, setFilters] = useQueryStates(shopFrameParams, {
    history: "replace",
  })
  const filters = overview
    ? { page: 1, q: "", rarity: "all" as const, topicId: "all" }
    : params
  const catalog = useQuery(shopFramesOptions(apiBaseUrl, identity, filters))
  const topics = useQuery({
    ...shopTopicsOptions(apiBaseUrl),
    enabled: !overview,
  })
  const [attempt, setAttempt] = useState<PurchaseAttempt | null>(null)
  const [saved, setSaved] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ShopFrame | null>(null)
  const alive = useRef(false)
  const submitting = useRef(false)
  const storageKey = identity ? purchaseStorageKey(apiBaseUrl, identity) : null

  useEffect(() => {
    alive.current = true
    try {
      const pending = storageKey
        ? readPendingPurchase(window.sessionStorage, storageKey)
        : null
      // Session storage is browser-only external state; restore after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttempt(pending)
      setSaved(!!pending)
      setStorageReady(true)
    } catch {
      setStorageError(true)
    }
    return () => {
      alive.current = false
    }
  }, [storageKey])

  const clearAttempt = () => {
    try {
      if (storageKey) window.sessionStorage.removeItem(storageKey)
    } catch {
      setStorageError(true)
    }
    setAttempt(null)
    setSaved(false)
    setOpen(false)
  }
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: ({
      quote,
      resume,
    }: {
      quote: PurchaseAttempt
      resume: boolean
    }) => purchaseFrame(apiBaseUrl, quote, resume),
    onSuccess: async (receipt) => {
      if (!alive.current || !identity) return
      clearAttempt()
      toast.add({
        type: "success",
        title: `Đã mua ${receipt.frame.name}`,
        description: "Khung đã vào kho của bạn; chưa tự động trang bị.",
      })
      await refreshShopPurchase(client, apiBaseUrl, identity)
    },
    onError: async (error) => {
      if (!alive.current || !identity) return
      if (!purchaseUncertain(error)) clearAttempt()
      toast.add({ type: "error", title: purchaseErrorMessage(error) })
      await refreshShopPurchase(client, apiBaseUrl, identity)
    },
    onSettled: () => {
      submitting.current = false
    },
  })
  const disabled =
    mutation.isPending ||
    catalog.isFetching ||
    !catalog.isSuccess ||
    saved ||
    !storageReady ||
    storageError
  const choose = (item: ShopFrame) => {
    if (
      disabled ||
      !identity ||
      !item.canPurchase ||
      !catalog.data?.purchaseEnabled
    )
      return
    const current = catalog.data.data.find(
      (entry) => entry.frame.id === item.frame.id
    )
    if (
      !current ||
      current.frameVersion !== item.frameVersion ||
      current.price !== item.price
    ) {
      setDetail(current ?? null)
      toast.add({
        type: "error",
        title:
          "Thông tin sản phẩm đã thay đổi. Hãy kiểm tra lại giá trước khi mua.",
      })
      return
    }
    if (!("canPurchase" in current) || !current.canPurchase) return
    setAttempt({
      name: item.frame.name,
      input: {
        operationId: crypto.randomUUID(),
        frameId: item.frame.id,
        expectedFrameVersion: item.frameVersion,
        expectedPrice: item.price,
      },
    })
    setDetail(null)
    setOpen(true)
  }
  const confirm = () => {
    if (
      !attempt ||
      !identity ||
      !storageKey ||
      storageError ||
      submitting.current ||
      mutation.isPending
    )
      return
    if (
      !saved &&
      (!catalog.data?.purchaseEnabled ||
        catalog.isFetching ||
        !catalog.data.data.some(
          (item) =>
            item.frame.id === attempt.input.frameId &&
            "canPurchase" in item &&
            item.canPurchase
        ))
    )
      return
    try {
      savePendingPurchase(window.sessionStorage, storageKey, attempt)
    } catch {
      setStorageError(true)
      toast.add({
        type: "error",
        title:
          "Không thể lưu mã giao dịch trong trình duyệt. Chưa gửi yêu cầu mua; hãy kiểm tra quyền lưu trữ rồi tải lại trang.",
      })
      return
    }
    submitting.current = true
    const resume = saved
    setSaved(true)
    mutation.mutate({ quote: attempt, resume })
  }
  const topicItems = [
    { value: "all", label: "Tất cả chủ đề" },
    { value: "none", label: "Khác" },
    ...(topics.data?.data.map((topic) => ({
      value: topic.id,
      label: topic.name,
    })) ?? []),
  ]
  if (!topicItems.some((item) => item.value === filters.topicId))
    topicItems.push({ value: filters.topicId, label: "Chủ đề không khả dụng" })
  const selected = catalog.data?.data.find(
    (item) => item.frame.id === attempt?.input.frameId
  )
  const guest = status === "guest"

  return (
    <section className="flex min-w-0 flex-col gap-5" aria-label="Khung Avatar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FrameIcon aria-hidden="true" className="size-5" />
          Khung Avatar
        </h2>
        <div className="flex items-center gap-3">
          {catalog.data && (
            <p className="text-sm text-muted-foreground">
              {catalog.data.meta.total.toLocaleString("vi-VN")} sản phẩm
            </p>
          )}
          {overview && (
            <ShopCategoryLink category="avatar-frame">
              Xem tất cả
            </ShopCategoryLink>
          )}
        </div>
      </div>
      {account && !identity && (
        <Alert>
          <AlertTitle>Tài khoản đang bị hạn chế</AlertTitle>
          <AlertDescription>
            Bạn có thể xem Shop nhưng không thể mua khung.
          </AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Chưa tải được tài khoản</AlertTitle>
          <AlertDescription>
            Hãy thử tải lại tài khoản để xem số dư và mua khung.
          </AlertDescription>
        </Alert>
      )}
      {storageError && (
        <Alert variant="destructive">
          <AlertTitle>Không đọc/ghi được mã giao dịch</AlertTitle>
          <AlertDescription>
            Tạm khoá mua để tránh mất thông tin giao dịch. Không xoá dữ liệu
            trình duyệt nếu có giao dịch đang chờ kiểm tra.
          </AlertDescription>
        </Alert>
      )}
      {saved && attempt && !mutation.isPending && !open && (
        <Alert>
          <AlertTitle>Có yêu cầu mua chưa hoàn tất</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>
              {attempt.name} — {coinLabel(attempt.input.expectedPrice)}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(true)}
            >
              Tiếp tục mua
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {catalog.data && !catalog.data.purchaseEnabled && (
        <Alert>
          <AlertTitle>SuicaoShop chưa mở bán</AlertTitle>
          <AlertDescription>
            Bạn vẫn có thể xem và thử khung. Coin và khung đã sở hữu được giữ
            nguyên.
          </AlertDescription>
        </Alert>
      )}
      {!overview && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form
              role="search"
              className="flex-1 sm:min-w-48"
              onSubmit={(event) => {
                event.preventDefault()
                void setFilters({
                  q: String(
                    new FormData(event.currentTarget).get("q") ?? ""
                  ).trim(),
                  page: 1,
                })
              }}
            >
              <InputGroup>
                <InputGroupInput
                  key={filters.q}
                  name="q"
                  defaultValue={filters.q}
                  maxLength={160}
                  aria-label="Tìm tên khung trong Shop"
                  placeholder="Tìm tên khung avatar…"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="submit"
                    aria-label="Tìm khung"
                  >
                    <SearchIcon aria-hidden="true" data-icon="inline-start" />
                    Tìm kiếm
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
            <Select
              items={rarities}
              value={filters.rarity}
              onValueChange={(value) => {
                if (value)
                  void setFilters({
                    rarity: value as typeof filters.rarity,
                    page: 1,
                  })
              }}
            >
              <SelectTrigger
                className="h-12 w-full sm:w-44"
                aria-label="Lọc độ hiếm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {rarities.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <nav
            aria-label="Lọc chủ đề"
            className="flex min-w-0 gap-2 overflow-x-auto pb-2"
          >
            {topicItems.map(({ value, label }) => (
              <Link
                key={value}
                href={shopHref("/shop", {
                  ...filters,
                  category: "avatar-frame",
                  topicId: value,
                  page: 1,
                })}
                prefetch={false}
                aria-current={filters.topicId === value ? "page" : undefined}
                className={buttonVariants({
                  variant: filters.topicId === value ? "secondary" : "outline",
                  className: "shrink-0",
                })}
                onNavigate={(event) => {
                  event.preventDefault()
                  void setFilters({ topicId: value, page: 1 })
                }}
              >
                {label}
              </Link>
            ))}
            {topics.isPending && (
              <Skeleton className="h-9 w-32 shrink-0 motion-reduce:animate-none" />
            )}
          </nav>
          {topics.isError && (
            <p role="status" className="text-sm text-muted-foreground">
              Chưa tải được chủ đề.{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => void topics.refetch()}
              >
                Thử lại
              </Button>
            </p>
          )}
        </>
      )}
      {catalog.isPending ? (
        <AvatarFrameShopSkeleton count={overview ? 5 : 20} />
      ) : catalog.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải Shop</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>Hãy kiểm tra kết nối hoặc phiên đăng nhập.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void catalog.refetch()}
            >
              Tải lại Shop
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {catalog.data.data.length ? (
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-4"
              aria-busy={catalog.isFetching || mutation.isPending}
            >
              {(overview
                ? catalog.data.data.slice(0, 5)
                : catalog.data.data
              ).map((item) => (
                <ShopFrameCard
                  key={item.frame.id}
                  item={item}
                  account={account}
                  guest={guest}
                  disabled={
                    disabled || !identity || !catalog.data.purchaseEnabled
                  }
                  onView={setDetail}
                  onBuy={choose}
                />
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Không có khung phù hợp</EmptyTitle>
                <EmptyDescription>
                  Thử đổi tên tìm kiếm, độ hiếm hoặc chủ đề.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!overview && (
            <PagePagination
              ariaLabel="Trang khung trong Shop"
              currentPage={Math.max(1, filters.page)}
              onPageChange={(page) => void setFilters({ page })}
              totalPages={catalog.data.meta.totalPages}
              getPageHref={(page) =>
                shopHref("/shop", {
                  ...filters,
                  category: "avatar-frame",
                  page,
                })
              }
            />
          )}
          {!overview &&
            filters.page > Math.max(1, catalog.data.meta.totalPages) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void setFilters({ page: 1 })}
              >
                Về trang đầu
              </Button>
            )}
        </>
      )}
      <Dialog
        open={!!detail}
        onOpenChange={(next) => {
          if (!next) setDetail(null)
        }}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="p-6 pr-12">
            <DialogTitle>Chi tiết sản phẩm</DialogTitle>
            <DialogDescription className="sr-only">
              {detail?.frame.name}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 pb-6">
            {detail && <ShopFrameDetails item={detail} account={account} />}
          </div>
          <DialogFooter className="px-6 pb-6">
            {detail && (
              <ShopFrameBuyButton
                item={detail}
                guest={guest}
                disabled={
                  disabled || !identity || !catalog.data?.purchaseEnabled
                }
                onBuy={choose}
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={open && !!attempt}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next)
        }}
      >
        <DialogContent
          showCloseButton={!mutation.isPending}
          className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="p-6 pr-12">
            <DialogTitle>Xác nhận mua khung</DialogTitle>
            <DialogDescription>{attempt?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">
            {selected && <ShopFramePreview item={selected} account={account} />}
            {attempt && (
              <p>
                Giá: <strong>{coinLabel(attempt.input.expectedPrice)}</strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Mua xong khung sẽ vào kho; không tự thay khung đang dùng.
            </p>
          </div>
          <DialogFooter className="border-t p-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              {saved ? "Để sau" : "Huỷ"}
            </Button>
            <Button
              type="button"
              aria-busy={mutation.isPending}
              disabled={
                mutation.isPending ||
                !identity ||
                storageError ||
                (!saved &&
                  (catalog.isFetching || !catalog.data?.purchaseEnabled))
              }
              onClick={confirm}
            >
              {mutation.isPending && (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              )}
              {mutation.isPending ? "Đang mua" : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function AvatarFrameShopSkeleton({ count = 20 }: { count?: number }) {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-label="Đang tải khung trong Shop"
      aria-busy="true"
    >
      <span className="sr-only">Đang tải khung trong Shop…</span>
      <Skeleton
        className="h-5 w-28 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-4"
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, index) => (
          <Card key={index} size="sm" className="min-w-0 gap-0 py-0">
            <Skeleton className="h-48 rounded-none motion-reduce:animate-none" />
            <CardHeader className="py-4">
              <Skeleton className="h-5 w-1/2 motion-reduce:animate-none" />
              <Skeleton className="h-5 w-4/5 motion-reduce:animate-none" />
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-5 w-20 motion-reduce:animate-none" />
                <Skeleton className="h-5 w-16 motion-reduce:animate-none" />
              </div>
            </CardContent>
            <CardFooter className="pb-4">
              <Skeleton className="h-10 w-full motion-reduce:animate-none" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ShopFramePreview({
  item,
  account,
  animate = false,
}: {
  item: Pick<ShopFrame, "frame">
  account: CurrentAccount | null
  animate?: boolean
}) {
  return (
    <div className="flex justify-center p-4">
      {account ? (
        <ProfileAvatar
          name={account.user.name}
          image={account.user.image}
          avatarFrame={item.frame}
          animateFrame={animate}
          shape="circle"
          className="size-32"
        />
      ) : (
        <AvatarDecoration frame={item.frame} animate={animate}>
          <Avatar className="size-32">
            <AvatarFallback>
              <UserRoundIcon aria-hidden="true" className="size-14" />
            </AvatarFallback>
          </Avatar>
        </AvatarDecoration>
      )}
    </div>
  )
}

export function ShopFrameCard({
  item,
  account,
  guest,
  disabled,
  onView,
  onBuy,
}: {
  item: ShopFrame
  account: CurrentAccount | null
  guest: boolean
  disabled: boolean
  onView: (item: ShopFrame) => void
  onBuy: (item: ShopFrame) => void
}) {
  return (
    <Card size="sm" className="min-w-0 gap-0 py-0">
      <div className="relative">
        <div className="bg-muted/40 px-4 py-6">
          <ShopFramePreview item={item} account={account} />
        </div>
        <CardHeader className="min-w-0 border-t rounded-t-none py-4">
          <CardDescription className="flex min-w-0 items-center gap-2">
            <span className="truncate">{item.topic?.name ?? "Khác"}</span>
            {item.frame.animated && (
              <Badge variant="outline" className="shrink-0">
                Ảnh động
              </Badge>
            )}
          </CardDescription>
          <CardTitle className="truncate">{item.frame.name}</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ShopFramePriceStock item={item} />
        </CardContent>
        <Button
          type="button"
          variant="ghost"
          className="absolute inset-0 size-full rounded-xl ring-inset hover:bg-transparent dark:hover:bg-transparent"
          aria-label={`Xem chi tiết ${item.frame.name}`}
          aria-haspopup="dialog"
          onClick={() => onView(item)}
        />
      </div>
      <CardFooter className="mt-auto pb-4">
        <ShopFrameBuyButton
          item={item}
          guest={guest}
          disabled={disabled}
          onBuy={onBuy}
        />
      </CardFooter>
    </Card>
  )
}

export function ShopFrameDetails({
  item,
  account,
}: {
  item: ShopFrame
  account: CurrentAccount | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/40 py-6">
        <ShopFramePreview item={item} account={account} animate />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm wrap-anywhere text-muted-foreground">
            {item.topic?.name ?? "Khác"}
          </p>
          <Badge variant="outline">{item.rarity}</Badge>
          {item.frame.animated && <Badge variant="outline">Ảnh động</Badge>}
        </div>
        <h3 className="text-lg font-semibold wrap-anywhere">
          {item.frame.name}
        </h3>
      </div>
      {item.description && (
        <p className="wrap-anywhere whitespace-pre-wrap text-muted-foreground">
          {item.description}
        </p>
      )}
      <Separator />
      <ShopFramePriceStock item={item} />
      {item.owned && (
        <Badge variant="secondary" className="w-fit">
          Đã sở hữu
        </Badge>
      )}
    </div>
  )
}

function ShopFramePriceStock({ item }: { item: ShopFrame }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5">
        <Image
          src="/images/suicao_coin.webp"
          alt=""
          width={20}
          height={20}
          unoptimized
        />
        {coinLabel(item.price)}
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <BoxIcon aria-hidden="true" className="size-4" />
        Còn {item.stock}
      </span>
    </div>
  )
}

function ShopFrameBuyButton({
  item,
  guest,
  disabled,
  onBuy,
}: {
  item: ShopFrame
  guest: boolean
  disabled: boolean
  onBuy: (item: ShopFrame) => void
}) {
  const label = framePurchaseLabel(item, guest)
  if (guest && item.availability === "in_stock")
    return (
      <Link
        href={loginHref("/shop?category=avatar-frame")}
        className={buttonVariants({ className: "w-full", size: "lg" })}
      >
        <ShoppingBagIcon aria-hidden="true" data-icon="inline-start" />
        {label}
      </Link>
    )
  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      disabled={disabled || guest || !item.canPurchase}
      aria-label={`${label}: ${item.frame.name}`}
      onClick={() => onBuy(item)}
    >
      <ShoppingBagIcon aria-hidden="true" data-icon="inline-start" />
      {label}
    </Button>
  )
}
