"use client";

import { getGroupStats } from "@/lib/mangadex/group";
import { MessageSquare, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../ui/skeleton";

interface GroupStatsProps {
  id: string;
}

export default function GroupStats({ id }: GroupStatsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["group-stats", id],
    queryFn: () => getGroupStats(id),
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  if (isLoading || error || !data)
    return (
      <div className="flex flex-row items-center gap-4">
        <span className="flex flex-row items-center gap-1">
          <Upload size={18} />{" "}
          <Skeleton className="w-6 h-[18px] rounded-sm bg-gray-300" />
        </span>
        <span className="flex flex-row items-center gap-1">
          <MessageSquare size={18} />{" "}
          <Skeleton className="w-6 h-[18px] rounded-sm bg-gray-300" />
        </span>
      </div>
    );
  //   if (error) return <div>Error loading group stats</div>;
  //   if (!data) return <div>No data...</div>;

  return (
    <div className="flex flex-row items-center gap-4">
      <span className="flex flex-row items-center gap-1">
        <Upload size={18} /> {data.totalUploaded.toLocaleString("en-US")}
      </span>
      <span className="flex flex-row items-center gap-1">
        <MessageSquare size={18} /> {data.repliesCount.toLocaleString("en-US")}
      </span>
    </div>
  );
}
