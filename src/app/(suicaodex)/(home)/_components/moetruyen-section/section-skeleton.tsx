import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/utils";

function MoetruyenSkeletonCard({
  className,
  showAction = false,
}: {
  className?: string;
  showAction?: boolean;
}) {
  return (
    <Skeleton
      className={cn(
        "relative overflow-hidden rounded-md bg-gray-500 p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      <div className="flex h-full flex-col justify-end gap-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-full max-w-[20rem]" />
          <Skeleton className="h-4 w-36 max-w-full" />
        </div>

        {showAction ? <Skeleton className="h-10 w-40 rounded-full" /> : null}
      </div>
    </Skeleton>
  );
}

export default function MoetruyenSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">MoèTruyện</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="grid gap-4">
          <MoetruyenSkeletonCard
            className="min-h-[18rem] sm:min-h-[22rem]"
            // showAction
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoetruyenSkeletonCard className="min-h-[13rem]" />
            <MoetruyenSkeletonCard className="min-h-[13rem]" />
          </div>
        </div>

        <div className="grid gap-4">
          <MoetruyenSkeletonCard className="min-h-[13rem]" />
          <MoetruyenSkeletonCard className="min-h-[18rem] sm:min-h-[22rem]" />
        </div>
      </div>
    </div>
  );
}
