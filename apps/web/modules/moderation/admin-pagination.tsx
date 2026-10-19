"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

type AdminPaginationProps = {
  ariaLabel: string
  currentPage: number
  disabled?: boolean
  onPageChange: (page: number) => void | Promise<unknown>
  totalPages: number
}

export function AdminPagination({
  ariaLabel,
  currentPage,
  disabled = false,
  onPageChange,
  totalPages,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center justify-center gap-2"
    >
      <Button
        aria-label="Trang trước"
        disabled={disabled || currentPage === 1}
        onClick={() => void onPageChange(currentPage - 1)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-14 text-center text-sm tabular-nums text-muted-foreground">
        {currentPage}/{totalPages}
      </span>
      <Button
        aria-label="Trang sau"
        disabled={disabled || currentPage === totalPages}
        onClick={() => void onPageChange(currentPage + 1)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  )
}
