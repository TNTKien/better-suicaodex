import Link from "next/link";
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis
} from "@/components/ui/pagination";
import NoPrefetchLink from "./no-prefetch-link";

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
  prefetch = false
}: PaginationControlProps) {
  const LinkComponent = prefetch ? Link : NoPrefetchLink;
  
  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <LinkComponent href={currentPage > 1 ? createHref(currentPage - 1) : "#"} 
            aria-disabled={currentPage === 1}
            tabIndex={currentPage === 1 ? -1 : undefined}>
            <PaginationPrevious
              className="w-8 h-8"
              disabled={currentPage === 1}
            />
          </LinkComponent>
        </PaginationItem>

        {totalPages <= 7 ? (
          // Show all pages if total is 7 or less
          Array.from({ length: totalPages }, (_, i) => (
            <PaginationItem key={i + 1}>
              <LinkComponent href={createHref(i + 1)}>
                <PaginationLink
                  className="w-8 h-8"
                  isActive={i + 1 === currentPage}
                >
                  {i + 1}
                </PaginationLink>
              </LinkComponent>
            </PaginationItem>
          ))
        ) : currentPage <= 4 ? (
          // Near start: show 1, 2, 3, 4, 5, ..., lastPage
          <>
            {[1, 2, 3, 4, 5].map((num) => (
              <PaginationItem key={num}>
                <LinkComponent href={createHref(num)}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={num === currentPage}
                  >
                    {num}
                  </PaginationLink>
                </LinkComponent>
              </PaginationItem>
            ))}
            <PaginationEllipsis />
            <PaginationItem>
              <LinkComponent href={createHref(totalPages)}>
                <PaginationLink className="w-8 h-8">
                  {totalPages}
                </PaginationLink>
              </LinkComponent>
            </PaginationItem>
          </>
        ) : currentPage >= totalPages - 3 ? (
          // Near end: show 1, ..., lastPage-4, lastPage-3, lastPage-2, lastPage-1, lastPage
          <>
            <PaginationItem>
              <LinkComponent href={createHref(1)}>
                <PaginationLink className="w-8 h-8">
                  1
                </PaginationLink>
              </LinkComponent>
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
                <LinkComponent href={createHref(num)}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={num === currentPage}
                  >
                    {num}
                  </PaginationLink>
                </LinkComponent>
              </PaginationItem>
            ))}
          </>
        ) : (
          // Middle: show 1, ..., page-1, page, page+1, ..., lastPage
          <>
            <PaginationItem>
              <LinkComponent href={createHref(1)}>
                <PaginationLink className="w-8 h-8">
                  1
                </PaginationLink>
              </LinkComponent>
            </PaginationItem>
            <PaginationEllipsis />
            {[currentPage - 1, currentPage, currentPage + 1].map((num) => (
              <PaginationItem key={num}>
                <LinkComponent href={createHref(num)}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={num === currentPage}
                  >
                    {num}
                  </PaginationLink>
                </LinkComponent>
              </PaginationItem>
            ))}
            <PaginationEllipsis />
            <PaginationItem>
              <LinkComponent href={createHref(totalPages)}>
                <PaginationLink className="w-8 h-8">
                  {totalPages}
                </PaginationLink>
              </LinkComponent>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <LinkComponent href={currentPage < totalPages ? createHref(currentPage + 1) : "#"}
            aria-disabled={currentPage === totalPages}
            tabIndex={currentPage === totalPages ? -1 : undefined}>
            <PaginationNext
              className="w-8 h-8"
              disabled={currentPage === totalPages}
            />
          </LinkComponent>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}