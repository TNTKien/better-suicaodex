"use client"

import { useState } from "react"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs"
import { PackageOpenIcon, RefreshCwIcon } from "lucide-react"
import { useAccount } from "@/modules/account/provider"
import { AdminAvatarFrameList } from "@/modules/avatar-frames/admin-list"
import { AdminFramePreview } from "@/modules/avatar-frames/admin-preview"
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
  EmptyMedia,
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
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import {
  type ShopChest,
  adminChestsOptions,
  chestDisplayName,
  chestImage,
  chestPoolOptions,
  coinLabel,
  shopErrorMessage,
  updateChestSale,
} from "./admin-api"

export const shopTabParam = parseAsStringLiteral([
  "frames",
  "chests",
]).withDefault("frames")
const rarityItems = [
  { value: "all", label: "Tất cả độ hiếm" },
  ...["R", "SR", "SSR"].map((value) => ({ value, label: value })),
]

export function AdminShop() {
  const account = useAccount()
  const [tab, setTab] = useQueryState(
    "shopTab",
    shopTabParam.withOptions({ history: "push" })
  )
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => void setTab(value as "frames" | "chests")}
    >
      <TabsList aria-label="Quản lý SuicaoShop">
        <TabsTrigger value="frames">Khung Avatar</TabsTrigger>
        <TabsTrigger value="chests">Hộp</TabsTrigger>
      </TabsList>
      <TabsContent value="frames" className="flex flex-col gap-5 pt-3">
        <p className="text-sm text-muted-foreground">
          Quản lý giá bán trực tiếp và tồn kho. Ảnh, chủ đề, độ hiếm và bật/tắt
          khung vẫn chỉnh ở trang quản lý khung.
        </p>
        <AdminAvatarFrameList commerce />
      </TabsContent>
      <TabsContent value="chests" className="pt-3">
        <AdminChestList
          key={account.user.id}
          apiBaseUrl={account.apiBaseUrl}
          userId={account.user.id}
        />
      </TabsContent>
    </Tabs>
  )
}

function ShopQueryError({
  error,
  title,
  retry,
  busy,
}: {
  error: unknown
  title: string
  retry: () => void
  busy: boolean
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{shopErrorMessage(error)}</p>
        <Button variant="outline" size="sm" disabled={busy} onClick={retry}>
          Tải lại
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export function AdminChestCard({
  chest,
  onPool,
  onSale,
}: {
  chest: ShopChest
  onPool: () => void
  onSale: () => void
}) {
  const image = chestImage(chest)
  const name = chestDisplayName(chest)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="line-clamp-2 min-h-10 wrap-anywhere">
          {name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {chest.kind === "common" ? "Tất cả chủ đề" : chest.topic?.name}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-32 items-center justify-center">
          {image ? (
            <Image
              src={image}
              alt=""
              width={128}
              height={128}
              className="size-32 object-contain"
              unoptimized
              loading="eager"
            />
          ) : (
            <PackageOpenIcon
              aria-hidden="true"
              className="size-12 text-muted-foreground"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={
              chest.saleEnabled && !chest.retiredAt ? "default" : "secondary"
            }
          >
            {chest.retiredAt
              ? "Đã ngừng sử dụng"
              : chest.saleEnabled
                ? "Đã mở bán"
                : "Chưa mở bán"}
          </Badge>
          {!chest.ready && !chest.retiredAt && (
            <Badge variant="outline">Pool chưa sẵn sàng</Badge>
          )}
        </div>
        <p className="font-medium">{coinLabel(chest.price)} / hộp</p>
        <p className="text-sm tabular-nums">
          {chest.pool.total} khung · R: {chest.pool.R} · SR: {chest.pool.SR} ·
          SSR: {chest.pool.SSR}
        </p>
        {!chest.ready && !chest.retiredAt && (
          <p className="text-sm text-muted-foreground">
            Cần ít nhất một khung hợp lệ ở mỗi độ hiếm R, SR và SSR để mở bán.
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!!chest.retiredAt}
          onClick={onPool}
          aria-label={`Xem pool ${name}`}
        >
          Xem pool
        </Button>
        <Button
          variant={chest.saleEnabled ? "outline" : "default"}
          disabled={!!chest.retiredAt || (!chest.saleEnabled && !chest.ready)}
          onClick={onSale}
          aria-label={`${chest.saleEnabled ? "Đóng" : "Mở"} bán ${name}`}
        >
          {chest.saleEnabled ? "Đóng bán" : "Mở bán"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export function AdminChestList({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [page, setPage] = useQueryState(
    "chestPage",
    parseAsInteger.withDefault(1).withOptions({ history: "push" })
  )
  const currentPage = Math.max(1, page)
  const query = useQuery(adminChestsOptions(apiBaseUrl, userId, currentPage))
  const [pool, setPool] = useState<ShopChest | null>(null)
  const [sale, setSale] = useState<ShopChest | null>(null)
  const onChanged = () =>
    void queryClient.invalidateQueries({
      queryKey: ["account", apiBaseUrl, userId],
    })
  const data = query.data
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Hộp tự tạo theo chủ đề mới, mặc định chưa mở bán. Pool cập nhật theo
          các khung đang bật, có ảnh hợp lệ và không limited; không phụ thuộc
          tồn kho.
        </p>
        <Button
          className="shrink-0"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? <Spinner /> : <RefreshCwIcon />}Tải lại
        </Button>
      </div>
      {query.isPending && (
        <p role="status" className="flex items-center gap-2">
          <Spinner />
          Đang tải hộp…
        </p>
      )}
      {query.isError && (
        <ShopQueryError
          title="Không tải được danh sách hộp"
          error={query.error}
          busy={query.isFetching}
          retry={() => void query.refetch()}
        />
      )}
      {data && (
        <>
          {!data.rollEnabled && (
            <Alert>
              <AlertTitle>Gacha đang tắt ở cấu hình máy chủ</AlertTitle>
              <AlertDescription>
                Admin vẫn có thể cấu hình mở/đóng bán hộp. User chỉ mở được hộp
                khi tính năng gacha được bật.
              </AlertDescription>
            </Alert>
          )}
          <Card size="sm">
            <CardHeader>
              <CardTitle>
                Quy tắc hộp khung avatar · phiên bản {data.rule.version}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>
                Giá: {coinLabel(data.rule.price)} · Tỷ lệ cơ bản:{" "}
                {(["R", "SR", "SSR"] as const)
                  .map(
                    (rarity) =>
                      `${rarity} ${((data.rule.rates[rarity] / data.rule.rateDenominator) * 100).toLocaleString("vi-VN")}%`
                  )
                  .join(" · ")}
              </p>
              <p>
                Bảo hiểm: {data.rule.srPity} lượt có SR trở lên;{" "}
                {data.rule.ssrPity} lượt có SSR. Bảo hiểm dùng chung giữa các
                hộp.
              </p>
              <p>
                Khung trùng hoàn coin:{" "}
                {(["R", "SR", "SSR"] as const)
                  .map(
                    (rarity) =>
                      `${rarity}: ${coinLabel(data.rule.duplicateRefund[rarity])}`
                  )
                  .join(" · ")}
              </p>
              <p className="text-muted-foreground">
                Khung cùng độ hiếm có trọng số bằng nhau. Quy tắc chỉ xem, không
                chỉnh tại đây.
              </p>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            {data.meta.total} hộp · 20 hộp mỗi trang
          </p>
          {data.data.length ? (
            <div
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              aria-label="Danh sách hộp"
              aria-busy={query.isFetching}
            >
              {data.data.map((chest) => (
                <AdminChestCard
                  key={chest.id}
                  chest={chest}
                  onPool={() => setPool(chest)}
                  onSale={() => setSale(chest)}
                />
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageOpenIcon />
                </EmptyMedia>
                <EmptyTitle>Chưa có hộp phù hợp</EmptyTitle>
                <EmptyDescription>
                  Hộp sẽ được tạo khi có chủ đề. Nếu đang ở trang sau, hãy về
                  trang đầu.
                </EmptyDescription>
              </EmptyHeader>
              {currentPage > 1 && (
                <Button variant="outline" onClick={() => void setPage(1)}>
                  Về trang đầu
                </Button>
              )}
            </Empty>
          )}
          <AdminPagination
            ariaLabel="Phân trang hộp"
            currentPage={currentPage}
            totalPages={data.meta.totalPages}
            disabled={query.isFetching}
            onPageChange={setPage}
          />
        </>
      )}
      {pool && (
        <ChestPoolDialog
          key={pool.id}
          apiBaseUrl={apiBaseUrl}
          userId={userId}
          chest={pool}
          onClose={() => setPool(null)}
        />
      )}
      {sale && (
        <ChestSaleDialog
          key={sale.id}
          apiBaseUrl={apiBaseUrl}
          chest={sale}
          onClose={() => setSale(null)}
          onChanged={onChanged}
          reload={async () => {
            const result = await query.refetch()
            if (result.error) throw result.error
          }}
        />
      )}
    </div>
  )
}

function ChestSaleDialog({
  apiBaseUrl,
  chest,
  onClose,
  onChanged,
  reload,
}: {
  apiBaseUrl: string
  chest: ShopChest
  onClose: () => void
  onChanged: () => void
  reload: () => Promise<void>
}) {
  const [needsReload, setNeedsReload] = useState(false)
  const [reloading, setReloading] = useState(false)
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () => updateChestSale(apiBaseUrl, chest),
    onSuccess: () => {
      toast.add({
        type: "success",
        title: chest.saleEnabled ? "Đã đóng bán hộp" : "Đã mở bán hộp",
      })
      onChanged()
      onClose()
    },
    onError: (error) => {
      setNeedsReload(true)
      toast.add({ type: "error", title: shopErrorMessage(error) })
      onChanged()
    },
  })
  const busy = mutation.isPending || reloading
  const reloadState = async () => {
    setReloading(true)
    try {
      await reload()
      onClose()
    } catch (error) {
      toast.add({ type: "error", title: shopErrorMessage(error) })
    } finally {
      setReloading(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>
            {chest.saleEnabled ? "Đóng" : "Mở"} bán {chestDisplayName(chest)}?
          </DialogTitle>
          <DialogDescription>
            {chest.saleEnabled
              ? "User không thể mở thêm hộp này. Khung đã nhận và bảo hiểm của user được giữ nguyên."
              : `User có thể mở hộp với giá ${coinLabel(chest.price)} khi gacha được bật. Pool sẽ được kiểm tra lại lúc lưu.`}
          </DialogDescription>
        </DialogHeader>
        {needsReload && (
          <p role="alert" className="text-sm text-destructive">
            Hãy tải trạng thái mới rồi chọn lại thao tác. Không gửi lại yêu cầu
            dựa trên dữ liệu cũ.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Huỷ
          </Button>
          {needsReload ? (
            <Button disabled={busy} onClick={() => void reloadState()}>
              {reloading && <Spinner />}Tải trạng thái mới
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Spinner />}Xác nhận
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChestPoolDialog({
  apiBaseUrl,
  userId,
  chest,
  onClose,
}: {
  apiBaseUrl: string
  userId: string
  chest: ShopChest
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [rarity, setRarity] = useState<"all" | "R" | "SR" | "SSR">("all")
  const query = useQuery(
    chestPoolOptions(apiBaseUrl, userId, chest.id, page, rarity)
  )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="p-6 pr-12 pb-4">
          <DialogTitle>Pool — {chestDisplayName(chest)}</DialogTitle>
          <DialogDescription>
            Danh sách khung có thể nhận hiện tại. Stock mua trực tiếp bằng 0 vẫn
            nằm trong pool nếu khung hợp lệ.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                aria-label="Lọc độ hiếm trong pool"
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
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? <Spinner /> : <RefreshCwIcon />}Tải lại pool
            </Button>
          </div>
          {query.isPending && (
            <p role="status" className="flex items-center gap-2">
              <Spinner />
              Đang tải pool…
            </p>
          )}
          {query.isError && (
            <ShopQueryError
              title="Không tải được pool"
              error={query.error}
              busy={query.isFetching}
              retry={() => void query.refetch()}
            />
          )}
          {query.data && (
            <>
              <p className="text-sm text-muted-foreground">
                {query.data.meta.total} khung phù hợp · 20 khung mỗi trang
              </p>
              {query.data.data.length ? (
                <div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  aria-busy={query.isFetching}
                >
                  {query.data.data.map((entry) => (
                    <Card key={entry.frame.id} size="sm">
                      <CardHeader>
                        <CardTitle className="line-clamp-2 min-h-10 wrap-anywhere">
                          {entry.frame.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {entry.code}
                        </p>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <AdminFramePreview frame={entry.frame} />
                        <p className="text-sm text-muted-foreground">
                          {entry.topic?.name ?? "Khác"}
                        </p>
                        <div className="flex gap-1.5">
                          <Badge variant="outline">{entry.rarity}</Badge>
                          {entry.frame.animated && (
                            <Badge variant="outline">Ảnh động</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  Không có khung phù hợp trong pool.
                </p>
              )}
              <AdminPagination
                ariaLabel="Phân trang pool"
                currentPage={page}
                totalPages={query.data.meta.totalPages}
                disabled={query.isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
        <DialogFooter className="border-t p-6 pt-4">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
