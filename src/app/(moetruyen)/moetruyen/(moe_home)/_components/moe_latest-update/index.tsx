"use client";

import { useMounted } from "@mantine/hooks";

import { useGetV2Manga } from "@/lib/moetruyen/hooks/manga/manga";

import MoeLatestMangaCard from "./moe-latest-manga-card";
import MoeLatestSkeletonCard from "./moe-latest-skeleton-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";

const LIMIT = 36;

export default function MoeLatestUpdate() {
  const isMounted = useMounted();

  const { data, isLoading, error } = useGetV2Manga(
    {
      limit: LIMIT,
      sort: "updated_at",
      include: "stats",
    },
    {
      query: {
        enabled: isMounted,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  );

  if (!isMounted || isLoading) {
    return (
      <div className="flex flex-col">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <MoeLatestSkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || data?.status !== 200 || !data.data.data.length) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Mới cập nhật</h1>
        </div>

        <Button
          asChild
          size="icon"
          variant="secondary"
          className="[&_svg]:size-5"
        >
          <Link href={siteConfig.moetruyen.domain} prefetch={false} target="_blank">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {data.data.data.map((manga) => (
          <MoeLatestMangaCard key={manga.id} manga={manga} />
        ))}
      </div>
    </div>
  );
}
