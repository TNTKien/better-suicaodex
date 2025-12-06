"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function MangaDetailsSkeleton() {
  return (
    <>
      <div className="absolute h-70 z-[-2] w-auto left-0 right-0 top-0 hidden md:block">
        <div
          className={cn(
            "absolute h-70 w-full",
            "transition-[width] duration-150 ease-in-out",
            "bg-no-repeat bg-cover bg-center-25 bg-gray-800/50"
          )}
        ></div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-4">
          <div className="relative bg-background rounded-md">
            <Skeleton className="w-[130px] md:w-[200px] h-[182px] md:h-[280px] bg-gray-500 rounded-md" />
          </div>

          <div className="flex flex-col w-full justify-between">
            <div className="flex flex-col gap-4">
              <Skeleton className="w-full h-12 bg-gray-500 rounded-md" />
              <Skeleton className="w-2/3 h-6 bg-gray-500 rounded-md" />
            </div>

            <Skeleton className="w-1/2 h-4 md:h-10 bg-gray-500 rounded-md" />
          </div>
        </div>
      </div>
    </>
  );
}
