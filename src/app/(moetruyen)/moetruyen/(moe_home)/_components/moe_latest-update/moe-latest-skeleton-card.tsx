"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MoeLatestSkeletonCard() {
  return (
    <Card className="rounded-md shadow-xs transition-colors duration-200 overflow-hidden border-none">
      <Skeleton className="w-full aspect-5/7 rounded-none bg-gray-500" />
      <CardContent className="flex flex-col gap-2 px-2 py-1.5">
        <div className="flex gap-1 items-center">
          <Skeleton className="w-6 h-4 bg-gray-500 rounded-md" />
          <Skeleton className="w-full h-4 bg-gray-500 rounded-md" />
        </div>
        <Skeleton className="w-1/2 h-3 bg-gray-500 rounded-md" />
        <Skeleton className="w-3/4 h-3 bg-gray-500 rounded-md" />
      </CardContent>
    </Card>
  );
}
