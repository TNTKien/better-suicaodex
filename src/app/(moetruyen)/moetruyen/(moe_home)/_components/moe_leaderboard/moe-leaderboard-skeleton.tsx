import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MoeLeaderboardSkeleton({
  hideHeader = false,
}: {
  hideHeader?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {hideHeader ? null : (
        <div>
          <hr className="h-1 w-9 border-none bg-primary" />
          <h1 className="text-2xl font-black uppercase">Bảng xếp hạng</h1>
        </div>
      )}

      {hideHeader ? null : (
        <div className="grid h-auto w-full grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-7 rounded-md bg-gray-500" />
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {Array.from({ length: 10 }).map((_, index) => (
          <Card
            key={index}
            className="overflow-hidden rounded-sm border-none p-3 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-20 w-10 rounded-sm bg-gray-500" />
              <Skeleton className="h-20 w-14 rounded-sm bg-gray-500" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-full rounded-md bg-gray-500" />
                <Skeleton className="h-3 w-2/3 rounded-md bg-gray-500" />
                <Skeleton className="h-3 w-1/2 rounded-md bg-gray-500" />
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-3 w-16 rounded-md bg-gray-500" />
                  <Skeleton className="h-3 w-20 rounded-md bg-gray-500" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
