"use client";

import { useConfig } from "@/hooks/use-config";
import { getLatestChapters } from "@/lib/mangadex/latest";
import useSWR from "swr";
import LatestCard from "./latest-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LatestSkeleton from "./latest-skeleton";

export default function LatestUpdate() {
  const [config] = useConfig();
  const { data, error, isLoading } = useSWR(
    [18, config.translatedLanguage, config.r18],
    ([max, language, r18]) => getLatestChapters(max, language, r18),
    {
      refreshInterval: 1000 * 60 * 10,
    }
  );

  if (isLoading)
    return (
      <div className="flex flex-col">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>

        <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, index) => (
            <LatestSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  if (error || !data) return null;

  const [part1, part2, part3] = splitArr(data);

  return (
    <div className="flex flex-col">
      <div className="flex justify-between">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
        </div>

        <Button asChild size="icon" variant="ghost" className="[&_svg]:size-6">
          <Link href={`/latest`}>
            <ArrowRight className="size-6" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-3">
          {part1.map((chapter) => (
            <LatestCard key={chapter.id} chapter={chapter} />
          ))}
        </div>

        <div className="hidden md:grid grid-cols-1 gap-3">
          {part2.map((chapter) => (
            <LatestCard key={chapter.id} chapter={chapter} />
          ))}
        </div>

        <div className="hidden lg:grid grid-cols-1 gap-3">
          {part3.map((chapter) => (
            <LatestCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </div>
    </div>
  );
}

function splitArr<T>(array: T[]): [T[], T[], T[]] {
  const size = array.length / 3;
  const part1 = array.slice(0, size);
  const part2 = array.slice(size, size * 2);
  const part3 = array.slice(size * 2);

  return [part1, part2, part3];
}
