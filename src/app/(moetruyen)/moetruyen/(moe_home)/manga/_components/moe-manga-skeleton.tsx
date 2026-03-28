import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MoeMangaSkeleton() {
  return (
    <div className="grid px-4 md:px-8 lg:px-12">
      <Skeleton className="col-start-1 row-start-1 h-[280px] rounded-none md:h-[360px] lg:h-[420px]" />

      <div className="col-start-1 row-start-1 grid grid-cols-1 gap-4 pt-8">
        <div className="grid w-full grid-cols-[auto_1fr] gap-4">
          <Skeleton className="aspect-5/7 w-[130px] rounded-sm md:w-[200px]" />
          <div className="space-y-4 pt-6 md:pt-12">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Card className="rounded-sm border-none shadow-xs">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
