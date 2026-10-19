import { Skeleton } from "@workspace/ui/components/skeleton"
import { RecentComments } from "@/modules/home/recent-comments"

export function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải trang cá nhân"
      aria-busy="true"
      className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div
        aria-hidden="true"
        className="hvn-login-panel [&_[data-slot=skeleton]]:rounded-none [&_[data-slot=skeleton]]:bg-neutral-800"
      >
        <div className="hvn-login-heading hvn-login-heading-main">
          Tường nhà
        </div>
        <div className="px-3 py-3 sm:px-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-24 shrink-0 sm:size-32" />
            <Skeleton className="mt-3 h-8 w-48 max-w-full" />
          </div>
          <div className="mt-6 flex flex-col gap-3 border border-[#444444] px-3 py-5 sm:px-6">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
      <RecentComments variant="profile" comments={[]} loading />
    </div>
  )
}
