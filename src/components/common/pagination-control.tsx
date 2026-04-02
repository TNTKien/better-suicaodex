import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NoPrefetchLink from "./no-prefetch-link";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationControlBaseProps {
  currentPage: number;
  totalPages: number;
  className?: string;
}

interface LinkPaginationControlProps extends PaginationControlBaseProps {
  createHref: (page: number) => string;
  onPageChange?: never;
  prefetch?: boolean;
}

interface ActionPaginationControlProps extends PaginationControlBaseProps {
  onPageChange: (page: number) => void;
  createHref?: never;
  prefetch?: never;
}

type PaginationControlProps =
  | LinkPaginationControlProps
  | ActionPaginationControlProps;

function renderPageRange(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  return [currentPage - 1, currentPage, currentPage + 1];
}

export default function PaginationControl({
  currentPage,
  totalPages,
  className = "",
  ...props
}: PaginationControlProps) {
  const isLinkMode = "createHref" in props;
  const createHref = isLinkMode ? props.createHref : null;
  const onPageChange = isLinkMode ? null : props.onPageChange;
  const LinkComponent = isLinkMode
    ? props.prefetch
      ? Link
      : NoPrefetchLink
    : null;

  const renderPageLink = (page: number) => {
    if (createHref && LinkComponent) {
      return (
        <PaginationLink
          asChild
          className="w-8 h-8"
          isActive={page === currentPage}
        >
          <LinkComponent href={createHref(page)}>{page}</LinkComponent>
        </PaginationLink>
      );
    }

    return (
      <PaginationLink
        className="w-8 h-8"
        isActive={page === currentPage}
        onClick={() => {
          onPageChange?.(page);
        }}
      >
        {page}
      </PaginationLink>
    );
  };

  const renderPrevious = () => {
    if (currentPage === 1) {
      return <PaginationPrevious className="w-8 h-8" disabled />;
    }

    if (createHref && LinkComponent) {
      return (
        <PaginationLink
          asChild
          aria-label="Go to previous page"
          className="w-8 h-8"
        >
          <LinkComponent href={createHref(currentPage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </LinkComponent>
        </PaginationLink>
      );
    }

    return (
      <PaginationPrevious
        className="w-8 h-8"
        onClick={() => {
          onPageChange?.(currentPage - 1);
        }}
      />
    );
  };

  const renderNext = () => {
    if (currentPage === totalPages) {
      return <PaginationNext className="w-8 h-8" disabled />;
    }

    if (createHref && LinkComponent) {
      return (
        <PaginationLink
          asChild
          aria-label="Go to next page"
          className="w-8 h-8"
        >
          <LinkComponent href={createHref(currentPage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </LinkComponent>
        </PaginationLink>
      );
    }

    return (
      <PaginationNext
        className="w-8 h-8"
        onClick={() => {
          onPageChange?.(currentPage + 1);
        }}
      />
    );
  };

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>{renderPrevious()}</PaginationItem>

        {totalPages <= 7 ? (
          Array.from({ length: totalPages }, (_, i) => (
            <PaginationItem key={i + 1}>{renderPageLink(i + 1)}</PaginationItem>
          ))
        ) : currentPage <= 4 ? (
          <>
            {[1, 2, 3, 4, 5].map((num) => (
              <PaginationItem key={num}>{renderPageLink(num)}</PaginationItem>
            ))}
            <PaginationEllipsis />
            <PaginationItem>{renderPageLink(totalPages)}</PaginationItem>
          </>
        ) : currentPage >= totalPages - 3 ? (
          <>
            <PaginationItem>{renderPageLink(1)}</PaginationItem>
            <PaginationEllipsis />
            {[
              totalPages - 4,
              totalPages - 3,
              totalPages - 2,
              totalPages - 1,
              totalPages,
            ].map((num) => (
              <PaginationItem key={num}>{renderPageLink(num)}</PaginationItem>
            ))}
          </>
        ) : (
          <>
            <PaginationItem>{renderPageLink(1)}</PaginationItem>
            <PaginationEllipsis />
            {renderPageRange(totalPages, currentPage).map((num) => (
              <PaginationItem key={num}>{renderPageLink(num)}</PaginationItem>
            ))}
            <PaginationEllipsis />
            <PaginationItem>{renderPageLink(totalPages)}</PaginationItem>
          </>
        )}

        <PaginationItem>{renderNext()}</PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
