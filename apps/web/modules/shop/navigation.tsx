"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { buttonVariants } from "@workspace/ui/components/button"

export const shopFrameParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  rarity: parseAsStringLiteral(["all", "R", "SR", "SSR"]).withDefault("all"),
  topicId: parseAsString.withDefault("all"),
}
export const shopParams = {
  category: parseAsStringLiteral(["all", "avatar-frame", "gacha"]).withDefault(
    "all"
  ),
  ...shopFrameParams,
}
export const shopHref = createSerializer(shopParams)
export type ShopCategory = "all" | "avatar-frame" | "gacha"

export function ShopCategoryLink({
  category,
  children,
  className,
  navigation = false,
}: {
  category: ShopCategory
  children: ReactNode
  className?: string
  navigation?: boolean
}) {
  const [params, setParams] = useQueryStates(shopParams, { history: "push" })
  const active = navigation && params.category === category
  return (
    <Link
      href={shopHref("/shop", { category })}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({
        variant: navigation ? (active ? "secondary" : "ghost") : "outline",
        className,
      })}
      onNavigate={(event) => {
        event.preventDefault()
        void setParams({
          category,
          page: null,
          q: null,
          rarity: null,
          topicId: null,
        })
      }}
    >
      {children}
    </Link>
  )
}
