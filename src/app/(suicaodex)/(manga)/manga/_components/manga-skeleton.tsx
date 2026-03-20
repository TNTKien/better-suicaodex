import { Skeleton } from "@/components/ui/skeleton";

export default function MangaSkeleton() {
  return (
    <>
      <div className="absolute h-70 z-[-2] w-auto left-0 right-0 top-0 hidden md:block">
        <Skeleton className="absolute h-70 w-full bg-primary/30" />
      </div>

      <div className="flex flex-col gap-4 px-4 md:px-8 lg:px-12">
        <div className="flex flex-row gap-4">
          <div className="relative bg-background rounded-md">
            <Skeleton className="w-[130px] md:w-[200px] h-[182px] md:h-[280px] bg-primary/65 rounded-md" />
          </div>

          <div className="flex flex-col w-full justify-between">
            <div className="flex flex-col gap-4">
              <Skeleton className="w-full h-12 bg-primary/65 rounded-md" />
              <Skeleton className="w-2/3 h-6 bg-primary/65 rounded-md" />
            </div>

            <Skeleton className="w-1/2 h-4 md:h-10 bg-primary/65 rounded-md" />
          </div>
        </div>
      </div>
    </>
  );
}
