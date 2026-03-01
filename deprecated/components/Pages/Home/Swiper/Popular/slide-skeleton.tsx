"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function SlideSkeleton() {
  return (
    <>
      <div className="absolute z-10">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Tiêu điểm</h1>
      </div>

      <div className="flex flex-col gap-4 pt-12">
        <div className="flex flex-row gap-4">
          <div className="relative bg-background rounded-md">
            <Skeleton className="w-[130px] md:w-[200px] h-[182px] md:h-[285px] lg:w-[215px] lg:h-[307px] bg-gray-500 rounded-md" />
          </div>

          <div className="flex flex-col w-full justify-between">
            <div className="flex flex-col gap-4">
              <Skeleton className="w-full h-12 bg-gray-500 rounded-md" />
              <Skeleton className="hidden md:flex w-2/3 h-6 bg-gray-500 rounded-md" />
            </div>

            <Skeleton className="w-1/2 h-4 md:h-8 bg-gray-500 rounded-md" />
          </div>
        </div>

        <div className="flex md:hidden justify-between">
          <Skeleton className="w-1/12 h-5 bg-gray-500 rounded-full" />

          <Skeleton className="w-1/6 h-5 bg-gray-500 rounded-md" />

          <Skeleton className="w-1/12 h-5 bg-gray-500 rounded-full" />
        </div>
      </div>
    </>
  );
}
