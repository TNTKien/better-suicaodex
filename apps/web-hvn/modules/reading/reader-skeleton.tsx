import { Skeleton } from "@workspace/ui/components/skeleton"

export function ReaderSkeleton() {
  return (
    <div role="status" aria-label="Đang tải chương" aria-busy="true">
      <div
        aria-hidden="true"
        className="min-w-0 [&_[data-slot=skeleton]]:rounded-none [&_[data-slot=skeleton]]:bg-neutral-800"
      >
        <Skeleton className="mb-2 ml-2 h-5 w-80 max-w-[calc(100%-1rem)]" />
        <Skeleton className="h-8 w-full" />
        <div className="flex flex-col items-center gap-4 px-2 pt-3">
          <Skeleton className="h-9 w-full max-w-3xl" />
          <div className="flex flex-wrap justify-center gap-1.5">
            {[0, 1, 2, 3].map((server) => (
              <Skeleton key={server} className="h-10 w-24" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 py-5">
          <Skeleton className="size-8 shrink-0" />
          <Skeleton className="h-8 w-68 max-w-[calc(100%-7rem)]" />
          <Skeleton className="size-8 shrink-0" />
        </div>
        <div className="mx-auto w-full max-w-7xl px-2">
          <Skeleton className="aspect-[2/3] w-full" />
        </div>
      </div>
    </div>
  )
}
