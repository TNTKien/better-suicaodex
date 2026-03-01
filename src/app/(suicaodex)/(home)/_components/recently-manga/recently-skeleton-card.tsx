"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecentlySkeletonCard() {
  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200 overflow-hidden border-none">
      <Skeleton className="w-full aspect-5/7 rounded-none bg-gray-500" />
    </Card>
  );
}
