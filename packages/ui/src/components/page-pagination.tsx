import Link from "next/link"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { cn } from "@workspace/ui/lib/utils"

type PagePaginationProps = {
  ariaLabel: string
  currentPage: number
  getPageHref: (page: number) => string
  onPageChange?: (page: number) => void
  totalPages: number
  variant?: "default" | "hvn"
}

function getPaginationItems(
  page: number,
  totalPages: number,
  variant: "default" | "hvn"
) {
  if (variant === "hvn") {
    const start = Math.max(1, Math.min(page - 4, totalPages - 9))
    const end = Math.min(totalPages, start + 9)
    const items: (number | string)[] = []
    if (start > 1) {
      items.push(1)
      if (start > 2) items.push("start")
    }
    for (let item = start; item <= end; item++) items.push(item)
    if (end < totalPages) {
      if (end < totalPages - 1) items.push("end")
      items.push(totalPages)
    }
    return items
  }
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  if (page <= 4) return [1, 2, 3, 4, 5, "end", totalPages] as const
  if (page >= totalPages - 3) {
    return [
      1,
      "start",
      ...Array.from({ length: 5 }, (_, index) => totalPages - 4 + index),
    ]
  }
  return [1, "start", page - 1, page, page + 1, "end", totalPages] as const
}

export function PagePagination({
  ariaLabel,
  currentPage,
  getPageHref,
  onPageChange,
  totalPages,
  variant = "default",
}: PagePaginationProps) {
  if (totalPages <= 1) return null

  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages
  const pageLink = (page: number) => (
    <Link
      href={getPageHref(page)}
      onNavigate={
        onPageChange
          ? (event) => {
              event.preventDefault()
              onPageChange(page)
            }
          : undefined
      }
    />
  )

  return (
    <Pagination
      aria-label={ariaLabel}
      className={variant === "hvn" ? "hvn-pagination" : undefined}
    >
      <PaginationContent className="flex-wrap justify-center">
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={isFirstPage}
            aria-label="Đến trang trước"
            className={cn(
              variant === "hvn" ? "gap-0" : "gap-0 pl-0!",
              isFirstPage && "pointer-events-none opacity-50"
            )}
            render={isFirstPage ? undefined : pageLink(currentPage - 1)}
            tabIndex={isFirstPage ? -1 : undefined}
            text={variant === "hvn" ? "◀ Prev" : ""}
            showIcon={variant !== "hvn"}
          />
        </PaginationItem>

        {getPaginationItems(currentPage, totalPages, variant).map((item) => (
          <PaginationItem key={item}>
            {typeof item === "number" ? (
              <PaginationLink
                aria-label={`Đến trang ${item}`}
                isActive={item === currentPage}
                render={pageLink(item)}
              >
                {item}
              </PaginationLink>
            ) : variant === "hvn" ? (
              <span data-slot="pagination-ellipsis" aria-hidden="true">
                ...
              </span>
            ) : (
              <PaginationEllipsis />
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            aria-disabled={isLastPage}
            aria-label="Đến trang sau"
            className={cn(
              variant === "hvn" ? "gap-0" : "gap-0 pr-0!",
              isLastPage && "pointer-events-none opacity-50"
            )}
            render={isLastPage ? undefined : pageLink(currentPage + 1)}
            tabIndex={isLastPage ? -1 : undefined}
            text={variant === "hvn" ? "Next ▶" : ""}
            showIcon={variant !== "hvn"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
