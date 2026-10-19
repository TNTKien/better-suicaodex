import { Skeleton } from "@workspace/ui/components/skeleton"

export function GroupSkeleton() {
  return (
    <div role="status" aria-label="Đang tải nhóm dịch" aria-busy="true">
      <div
        aria-hidden="true"
        className="[&_[data-slot=skeleton]]:bg-neutral-800"
      >
        <Skeleton className="mb-2 ml-2 h-5 w-64 max-w-full rounded-none" />
        <div className="hvn-login-panel">
          <div className="hvn-login-heading hvn-login-heading-info">
            Thông tin
          </div>
          <div className="flex flex-col items-start gap-4 px-4 py-4 sm:flex-row">
            <Skeleton className="size-24 shrink-0 rounded-full sm:size-32" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Skeleton className="h-7 w-56 max-w-full rounded-none" />
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton
                  key={row}
                  className="h-5 w-64 max-w-full rounded-none"
                />
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="mt-6 h-9 w-full rounded-none" />
        <Skeleton className="mt-2 h-52 w-full rounded-none" />
      </div>
    </div>
  )
}
