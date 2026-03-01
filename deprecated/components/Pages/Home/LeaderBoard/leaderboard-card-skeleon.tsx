"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderBoardCardSkeleton() {
  return (
    <Card className="rounded-sm shadow-none transition-colors duration-200 border-none dark:bg-background">
      <CardContent className="flex gap-2 p-1">
        <Skeleton className="w-20 h-28 shrink-0 bg-gray-500 rounded-sm" />
        <div className="flex flex-col justify-evenly w-full">
          <Skeleton className="w-full h-5 bg-gray-500 rounded-sm" />
          <Skeleton className="w-2/3 h-4 bg-gray-500 rounded-sm" />
          <Skeleton className="w-1/3 h-3 bg-gray-500 rounded-sm" />
        </div>
      </CardContent>
    </Card>
  );
}
