"use client";

import { getCatImageUrl, getCatsList, getCatCount, type Cat } from "@/lib/cat";
import { LazyLoadImage } from "react-lazy-load-image-component";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface MeoPageProps {
  page: number;
  limit: number;
}

async function fetchCatsList(skip: number, limit: number): Promise<Cat[]> {
  return await getCatsList(skip, limit);
}

export default function MeoPage({ page, limit }: MeoPageProps) {
  const router = useRouter();
  const skip = (page - 1) * limit;

  const {
    data: cats,
    error,
    isLoading,
  } = useSWR(`cats-${skip}-${limit}`, () => fetchCatsList(skip, limit), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: totalCats } = useSWR("cat-count", () => getCatCount());

  const totalPages = Math.ceil((totalCats || 0) / limit);
  const handlePageChange = (newPage: number) => {
    router.push(`/meo?page=${newPage}`);
  };

  return (
    <div className="flex-1">
      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="p-8 text-center">
          <p className="text-destructive mb-4">Failed to load cats 😿</p>
        </Card>
      )}

      {/* Cat Grid */}
      {!isLoading && !error && cats && cats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cats.map((cat) => (
            <Card key={cat.id} className="overflow-hidden group rounded-sm">
              <div className="relative aspect-square bg-muted">
                <LazyLoadImage
                  wrapperClassName="block! w-full h-full"
                  placeholderSrc={"/images/place-doro.webp"}
                  src={getCatImageUrl(cat.id, { width: 400, height: 400 })}
                  alt={`Cat ${cat.id}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/images/xidoco.webp";
                  }}
                />
              </div>
              {cat.tags && cat.tags.length > 0 && (
                <div className="p-2 bg-background/95 backdrop-blur">
                  <div className="flex flex-wrap gap-1">
                    {cat.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!cats || cats.length === 0) && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No cats found 😿</p>
        </Card>
      )}

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationPrevious
              className="w-8 h-8"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            />

            {totalPages <= 7 ? (
              // Show all pages if total is 7 or less
              Array.from({ length: totalPages }, (_, i) => (
                <PaginationItem key={i + 1}>
                  <PaginationLink
                    className="w-8 h-8"
                    isActive={i + 1 === page}
                    onClick={() => handlePageChange(i + 1)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))
            ) : page <= 4 ? (
              // Near start: show 1, 2, 3, 4, 5, ..., lastPage
              <>
                {[1, 2, 3, 4, 5].map((num) => (
                  <PaginationItem key={num}>
                    <PaginationLink
                      className="w-8 h-8"
                      isActive={num === page}
                      onClick={() => handlePageChange(num)}
                    >
                      {num}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationEllipsis />
                <PaginationItem>
                  <PaginationLink
                    className="w-8 h-8"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            ) : page >= totalPages - 3 ? (
              // Near end: show 1, ..., lastPage-4, lastPage-3, lastPage-2, lastPage-1, lastPage
              <>
                <PaginationItem>
                  <PaginationLink
                    className="w-8 h-8"
                    onClick={() => handlePageChange(1)}
                  >
                    1
                  </PaginationLink>
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
                    <PaginationLink
                      className="w-8 h-8"
                      isActive={num === page}
                      onClick={() => handlePageChange(num)}
                    >
                      {num}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              </>
            ) : (
              // Middle: show 1, ..., page-1, page, page+1, ..., lastPage
              <>
                <PaginationItem>
                  <PaginationLink
                    className="w-8 h-8"
                    onClick={() => handlePageChange(1)}
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
                <PaginationEllipsis />
                {[page - 1, page, page + 1].map((num) => (
                  <PaginationItem key={num}>
                    <PaginationLink
                      className="w-8 h-8"
                      isActive={num === page}
                      onClick={() => handlePageChange(num)}
                    >
                      {num}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationEllipsis />
                <PaginationItem>
                  <PaginationLink
                    className="w-8 h-8"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            )}

            <PaginationNext
              className="w-8 h-8"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            />
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
