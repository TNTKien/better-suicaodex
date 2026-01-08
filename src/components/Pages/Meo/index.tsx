"use client";

import { getCatsList, getCatCount, type Cat } from "@/lib/cat";
import useSWR from "swr";
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
import { CatCard } from "./cat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BugIcon, FolderXIcon } from "lucide-react";

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

  if (error) {
    return (
      <Alert variant="destructive">
        <BugIcon />
        <AlertTitle>Lỗi mất rồi!</AlertTitle>
        <AlertDescription>Thử load lại trang xem sao nhé 😿</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {[...Array(20)].map((_, index) => (
          <Skeleton
            key={index}
            className="w-full rounded-sm aspect-5/7 bg-gray-500"
          />
        ))}
      </div>
    );
  }

  if (!cats || cats.length === 0) {
    return (
      <>
        <Alert>
          <FolderXIcon />
          <AlertTitle>Hết mèo rồi!</AlertTitle>
          <AlertDescription>Ngó xem có nhầm trang không ba 😹</AlertDescription>
        </Alert>

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
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {cats.map((cat) => (
          <CatCard key={cat.id} cat={cat} />
        ))}
      </div>

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
    </>
  );
}
