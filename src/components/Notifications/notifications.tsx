"use client";

import { useLocalNotification } from "@/hooks/use-local-notification";
import { getUnreadChapters } from "@/lib/notifications";
import useSWR from "swr";
import { Button } from "../ui/button";
import { BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { Chapter } from "@/types/types";
import UnreadCard from "./unread-card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useRouter } from "next/navigation";

interface NotificationsProps {
  page: number;
}

const LIMIT = 32; // Number of notifications per page

export default function Notifications({ page }: NotificationsProps) {
  const { markAllAsRead, localNotification, clearAllLocalNotifications } =
    useLocalNotification();
  const router = useRouter();

  const unreadIds = localNotification.unread;
  const totalPages = Math.ceil(unreadIds.length / LIMIT);
  const idsPerPage = unreadIds.slice((page - 1) * LIMIT, page * LIMIT);

  const { data, error, isLoading } = useSWR(["noti", idsPerPage], ([, ids]) =>
    getUnreadChapters(ids)
  );

  const handlePageChange = (newPage: number) => {
    router.push(`/notifications?page=${newPage}`);
  };

  return (
    <>
      <div className="w-full flex flex-wrap gap-2 justify-end">
        <Button
          className="w-full md:w-auto whitespace-normal! break-all! shrink! line-clamp-1 flex"
          size="sm"
          onClick={clearAllLocalNotifications}
          variant="secondary"
        >
          <BellOff />
          <span className="break-all line-clamp-1">
            Hủy nhận thông báo tất cả
          </span>
        </Button>
        <Button
          className="w-full md:w-auto whitespace-normal! break-all! shrink! line-clamp-1 flex"
          size="sm"
          onClick={markAllAsRead}
          variant="secondary"
        >
          <CheckCheck />
          <span className="break-all line-clamp-1">
            Đánh dấu tất cả là đã đọc
          </span>
        </Button>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <NotificationSection isLoading={isLoading} error={error} data={data} />
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

interface NotificationSectionProps {
  isLoading: boolean;
  error: any;
  data: Chapter[] | undefined;
}

function NotificationSection({
  isLoading,
  error,
  data,
}: NotificationSectionProps) {
  if (isLoading) {
    return (
      <Alert className="rounded-sm border-none">
        <AlertDescription className="flex justify-center">
          <Loader2 className="animate-spin" />
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
          Không có thông báo nào
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {data.map((chapter) => (
        <UnreadCard key={chapter.id} chapter={chapter} />
      ))}
    </>
  );
}
