import { Skeleton } from "@workspace/ui/components/skeleton"

export function MangaDetailSkeleton() {
  return (
    <div role="status" aria-label="Đang tải thông tin truyện" aria-busy="true">
      <div
        aria-hidden="true"
        className="min-w-0 [&_[data-slot=skeleton]]:rounded-none [&_[data-slot=skeleton]]:bg-neutral-800"
      >
        <Skeleton className="mb-2 ml-2 h-5 w-64 max-w-full" />
        <div className="flex flex-col-reverse items-start gap-6 md:flex-row">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
            <div className="hvn-login-panel w-full">
              <div className="hvn-login-heading hvn-login-heading-info">
                Thông tin truyện
              </div>
              <div className="flex flex-col gap-3 px-4 py-5 sm:px-6">
                <Skeleton className="mb-1 h-8 w-3/4" />
                {["w-2/3", "w-3/4", "w-1/2", "w-2/5", "w-3/5", "w-4/5"].map(
                  (width, index) => (
                    <Skeleton key={index} className={`h-5 ${width}`} />
                  )
                )}
                <div className="mt-2 flex flex-col gap-2">
                  <Skeleton className="mb-1 h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="mt-4 h-4 w-44 self-end" />
              </div>
            </div>
            <div className="hvn-login-panel w-full">
              <div className="hvn-home-heading">DANH SÁCH CHƯƠNG</div>
              <div className="px-4 py-4 sm:px-6">
                <div className="mb-3 flex items-start gap-3 border-b-2 border-[#2494f4] pb-3">
                  <Skeleton className="size-22 shrink-0" />
                  <div className="flex flex-col gap-2 pt-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between gap-4 border-b border-[#444444] py-3"
                  >
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex w-full max-w-xs shrink-0 flex-col gap-4 self-center md:w-66 md:self-start">
            <div className="hvn-login-panel">
              <div className="hvn-login-heading hvn-login-heading-main">
                Ảnh bìa
              </div>
              <div className="p-1.5">
                <Skeleton className="aspect-[7/10] w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
