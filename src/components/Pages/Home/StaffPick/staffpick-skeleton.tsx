import { Skeleton } from "@/components/ui/skeleton";

export default function StaffPickSkeleton() {
  return (
    <div className="flex flex-col">
      <hr className="w-9 h-1 bg-primary border-none" />
      <h1 className="text-2xl font-black uppercase">Truyện đề cử</h1>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {[...Array(8)].map((_, index) => (
          <Skeleton
            key={index}
            className="w-full h-[300px] rounded-sm bg-gray-500"
          />
        ))}
      </div>
    </div>
  );
}
