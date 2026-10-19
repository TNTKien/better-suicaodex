"use client"

import { primaryWebOrigin } from "@workspace/catalog/origins"


import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { Spinner } from "@workspace/ui/components/spinner"
import { tagsQueryOptions } from "@/lib/tags-query"
import { HeaderAccount } from "@/components/header-account"

export function HeaderNavigation({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false)
  const query = useQuery(tagsQueryOptions)
  const fullColor = query.data?.find((tag) => tag.slug === "full-color")
  const itemClass = mobile ? "hvn-mobile-button rounded-[6px]!" : "hvn-button font-bold!"
  const linkClass = buttonVariants({
    size: "sm",
    variant: mobile ? "secondary" : "default",
    className: itemClass,
  })

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <nav
        aria-label={mobile ? "Điều hướng mobile" : "Điều hướng desktop"}
        className={
          mobile
            ? "hvn-mobile-navigation grid grid-cols-4 gap-2 p-2"
            : "hvn-desktop-navigation grid w-full grid-flow-col items-center gap-0"
        }
      >
        {!mobile && (
          <Link href="/" className={linkClass}>
            Trang chủ
          </Link>
        )}
        <CollapsibleTrigger
          render={
            <Button
              size="sm"
              variant={mobile ? "secondary" : "default"}
              className={itemClass}
            />
          }
        >
          Thể loại
        </CollapsibleTrigger>
        <Link href="/my-library" className={linkClass}>
          Thư viện
        </Link>
        <Link href="/history" className={linkClass}>
          Lịch sử đọc
        </Link>
        {!mobile &&
          (fullColor ? (
            <Link
              href={`/tag/${fullColor.id}/${fullColor.slug}`}
              className={linkClass}
            >
              Full Màu
            </Link>
          ) : (
            <Button
              size="sm"
              className={`${itemClass} hvn-placeholder`}
              disabled
              title={
                query.isPending
                  ? "Đang tải thể loại…"
                  : query.isError
                    ? "Không tải được danh sách thể loại"
                    : "Chưa có thể loại Full Color"
              }
            >
              Full Màu
            </Button>
          ))}
        <a
          href={primaryWebOrigin}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          SuicaoDex
        </a>
        {!mobile && <HeaderAccount />}
      </nav>

      <CollapsibleContent keepMounted>
        <div
          className="max-h-[515px] md:max-h-none overflow-y-auto py-1"
          aria-label="Danh sách thể loại"
          aria-busy={query.isPending}
        >
          {query.isPending ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground"
            >
              <Spinner aria-hidden="true" /> Đang tải thể loại…
            </p>
          ) : query.isError && !query.data ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-center gap-2 py-3 text-sm"
            >
              <p>Không tải được danh sách thể loại.</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                Thử lại
              </Button>
            </div>
          ) : query.data?.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Chưa có thể loại.
            </p>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {query.data?.map((tag) => (
                <li key={tag.id} className="min-w-0">
                  <Link
                    href={`/tag/${encodeURIComponent(tag.id)}/${encodeURIComponent(tag.slug)}`}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                      className: "hvn-genre-link w-full justify-start",
                    })}
                  >
                    <span className="truncate">{tag.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
