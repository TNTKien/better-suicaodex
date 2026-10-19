"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useQueryStates } from "nuqs"
import { HistoryIcon, PackageOpenIcon } from "lucide-react"
import { useAccount } from "@/modules/account/provider"
import { loginHref, type CurrentAccount } from "@/modules/account/api"
import { PagePagination } from "@/components/page-pagination"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ShopFramePreview } from "./avatar-frame-shop"
import {
  type ChestCatalog,
  type ShopChest,
  chestDisplayName,
  chestImage,
  coinLabel,
} from "./admin-api"
import { shopChestsOptions, shopChestPoolOptions } from "./api"
import { ShopCategoryLink, shopFrameParams, shopHref } from "./navigation"
import { GachaPurchase } from "./gacha-purchase"
import { GachaHistoryDialog } from "./gacha-history"

export function GachaCatalog({ overview = false }: { overview?: boolean }) {
  const account = useAccount()
  return (
    <GachaCatalogContent
      key={`${account.apiBaseUrl}:${account.identity?.userId}:${account.identity?.sessionId}:${account.account?.profile.status}`}
      account={account}
      overview={overview}
    />
  )
}

function GachaCatalogContent({
  account,
  overview,
}: {
  account: ReturnType<typeof useAccount>
  overview: boolean
}) {
  const identity =
    account.status === "authenticated" &&
    account.account?.profile.status === "active"
      ? account.identity
      : null
  const [params, setParams] = useQueryStates(shopFrameParams, {
    history: "replace",
  })
  const page = overview ? 1 : Math.max(1, params.page)
  const query = useQuery(shopChestsOptions(account.apiBaseUrl, page))
  const [selected, setSelected] = useState<ShopChest | null>(null)
  const [purchaseChest, setPurchaseChest] = useState<ShopChest | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  return (
    <section
      className="flex min-w-0 flex-col gap-5"
      aria-label="Hộp Khung Avatar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PackageOpenIcon aria-hidden="true" className="size-5" />
          Hộp Khung Avatar
        </h2>
        <div className="flex items-center gap-3">
          {query.data && (
            <p className="text-sm text-muted-foreground">
              {query.data.meta.total} sản phẩm
            </p>
          )}
          {!overview && identity && (
            <Button
              variant="outline"
              aria-haspopup="dialog"
              onClick={() => setHistoryOpen(true)}
            >
              <HistoryIcon data-icon="inline-start" />
              Lịch sử
            </Button>
          )}
          {overview && (
            <ShopCategoryLink category="gacha">Xem tất cả</ShopCategoryLink>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Mở hộp để nhận khung avatar ngẫu nhiên. Khung trùng được quy đổi thành
        coin.
      </p>
      {query.isPending ? (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-4"
          role="status"
          aria-label="Đang tải hộp"
          aria-busy="true"
        >
          {Array.from({ length: overview ? 5 : 8 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-80 rounded-xl motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Chưa tải được danh sách hộp</AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {query.data.data.length ? (
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-4"
              aria-busy={query.isFetching}
            >
              {(overview ? query.data.data.slice(0, 5) : query.data.data).map(
                (chest) => (
                  <ShopChestCard
                    key={chest.id}
                    chest={chest}
                    onView={() => setSelected(chest)}
                    onBuy={() => {
                      if (identity) setPurchaseChest(chest)
                    }}
                    guest={account.status === "guest"}
                    disabled={!identity || query.isFetching}
                    rollEnabled={query.data.rollEnabled}
                  />
                )
              )}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Chưa có hộp</EmptyTitle>
                <EmptyDescription>
                  Hãy quay lại sau để xem các hộp mới.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!overview && (
            <PagePagination
              ariaLabel="Trang hộp trong Shop"
              currentPage={page}
              totalPages={query.data.meta.totalPages}
              onPageChange={(page) => void setParams({ page })}
              getPageHref={(page) =>
                shopHref("/shop", { category: "gacha", page })
              }
            />
          )}
          {!overview && page > Math.max(1, query.data.meta.totalPages) && (
            <Button
              variant="outline"
              onClick={() => void setParams({ page: 1 })}
            >
              Về trang đầu
            </Button>
          )}
        </>
      )}
      {selected && query.data && (
        <ChestPreviewDialog
          key={selected.id}
          chest={selected}
          rule={query.data.rule}
          apiBaseUrl={account.apiBaseUrl}
          account={account.account ?? null}
          onClose={() => setSelected(null)}
        />
      )}
      {identity && (
        <GachaPurchase
          selected={
            query.data?.data.find((chest) => chest.id === purchaseChest?.id) ??
            purchaseChest
          }
          rule={query.data?.rule}
          onClose={() => setPurchaseChest(null)}
          apiBaseUrl={account.apiBaseUrl}
          identity={identity}
          account={account.account ?? null}
        />
      )}
      {historyOpen && identity && (
        <GachaHistoryDialog
          apiBaseUrl={account.apiBaseUrl}
          identity={identity}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </section>
  )
}

export function ShopChestCard({
  chest,
  onView,
  onBuy,
  guest,
  disabled,
  rollEnabled,
}: {
  chest: ShopChest
  onView: () => void
  onBuy: () => void
  guest: boolean
  disabled: boolean
  rollEnabled: boolean
}) {
  const image = chestImage(chest)
  const name = chestDisplayName(chest)
  return (
    <Card size="sm" className="min-w-0 gap-0 py-0">
      <div className="flex h-52 items-center justify-center bg-muted/40 p-6">
        {image ? (
          <Image
            src={image}
            alt=""
            width={160}
            height={160}
            className="size-40 object-contain"
            unoptimized
          />
        ) : (
          <PackageOpenIcon
            aria-hidden="true"
            className="size-24 text-muted-foreground"
          />
        )}
      </div>
      <CardHeader className="min-w-0 rounded-t-none border-t py-4">
        <CardDescription className="truncate">
          {chest.topic?.name ?? "Tất cả chủ đề"}
        </CardDescription>
        <CardTitle className="line-clamp-2 min-h-10" title={name}>
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Image
              src="/images/suicao_coin.webp"
              alt=""
              width={20}
              height={20}
              unoptimized
            />
            {coinLabel(chest.price)}
          </span>
          <span className="text-muted-foreground">
            {chest.pool.total} khung
          </span>
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex-col gap-2 pb-4">
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          aria-label={`Xem khung trong ${name}`}
          aria-haspopup="dialog"
          onClick={onView}
        >
          Xem khung
        </Button>
        {guest && rollEnabled && chest.saleEnabled && chest.ready ? (
          <Button
            className="w-full"
            nativeButton={false}
            render={<Link href={loginHref("/shop?category=gacha")} />}
          >
            Đăng nhập để mua
          </Button>
        ) : (
          <Button
            className="w-full"
            aria-haspopup="dialog"
            onClick={onBuy}
            disabled={
              disabled || !rollEnabled || !chest.saleEnabled || !chest.ready
            }
          >
            {!rollEnabled
              ? "Tạm đóng"
              : !chest.saleEnabled
                ? "Chưa mở bán"
                : !chest.ready
                  ? "Chưa khả dụng"
                  : "Mua hộp"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

const rarityItems = [
  { value: "all", label: "Tất cả độ hiếm" },
  ...["R", "SR", "SSR"].map((value) => ({ value, label: value })),
]

function ChestPreviewDialog({
  chest,
  rule,
  apiBaseUrl,
  account,
  onClose,
}: {
  chest: ShopChest
  rule: ChestCatalog["rule"]
  apiBaseUrl: string
  account: CurrentAccount | null
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [rarity, setRarity] = useState<"all" | "R" | "SR" | "SSR">("all")
  const query = useQuery(
    shopChestPoolOptions(apiBaseUrl, chest.id, page, rarity)
  )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="p-6 pr-12">
          <DialogTitle>{chestDisplayName(chest)}</DialogTitle>
          <DialogDescription>
            Nhận ngẫu nhiên một khung
            {chest.topic ? ` thuộc ${chest.topic.name}` : " từ tất cả chủ đề"}.
            Khung đã sở hữu vẫn có thể xuất hiện.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              Tỷ lệ cơ bản:{" "}
              {(["R", "SR", "SSR"] as const)
                .map(
                  (value) =>
                    `${value} ${((rule.rates[value] / rule.rateDenominator) * 100).toLocaleString("vi-VN")}%`
                )
                .join(" · ")}
            </p>
            <p>
              Bảo hiểm: {rule.srPity} lượt có SR trở lên; {rule.ssrPity} lượt có
              SSR. Bảo hiểm dùng chung giữa các hộp.
            </p>
            <p>
              Khung trùng hoàn coin:{" "}
              {(["R", "SR", "SSR"] as const)
                .map(
                  (value) =>
                    `${value}: ${coinLabel(rule.duplicateRefund[value])}`
                )
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Khung có thể nhận</h3>
            <Select
              items={rarityItems}
              value={rarity}
              onValueChange={(value) => {
                if (value) {
                  setRarity(value as typeof rarity)
                  setPage(1)
                }
              }}
            >
              <SelectTrigger
                className="w-48"
                aria-label="Độ hiếm khung trong hộp"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {rarityItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {query.isPending ? (
            <div
              className="grid grid-cols-2 gap-4 sm:grid-cols-3"
              role="status"
              aria-label="Đang tải khung trong hộp"
              aria-busy="true"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="h-56 rounded-xl motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Chưa tải được khung trong hộp</AlertTitle>
              <AlertDescription>
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {query.data.meta.total} khung phù hợp
              </p>
              {query.data.data.length ? (
                <div
                  className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-4"
                  aria-busy={query.isFetching}
                >
                  {query.data.data.map((entry) => (
                    <Card key={entry.frame.id} size="sm">
                      <CardContent>
                        <ShopFramePreview item={entry} account={account} />
                      </CardContent>
                      <CardHeader>
                        <CardTitle
                          className="truncate"
                          title={entry.frame.name}
                        >
                          {entry.frame.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline">{entry.rarity}</Badge>
                          {entry.frame.animated && (
                            <Badge variant="outline">Ảnh động</Badge>
                          )}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Không có khung phù hợp</EmptyTitle>
                    <EmptyDescription>Thử chọn độ hiếm khác.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              <AdminPagination
                ariaLabel="Trang khung trong hộp"
                currentPage={page}
                totalPages={query.data.meta.totalPages}
                disabled={query.isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
        <DialogFooter className="border-t p-4 sm:px-6">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
