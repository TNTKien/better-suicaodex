import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem(props: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  href?: React.ComponentPropsWithoutRef<"a">["href"]
  isActive?: boolean
} & Omit<React.ComponentProps<typeof Button>, "nativeButton" | "variant">

function PaginationLink({
  className,
  href,
  isActive,
  render,
  size = "icon-sm",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      {...props}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive}
      data-slot="pagination-link"
      variant={isActive ? "default" : "secondary"}
      size={size}
      className={className}
      nativeButton={false}
      render={render ?? <a href={href} />}
    />
  )
}

function PaginationPrevious({
  className,
  text = "Previous",
  showIcon = true,
  ...props
}: React.ComponentProps<typeof PaginationLink> & {
  text?: string
  showIcon?: boolean
}) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="icon-sm"
      className={cn("pl-2!", className)}
      {...props}
    >
      {showIcon ? <ChevronLeftIcon data-icon="inline-start" /> : null}
      <span className="hidden sm:block">{text}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  text = "Next",
  showIcon = true,
  ...props
}: React.ComponentProps<typeof PaginationLink> & {
  text?: string
  showIcon?: boolean
}) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="icon-sm"
      className={cn("pr-2!", className)}
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      {showIcon ? <ChevronRightIcon data-icon="inline-end" /> : null}
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
