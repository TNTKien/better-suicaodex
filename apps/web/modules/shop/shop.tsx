"use client"

import Image from "next/image"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useQueryStates } from "nuqs"
import { FrameIcon, PackageOpenIcon, ShoppingBagIcon } from "lucide-react"
import { useAccount } from "@/modules/account/provider"
import { loginHref } from "@/modules/account/api"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { buttonVariants } from "@workspace/ui/components/button"
import { AvatarFrameShop, AvatarFrameShopSkeleton } from "./avatar-frame-shop"
import { GachaCatalog } from "./gacha-catalog"
import { shopWalletOptions } from "./api"
import { coinLabel } from "./admin-api"
import { ShopCategoryLink, shopParams, shopHref } from "./navigation"

export function Shop() {
  const account = useAccount()
  const [params] = useQueryStates(shopParams)
  const identity =
    account.status === "authenticated" &&
    account.account?.profile.status === "active"
      ? account.identity
      : null
  const wallet = useQuery(shopWalletOptions(account.apiBaseUrl, identity))
  const overview = params.category === "all"
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:justify-between">
        <h1 className="section-heading text-3xl">SuicaoShop</h1>
        <Card size="sm" className="gap-0 sm:min-w-52">
          <CardContent className="flex flex-col gap-2" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image
                src="/images/suicao_coin.webp"
                alt=""
                width={20}
                height={20}
                unoptimized
              />
              Số dư của bạn
            </p>
            {account.status === "guest" ? (
              <Link
                href={loginHref(
                  shopHref("/shop", { category: params.category })
                )}
                className={buttonVariants({
                  variant: "link",
                  className: "h-auto justify-start p-0",
                })}
              >
                Đăng nhập để xem số dư
              </Link>
            ) : wallet.data && identity ? (
              <p className="text-xl font-semibold tabular-nums">
                {coinLabel(wallet.data.balance)}
              </p>
            ) : account.status === "loading" ||
              (identity && wallet.isPending) ? (
              <Skeleton
                className="h-7 w-28 motion-reduce:animate-none"
                aria-label="Đang tải số dư"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Số dư chưa khả dụng
              </p>
            )}
          </CardContent>
        </Card>
      </header>
      <Separator />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] xl:gap-8">
        <aside className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Loại hàng
          </p>
          <nav
            aria-label="Loại sản phẩm trong Shop"
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
          >
            <ShopCategoryLink
              category="all"
              navigation
              className="shrink-0 justify-start"
            >
              <ShoppingBagIcon data-icon="inline-start" />
              Tất cả sản phẩm
            </ShopCategoryLink>
            <ShopCategoryLink
              category="avatar-frame"
              navigation
              className="shrink-0 justify-start"
            >
              <FrameIcon data-icon="inline-start" />
              Khung Avatar
            </ShopCategoryLink>
            <ShopCategoryLink
              category="gacha"
              navigation
              className="shrink-0 justify-start"
            >
              <PackageOpenIcon data-icon="inline-start" />
              Gacha
            </ShopCategoryLink>
          </nav>
        </aside>
        <div className="flex min-w-0 flex-col gap-10">
          {params.category !== "avatar-frame" && (
            <GachaCatalog overview={overview} />
          )}
          {params.category !== "gacha" && (
            <AvatarFrameShop overview={overview} />
          )}
        </div>
      </div>
    </div>
  )
}

export function ShopSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-label="Đang tải SuicaoShop"
      aria-busy="true"
      role="status"
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-12 w-48 motion-reduce:animate-none" />
        <Skeleton className="h-24 w-52 motion-reduce:animate-none" />
      </div>
      <Separator />
      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <Skeleton className="h-36 w-full motion-reduce:animate-none" />
        <AvatarFrameShopSkeleton count={5} />
      </div>
    </div>
  )
}
