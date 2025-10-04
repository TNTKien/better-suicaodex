"use client";

import DetailsCard from "@/components/Search/Result/details-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { getMangasByIDs } from "@/lib/mangadex/history";
import { LibraryType } from "@/types/types";
import { Trash, Undo, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import DoroLoading from "#/images/doro-loading.gif";

interface MyLibraryProps {
  category: Omit<LibraryType, "none">;
}

const LIMIT = 32;

export default function MyLibrary({ category }: MyLibraryProps) {
  const { localLibrary, removeFromLocalLibrary } = useLocalLibrary();
  const ids = localLibrary[category as keyof typeof localLibrary] || [];
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const offset = (page - 1) * LIMIT;
  const totalPages = Math.ceil(ids.length / LIMIT);

  const { data, error, isLoading } = useSWR(
    [category, page, ids],
    ([, , ids]) => getMangasByIDs(ids.slice(offset, offset + LIMIT)),
    {
      refreshInterval: 1000 * 60 * 10,
      revalidateOnFocus: false,
    }
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Reset pending delete when changing page
    setPendingDeleteId(null);
  };

  const handleDeleteClick = (mangaId: string) => {
    setPendingDeleteId(mangaId);
  };

  const handleUndoClick = () => {
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = (mangaId: string) => {
    removeFromLocalLibrary(mangaId);
    setPendingDeleteId(null);
  };

  if (isLoading) {
    return (
      <Alert className="rounded-sm border-none">
        <AlertDescription className="flex justify-center">
          <Image
            src={DoroLoading}
            alt="Loading..."
            unoptimized
            priority
            className="w-20 h-auto"
          />
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertDescription className="flex justify-center">
          Lỗi mất rồi 😭
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertDescription className="flex justify-center">
          Chưa có truyện nào!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {data.map((manga) => (
          <div key={manga.id} className="relative group">
            <div className="flex items-center w-full overflow-hidden">
              <div
                className={cn(
                  "flex-grow transition-transform duration-300 ease-in-out group-hover:translate-x-[-60px]",
                  pendingDeleteId === manga.id &&
                    "translate-x-[-60px] grayscale opacity-60"
                )}
              >
                <DetailsCard manga={manga} />
              </div>

              {pendingDeleteId === manga.id ? (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 flex flex-col gap-1 h-full">
                  <Button
                    variant="outline"
                    onClick={handleUndoClick}
                    className="rounded-sm h-full w-10 mr-1 flex items-center justify-center"
                  >
                    <Undo className="size-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleConfirmDelete(manga.id)}
                    className="rounded-sm h-full w-10 flex items-center justify-center"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteClick(manga.id)}
                  className="rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out h-full w-10 absolute right-0 top-1/2 transform -translate-y-1/2"
                >
                  <Trash className="size-5" />
                </Button>
              )}
            </div>
          </div>
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
