import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const LIMIT = 10;

export default function MoeRecentCommentsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
      </div>

      <div className="grid gap-3">
        {Array.from({ length: LIMIT }).map((_, index) => (
          <Card key={index} className="rounded-sm border-none p-3 shadow-xs">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-gray-500" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-4 w-24 rounded-md bg-gray-500" />
                    <Skeleton className="h-3 w-40 rounded-md bg-gray-500" />
                  </div>
                  <Skeleton className="h-3 w-20 rounded-md bg-gray-500" />
                </div>

                <div className="rounded-2xl bg-muted px-3 py-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-full rounded-md bg-gray-500" />
                    <Skeleton className="h-3 w-5/6 rounded-md bg-gray-500" />
                    <Skeleton className="h-3 w-2/3 rounded-md bg-gray-500" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Skeleton className="h-3 w-24 rounded-md bg-gray-500" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
