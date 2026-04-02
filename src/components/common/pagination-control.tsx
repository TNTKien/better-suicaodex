import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  createHref: (page: number) => string;
  className?: string;
  prefetch?: boolean;
}

export default function PaginationControl({
  currentPage,
  totalPages,
  createHref,
  className = "",
  prefetch = false,
}: PaginationControlProps) {
  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <Link
            href={currentPage > 1 ? createHref(currentPage - 1) : "#"}
            prefetch={prefetch}
            aria-disabled={currentPage === 1}
            tabIndex={currentPage === 1 ? -1 : undefined}
          >
            <PaginationPrevious
              className="w-8 h-8"
              disabled={currentPage === 1}
            />
          </Link>
        </PaginationItem>

        {totalPages <= 7 ? (
          // Show all pages if total is 7 or less
          Array.from({ length: totalPages }, (_, i) => (
            <PaginationItem key={i + 1}>
              <Link href={createHref(i + 1)} prefetch={prefetch}>
                <PaginationLink
                  className="w-8 h-8"
                  isActive={i + 1 === currentPage}
                >
                  {i + 1}
                </PaginationLink>
              </Link>
            </PaginationItem>
          ))
        ) : currentPage <= 4 ? (
          // Near start: show 1, 2, 3, 4, 5, ..., lastPage
          <>
            {[1, 2, 3, 4, 5].map((num) => (
              <PaginationItem key={num}>
                <Link href={createHref(num)} prefetch={prefetch}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={num === currentPage}
                  >
                    {num}
                  </PaginationLink>
                </Link>
              </PaginationItem>
            ))}
            <PaginationEllipsis />
            <PaginationItem>
              <Link href={createHref(totalPages)} prefetch={prefetch}>
                <PaginationLink className="w-8 h-8">
                  {totalPages}
                </PaginationLink>
              </Link>
            </PaginationItem>
          </>
        ) : currentPage >= totalPages - 3 ? (
          // Near end: show 1, ..., lastPage-4, lastPage-3, lastPage-2, lastPage-1, lastPage
          <>
            <PaginationItem>
              <Link href={createHref(1)} prefetch={prefetch}>
                <PaginationLink className="w-8 h-8">1</PaginationLink>
              </Link>
            </PaginationItem>
            <PaginationEllipsis />
            {[
              totalPages - 4,
              totalPages - 3,
              totalPages - 2,
              totalPages - 1,
              totalPages,
            ].map((num) => (
              <PaginationItem key={num}>
                <Link href={createHref(num)} prefetch={prefetch}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={num === currentPage}
                  >
                    {num}
                  </PaginationLink>
                </Link>
              </PaginationItem>
            ))}
          </>
        ) : (
          // Middle: show 1, ..., page-1, page, page+1, ..., lastPage
          <>
            <PaginationItem>
              <Link href={createHref(1)} prefetch={prefetch}>
                <PaginationLink className="w-8 h-8">1</PaginationLink>
              </Link>
            </PaginationItem>
            <PaginationEllipsis />
            {[currentPage - 1, currentPage, currentPage + 1].map((num) => (
              <PaginationItem key={num}>
                <Link href={createHref(num)} prefetch={prefetch}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={num === currentPage}
                  >
                    {num}
                  </PaginationLink>
                </Link>
              </PaginationItem>
            ))}
            <PaginationEllipsis />
            <PaginationItem>
              <Link href={createHref(totalPages)} prefetch={prefetch}>
                <PaginationLink className="w-8 h-8">
                  {totalPages}
                </PaginationLink>
              </Link>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <Link
            href={currentPage < totalPages ? createHref(currentPage + 1) : "#"}
            aria-disabled={currentPage === totalPages}
            tabIndex={currentPage === totalPages ? -1 : undefined}
            prefetch={prefetch}
          >
            <PaginationNext
              className="w-8 h-8"
              disabled={currentPage === totalPages}
            />
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
